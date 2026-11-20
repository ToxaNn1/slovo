"""Generates Recordings of Words in their Narrator Voices (ADR 0099).

    python recordings/generate.py --model <dir> --requests <file> --out-dir <dir>
    python recordings/generate.py --model <dir> --requests <file> --check

The requests are a JSON list of `{ id, voice, text }`, the text being what
the voice reads (the Lemma with a combining acute after its first stressed
vowel). The Recordings service (`pnpm recordings`) writes the list and reads
the result. Each Recording goes to `<out-dir>/<id>.mp3`, mono 24 kHz 48 kbps,
and `<out-dir>/results.json` lists `{ id, ok, durationMs }` for every
request done so far, rewritten after each one: a request the engine fails on
is `ok: false` and the others still get their Recordings, and a run stopped
at its time limit keeps the ones it made.

`--check` is the Stress spot-check: it reads the Words of `CHECK_LEMMAS`
from the requests, once in each voice, writes no Recording, and fails unless
the text the engine read stresses the vowels the Word marks.

The model files come from `fetch-model.sh`, checked by SHA256; the engine is
given that folder, so it downloads nothing else.

torch runs on `OMP_NUM_THREADS` threads (2 unless set; the Recordings service
sets it): by default it takes one per core of the whole host, more
than the container may run, and crawls. Each request prints the seconds it
took, line by line, so a run killed at its time limit still shows them.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
from pathlib import Path

# The ukrainian-tts voice that reads each Narrator Voice of the Edition config.
# Dmytro is never used.
ENGINE_VOICES = {
    "oksana": "Tetiana",
    "taras": "Mykyta",
    "marta": "Lada",
    "ostap": "Oleksa",
}

# The Words of the Stress spot-check: their Stress is known and easy to misplace.
CHECK_LEMMAS = ("кромлех", "антаблемент", "кракелюр", "заграва", "заплава")

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


def engine_threads() -> int:
    """The threads torch may use; the maths libraries are told the same before they load."""
    threads = os.environ.setdefault("OMP_NUM_THREADS", "2")
    for name in ("MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
        os.environ.setdefault(name, threads)
    return int(threads)


class Engine:
    def __init__(self, model_dir: Path) -> None:
        threads = engine_threads()
        import torch
        from ukrainian_tts.tts import TTS

        torch.set_num_threads(threads)
        torch.set_num_interop_threads(1)

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


def duration_ms(wav: Path) -> int:
    with wave.open(str(wav), "rb") as file:
        return round(file.getnframes() * 1000 / file.getframerate())


def generate(engine: Engine, requests: list[dict[str, str]], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory() as work:
        wav = Path(work) / "recording.wav"
        for done, request in enumerate(requests, start=1):
            started = time.monotonic()
            try:
                engine.read(request["voice"], request["text"], wav)
                to_mp3(wav, out_dir / f"{request['id']}.mp3")
                results.append({"id": request["id"], "ok": True, "durationMs": duration_ms(wav)})
                seconds = time.monotonic() - started
                print(f"{done}/{len(requests)} {request['voice']} {seconds:.1f} s", flush=True)
            except Exception as error:  # noqa: BLE001 - one failing Word must not stop the others
                print(f"FAIL {request['id']} {request['voice']}: {error}", file=sys.stderr)
                results.append({"id": request["id"], "ok": False})
            # Listed after every request, so a run stopped at its time limit keeps what it made;
            # the rename makes a stop mid-write leave the previous list whole.
            listed = out_dir / "results.json.part"
            listed.write_text(json.dumps(results) + "\n", encoding="utf-8")
            os.replace(listed, out_dir / "results.json")


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
    # Line by line into the Recordings service's pipe, the engine's own RTF lines too.
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--requests", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path)
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
    if args.out_dir is None:
        parser.error("--out-dir is required unless --check")
    generate(engine, requests, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
