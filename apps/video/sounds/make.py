"""Synthesise every sound of the landing videos (SOUNDS.md).

Standard library only, seeded, so a run always writes the same files:
    python3 -I apps/video/sounds/make.py
"""

import math
import os
import random
import struct
import wave

RATE = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
TAU = 2 * math.pi


def silence(seconds):
    return [0.0] * int(seconds * RATE)


def mix(into, sound, at=0.0, gain=1.0):
    start = int(at * RATE)
    need = start + len(sound) - len(into)
    if need > 0:
        into.extend([0.0] * need)
    for i, v in enumerate(sound):
        into[start + i] += v * gain
    return into


def lowpass(signal, cutoff):
    """One-pole low-pass; `cutoff` is a number or a function of time."""
    out, y = [], 0.0
    for i, x in enumerate(signal):
        c = cutoff(i / RATE) if callable(cutoff) else cutoff
        a = 1 - math.exp(-TAU * c / RATE)
        y += a * (x - y)
        out.append(y)
    return out


def highpass(signal, cutoff):
    low = lowpass(signal, cutoff)
    return [x - l for x, l in zip(signal, low)]


def bandpass(signal, low, high):
    return lowpass(highpass(signal, low), high)


def noise(seconds, rng):
    return [rng.uniform(-1, 1) for _ in range(int(seconds * RATE))]


def envelope(signal, attack, decay):
    """A quick attack, then an exponential decay with time constant `decay`."""
    out = []
    for i, x in enumerate(signal):
        t = i / RATE
        e = t / attack if t < attack else math.exp(-(t - attack) / decay)
        out.append(x * e)
    return out


def tone(seconds, freq, shape="sine", phase=0.0):
    """An oscillator; `freq` is a number or a function of time."""
    out, p = [], phase
    for i in range(int(seconds * RATE)):
        f = freq(i / RATE) if callable(freq) else freq
        p = (p + f / RATE) % 1.0
        if shape == "sine":
            out.append(math.sin(TAU * p))
        elif shape == "saw":
            out.append(2 * p - 1)
        elif shape == "square":
            out.append(1.0 if p < 0.5 else -1.0)
        else:  # triangle
            out.append(4 * abs(p - 0.5) - 1)
    return out


def fade(signal, inn=0.003, out=0.01):
    n, a, b = len(signal), int(inn * RATE), int(out * RATE)
    return [
        x * min(1.0, i / a if a else 1.0, (n - i) / b if b else 1.0)
        for i, x in enumerate(signal)
    ]


def soft_clip(signal, drive):
    return [math.tanh(x * drive) / math.tanh(drive) for x in signal]


