"""Generates the Recordings of an Edition's Words in its Narrator Voices (ADR 0083).

    python tools/recordings/generate.py --model <dir> --requests <file> [--edition-dir <dir>]
    python tools/recordings/generate.py --model <dir> --requests <file> --check

The requests are the list `pnpm recording-requests <edition-id>` prints:
`{ voice, wordId, text }`, the text being the Lemma with a combining acute
after its first stressed vowel. Each Recording goes to
`<edition-dir>/assets/recordings/<voice>/<wordId>.mp3`, mono 24 kHz 48 kbps,
and its text to `texts.json` in the same folder, Word id to text, so the
build asks again for a Recording whose Word's text has changed since.

`--check` is the Stress spot-check: it reads the Words of `CHECK_LEMMAS`
from the requests, once in each voice, writes nothing to the Edition, and
fails unless the text the engine read stresses the vowels the Word marks.

The model files come from `fetch-model.sh`, checked by SHA256; the engine is
given that folder, so it downloads nothing else.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

# The ukrainian-tts voice that reads each Narrator Voice of the Edition config.
# Dmytro is never used (ADR 0083).
ENGINE_VOICES = {
    "oksana": "Tetiana",
    "taras": "Mykyta",
    "marta": "Lada",
    "ostap": "Oleksa",
}

# The Words of the Stress spot-check: their Stress is known and easy to misplace.
CHECK_LEMMAS = ("кромлех", "антаблемент", "кракелюр", "заграва", "заплава")
TEXTS_FILE = "texts.json"

ACUTE = "́"
VOWELS = set("аеєиіїоуюяАЕЄИІЇОУЮЯ")


def stressed_vowels(text: str) -> list[int]:
    """The positions, among the vowels of a text, of those stressed by a combining acute."""
    positions: list[int] = []
    vowel = -1
    for character in text:
        if character in VOWELS:
            vowel += 1
        elif character == ACUTE and vowel >= 0:
            positions.append(vowel)
    return positions


def engine_stressed_vowels(text: str) -> list[int]:
    """The same for the text the engine read, which marks a stressed vowel with a `+` before it."""
    positions: list[int] = []
    vowel = -1
    marked = False
    for character in unicodedata.normalize("NFC", text):
        if character == "+":
            marked = True
        elif character in VOWELS:
            vowel += 1
            if marked:
                positions.append(vowel)
            marked = False
    return positions


def without_stress(text: str) -> str:
    return text.replace(ACUTE, "")


class Engine:
    def __init__(self, model_dir: Path) -> None:
        from ukrainian_tts.tts import TTS

        # The model's config names its feature stats relative to the working folder.
        here = Path.cwd()
        os.chdir(model_dir.resolve())
        try:
            self._tts = TTS(device="cpu", cache_folder=".")
        finally:
            os.chdir(here)

    def read(self, voice: str, text: str, wav: Path) -> str:
        """Writes the voice reading the text to a wav file; returns the text the engine read."""
        from ukrainian_tts.tts import Stress, Voices

        engine_voice = Voices[ENGINE_VOICES[voice]].value
        with wav.open("wb") as file:
            _, read = self._tts.tts(text, engine_voice, Stress.Dictionary.value, file)
        return read


def to_mp3(wav: Path, mp3: Path) -> None:
    mp3.parent.mkdir(parents=True, exist_ok=True)
    partial = mp3.with_suffix(".partial")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
         "-ac", "1", "-ar", "24000", "-b:a", "48k", "-f", "mp3", str(partial)],
        check=True,
    )
    # A run stopped midway leaves no broken Recording behind.
    os.replace(partial, mp3)


def generate(engine: Engine, requests: list[dict[str, str]], edition_dir: Path) -> None:
    recordings = edition_dir / "assets" / "recordings"
    with tempfile.TemporaryDirectory() as work:
        wav = Path(work) / "recording.wav"
        texts: dict[str, dict[str, str]] = {}
        for done, request in enumerate(requests, start=1):
            voice_dir = recordings / request["voice"]
            engine.read(request["voice"], request["text"], wav)
            to_mp3(wav, voice_dir / f"{request['wordId']}.mp3")
            voice_texts = texts.setdefault(request["voice"], read_texts(voice_dir))
            voice_texts[request["wordId"]] = request["text"]
            write_texts(voice_dir, voice_texts)
            if done % 50 == 0 or done == len(requests):
                print(f"{done}/{len(requests)}", flush=True)


def read_texts(voice_dir: Path) -> dict[str, str]:
    file = voice_dir / TEXTS_FILE
    return json.loads(file.read_text(encoding="utf-8")) if file.exists() else {}


def write_texts(voice_dir: Path, texts: dict[str, str]) -> None:
    partial = voice_dir / f"{TEXTS_FILE}.partial"
    partial.write_text(
        json.dumps(texts, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    os.replace(partial, voice_dir / TEXTS_FILE)


def check(engine: Engine, requests: list[dict[str, str]]) -> bool:
    checked = [r for r in requests if without_stress(r["text"]) in CHECK_LEMMAS]
    found = {without_stress(r["text"]) for r in checked}
    passed = found == set(CHECK_LEMMAS)
    if not passed:
        print(f"Missing spot-check Words: {sorted(set(CHECK_LEMMAS) - found)}")
    with tempfile.TemporaryDirectory() as work:
        wav = Path(work) / "check.wav"
        for request in checked:
            read = engine.read(request["voice"], request["text"], wav)
            ok = engine_stressed_vowels(read) == stressed_vowels(request["text"])
            passed = passed and ok
            print(f"{'ok  ' if ok else 'FAIL'} {request['voice']}: {request['text']} -> {read}")
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--requests", type=Path, required=True)
    parser.add_argument("--edition-dir", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    requests = json.loads(args.requests.read_text(encoding="utf-8"))
    unknown = {r["voice"] for r in requests} - ENGINE_VOICES.keys()
    if unknown:
        print(f"No engine voice for the Narrator Voices {sorted(unknown)}", file=sys.stderr)
        return 1
    engine = Engine(args.model)
    if args.check:
        return 0 if check(engine, requests) else 1
    if args.edition_dir is None:
        parser.error("--edition-dir is required unless --check")
    generate(engine, requests, args.edition_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