def write(name, signal, peak=0.89):
    top = max(abs(x) for x in signal) or 1.0
    frames = b"".join(
        struct.pack("<h", int(max(-1, min(1, x / top * peak)) * 32767)) for x in signal
    )
    with wave.open(os.path.join(HERE, name), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(frames)
    print(f"{name}: {len(signal) / RATE:.2f} s")


def pop():
    """A letter popping in: a short round blip that bends up."""
    body = tone(0.09, lambda t: 520 + 900 * min(1, t / 0.03), "sine")
    click = tone(0.09, 2600, "triangle")
    return fade(mix(envelope(body, 0.002, 0.025), envelope(click, 0.0005, 0.004), gain=0.15))


def knock(pitch, rng):
    """A thick letter tile landing on a table: a woody knock with a low thump.

    The clack (1–5 kHz) and the upper ring carry it on a phone speaker, which
    plays nothing of the thump.
    """
    wood = envelope(bandpass(noise(0.16, rng), 500 * pitch, 2400 * pitch), 0.001, 0.018)
    clack = envelope(bandpass(noise(0.16, rng), 1000 * pitch, 5000 * pitch), 0.0005, 0.007)
    ring = envelope(tone(0.16, 380 * pitch, "sine"), 0.001, 0.035)
    knob = envelope(tone(0.16, 1150 * pitch, "sine"), 0.0008, 0.014)
    thump = envelope(tone(0.16, lambda t: 140 * pitch - 60 * t, "sine"), 0.002, 0.05)
    out = mix(mix(wood, ring, gain=0.5), thump, gain=0.7)
    return fade(mix(mix(out, clack, gain=0.9), knob, gain=0.3))


def crack(rng):
    """Cracks running over stone tiles: a dry snap, then crackles."""
    out = silence(0.7)
    mix(out, envelope(bandpass(noise(0.2, rng), 900, 6000), 0.0005, 0.03), 0.0, 1.0)
    mix(out, envelope(tone(0.2, lambda t: 180 - 200 * t), 0.001, 0.06), 0.0, 0.6)
    at = 0.03
    while at < 0.6:
        size = rng.uniform(0.2, 0.7) * (1 - at / 0.7)
        mix(out, envelope(bandpass(noise(0.03, rng), 1500, 7000), 0.0003, 0.004), at, size)
        at += rng.uniform(0.008, 0.05)
    return fade(out, out=0.05)


def rubble(rng):
    """Grey letter tiles falling onto a heap: dull clacks over 1.2 s."""
    out = silence(1.4)
    for _ in range(26):
        at = rng.uniform(0, 1.15)
        pitch = rng.uniform(0.55, 0.85)
        mix(out, knock(pitch, rng), at, rng.uniform(0.25, 0.6))
    return fade(lowpass(out, 3000), out=0.1)


def whoosh(seconds, rng, rise=True):
    """Air swept past: noise whose band opens and closes."""
    n = noise(seconds, rng)
    peak = 0.6 if rise else 0.25

    def cutoff(t):
        x = t / seconds
        shape = math.sin(math.pi * min(1, x / peak / 2)) if x < peak else math.cos(
            math.pi / 2 * (x - peak) / (1 - peak)
        )
        return 300 + 4500 * max(0, shape)

    swept = highpass(lowpass(lowpass(n, cutoff), cutoff), 150)
    env = [
        v * (math.sin(math.pi * min(1, (i / RATE) / seconds / peak / 2)) if (i / RATE) / seconds < peak else math.cos(math.pi / 2 * ((i / RATE) / seconds - peak) / (1 - peak)))
        for i, v in enumerate(swept)
    ]
    return fade(env, 0.005, 0.03)


def horn():
    """Рупор's shout through the megaphone: a brassy blast, narrow like a loudhailer."""
    seconds = 0.9
    base = 233.0  # B♭3

    def f(mult):
        return lambda t: base * mult * (1 + 0.035 * min(1, t / 0.08) - 0.035) * (
            1 + 0.012 * math.sin(TAU * 6 * t) * min(1, t / 0.2)
        )

    voices = silence(seconds)
    for mult, gain in ((1, 1.0), (1.5, 0.6), (2, 0.45), (1.0045, 0.8)):
        mix(voices, tone(seconds, f(mult), "saw"), 0, gain)
    brass = soft_clip(bandpass(voices, 450, 3200), 2.0)
    brass = lowpass(lowpass(lowpass(brass, 2600), 3200), 4000)  # the clip's fizz off
    env = [
        v * (min(1, (i / RATE) / 0.025) * (1 if i / RATE < 0.55 else math.exp(-((i / RATE) - 0.55) / 0.12)))
        for i, v in enumerate(brass)
    ]
    return fade(env, out=0.05)


def chime():
    """«Тримай слово.»: two bright bell strikes, a fifth apart."""
    out = silence(2.2)
    for at, root in ((0.0, 784.0), (0.11, 1174.7)):
        bell = silence(2.0)
        for ratio, gain, decay in ((1, 1, 0.9), (2.01, 0.45, 0.5), (3.0, 0.2, 0.3), (4.17, 0.12, 0.18)):
            mix(bell, envelope(tone(2.0, root * ratio), 0.002, decay), 0, gain)
        mix(out, bell, at, 0.7)
    return fade(out, out=0.3)


def deflate(rng):
    """The proud boss going down: a rubbery squeal sliding down, air hissing."""
    seconds = 1.1
    squeal = tone(
        seconds,
        lambda t: (620 - 420 * t / seconds) * (1 + 0.08 * math.sin(TAU * 17 * t)),
        "square",
    )
    rubber = lowpass(lowpass(lowpass(squeal, 1400), 1800), 2400)
    hiss = lowpass(bandpass(noise(seconds, rng), 1500, 5000), 5000)
    out = mix([v * 0.7 for v in rubber], hiss, gain=0.1)
    env = [v * min(1, (i / RATE) / 0.02) * (1 - (i / RATE) / seconds) ** 0.6 for i, v in enumerate(out)]
    return fade(env, out=0.08)


def inflate(rng):
    """The boss swelling with pride: a rubbery tone creeping up, creaking as it stretches."""
    seconds = 4.6
    rise = lambda t: 200 + 200 * (t / seconds) ** 1.5
    body = tone(seconds, lambda t: rise(t) * (1 + 0.012 * math.sin(TAU * 5 * t)), "triangle")
    # The octave and the creaks carry it on a phone speaker.
    upper = lowpass(tone(seconds, lambda t: rise(t) * 2.0, "saw"), 1600)
    creak = envelope(bandpass(noise(0.05, rng), 900, 3200), 0.002, 0.012)
    out = mix([v * 0.6 for v in body], upper, gain=0.25)
    for k in range(9):
        mix(out, creak, 0.5 + k * 0.42 + rng.uniform(-0.05, 0.05), 0.35)
    out = out[: int(seconds * RATE)]
    swell = [v * (0.35 + 0.65 * (i / len(out))) for i, v in enumerate(out)]
    return fade(swell, inn=0.25, out=0.12)


def pad(seconds):
    """The sound bed: a slow, warm D minor 9 pad that breathes.

    A soft upper voice (D and A, no third) sits at 440–1200 Hz so the bed is
    still there on a phone speaker.
    """
    out = silence(seconds)
    notes = (73.42, 146.83, 174.61, 220.0, 261.63, 329.63)  # D2 D3 F3 A3 C4 E4
    for k, freq in enumerate(notes):
        for detune in (-0.004, 0.004):
            lfo = 0.5 + 0.5 * math.sin(k * 1.3)
            voice = tone(seconds, freq * (1 + detune), "saw", phase=lfo)
            mix(out, voice, 0, 0.35 if k == 0 else 0.22)
    warm = lowpass(
        lowpass(out, lambda t: 700 + 350 * math.sin(TAU * t / 8)),
        1400,
    )
    top = max(abs(v) for v in warm) or 1.0
    for k, freq in enumerate((440.0, 587.33, 880.0, 1174.66)):  # A4 D5 A5 D6
        for detune in (-0.003, 0.003):
            voice = tone(seconds, freq * (1 + detune), "triangle", phase=0.25 * k)
            swell = [
                v * (0.6 + 0.4 * math.sin(TAU * i / RATE / (6 + 2 * k) + k))
                for i, v in enumerate(voice)
            ]
            mix(warm, swell, 0, top * (0.11 if k < 2 else 0.05))
    breathe = [v * (0.8 + 0.2 * math.sin(TAU * i / RATE / 4)) for i, v in enumerate(warm)]
    # Every video starts on the pad, so it comes in fast; the loop point is past any video's end.
    return fade(breathe, 0.4, 1.5)


def beat(rng):
    """The rhythm slot until the owner's beat: 2 s = one bar at 120 BPM, loops seamlessly."""
    bar = silence(2.0)
    step = 0.125  # a sixteenth
    for i in range(16):
        at = i * step
        if i in (0, 6, 8):
            kick = envelope(tone(0.3, lambda t: 50 + 90 * math.exp(-t / 0.03)), 0.002, 0.11)
            mix(bar, soft_clip(kick, 1.6), at, 1.0)
            # The beater's click, 2–4 kHz: what is left of the kick on a phone speaker.
            click = envelope(bandpass(noise(0.05, rng), 2000, 4000), 0.0005, 0.008)
            knock_ = envelope(tone(0.05, lambda t: 300 + 500 * math.exp(-t / 0.006)), 0.0005, 0.012)
            mix(bar, mix(click, knock_, gain=0.5), at, 0.5)
        if i in (4, 12):
            snap = envelope(bandpass(noise(0.2, rng), 1200, 6000), 0.001, 0.05)
            body = envelope(tone(0.2, 190), 0.001, 0.04)
            mix(bar, mix(snap, body, gain=0.4), at, 0.55)
        if i % 2 == 1:
            hat = envelope(highpass(noise(0.05, rng), 7000), 0.0005, 0.012)
            mix(bar, hat, at, 0.45 if i % 4 == 3 else 0.35)
    # A bass under the kick: D, D, F, A. The low octave for speakers that have
    # it, the octave above, saturated, for the phones that don't.
    for at, freq in ((0.0, 73.42), (0.75, 73.42), (1.0, 87.31), (1.5, 110.0)):
        low = envelope(lowpass(tone(0.24, freq, "saw"), 400), 0.005, 0.12)
        mid = envelope(lowpass(tone(0.24, freq * 2, "saw"), 1800), 0.004, 0.1)
        mix(bar, low, at, 0.4)
        mix(bar, soft_clip(mid, 2.5), at, 0.4)
    del bar[int(2.0 * RATE):]  # tails past the bar would click at the loop point
    return bar


def pluck(freq, rng, seconds=1.4, bright=0.5):
    """A hammered dulcimer string (Karplus-Strong): the цимбали's own voice."""
    period = int(RATE / freq)
    buf = [rng.uniform(-1, 1) for _ in range(period)]
    buf = lowpass(buf, 2000 + 6000 * bright)
    out = []
    for i in range(int(seconds * RATE)):
        x = buf[i % period]
        nxt = buf[(i + 1) % period]
        buf[i % period] = 0.996 * 0.5 * (x + nxt)
        out.append(x)
    hammer = envelope(bandpass(noise(0.02, rng), 800, 5000), 0.0005, 0.004)
    return fade(mix(out, hammer, gain=0.4), out=0.2)


def miss(rng):
    """A wrong guess on the strings: two muffled, clashing plucks a semitone apart."""
    out = mix(pluck(155.6, rng, 0.6, 0.1), pluck(164.8, rng, 0.6, 0.1), 0.012, 0.9)
    return lowpass(fade(out, out=0.15), 1500)


def chord(rng):
    """The right stress: a bright open D arpeggio rolled on the strings.

    D A D E A, no third: it is neither major nor minor, so it sits cleanly on
    the D minor 9 pad and the bass's F.
    """
    out = silence(2.4)
    for k, freq in enumerate((293.66, 440.0, 587.33, 659.25, 880.0)):
        mix(out, pluck(freq, rng, 2.0, 0.8), k * 0.045, 0.7)
    return fade(out, out=0.4)


def flap(rng):
    """One flap of a split-flap board: a light plastic tick with its slap."""
    tick = envelope(bandpass(noise(0.03, rng), 2500, 9000), 0.0003, 0.0025)
    slap = envelope(bandpass(noise(0.03, rng), 600, 2500), 0.0005, 0.005)
    return fade(mix(tick, slap, 0.006, 0.6))


def stamp(rng):
    """A rubber stamp hitting paper on a table: a deep thud with a paper slap.

    The body at 350 Hz and the 1–5 kHz smack give it weight on a phone
    speaker, where the thud itself is gone.
    """
    thud = envelope(tone(0.35, lambda t: 70 + 80 * math.exp(-t / 0.02)), 0.001, 0.08)
    body = envelope(tone(0.35, lambda t: 350 + 120 * math.exp(-t / 0.015)), 0.001, 0.045)
    paper = envelope(bandpass(noise(0.35, rng), 400, 3500), 0.0005, 0.02)
    smack = envelope(bandpass(noise(0.35, rng), 1000, 5000), 0.0005, 0.05)
    out = mix(mix(mix(thud, paper, gain=0.5), body, gain=0.5), smack, gain=0.6)
    return fade(soft_clip(out, 1.5), out=0.05)


def main():
    rng = random.Random(1108)
    write("pop.wav", pop())
    for i, pitch in enumerate((1.0, 1.12, 0.9), start=1):
        write(f"knock-{i}.wav", knock(pitch, rng))
    write("crack.wav", crack(rng))
    write("rubble.wav", rubble(rng))
    write("whoosh.wav", whoosh(0.45, rng))
    write("swish.wav", whoosh(0.28, rng, rise=False))
    write("horn.wav", horn())
    write("chime.wav", chime())
    write("deflate.wav", deflate(rng))
    write("pad.wav", pad(30.0), peak=0.7)
    write("beat.wav", beat(rng), peak=0.8)
    write("miss.wav", miss(rng))
    write("chord.wav", chord(rng))
    write("flap.wav", flap(rng))
    write("stamp.wav", stamp(rng))
    # New sounds go last, so the ones above keep their random numbers.
    write("pluck.wav", pluck(587.33, rng, 0.7, 0.7))
    write("inflate.wav", inflate(rng))


if __name__ == "__main__":
    main()
