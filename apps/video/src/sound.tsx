import { Audio, interpolate, Sequence, useVideoConfig } from 'remotion';

import beat from '../sounds/beat.wav';
import chime from '../sounds/chime.wav';
import chord from '../sounds/chord.wav';
import crack from '../sounds/crack.wav';
import deflate from '../sounds/deflate.wav';
import flap from '../sounds/flap.wav';
import horn from '../sounds/horn.wav';
import inflate from '../sounds/inflate.wav';
import knock1 from '../sounds/knock-1.wav';
import knock2 from '../sounds/knock-2.wav';
import knock3 from '../sounds/knock-3.wav';
import miss from '../sounds/miss.wav';
import pad from '../sounds/pad.wav';
import pluck from '../sounds/pluck.wav';
import pop from '../sounds/pop.wav';
import rubble from '../sounds/rubble.wav';
import stamp from '../sounds/stamp.wav';
import swish from '../sounds/swish.wav';
import whoosh from '../sounds/whoosh.wav';

/**
 * The videos' own sounds, synthesised by sounds/make.py (SOUNDS.md), not
 * the app's. Fonts still come from the Edition's assets (remotion.config.ts).
 */
export const sfx = {
  chime,
  chord,
  crack,
  deflate,
  flap,
  horn,
  inflate,
  miss,
  pluck,
  pop,
  rubble,
  stamp,
  swish,
  whoosh,
} as const;

const knocks = [knock1, knock2, knock3] as const;

/** A sound effect starting on frame `at`. */
export function Sfx({ src, at, volume = 1 }: { src: string; at: number; volume?: number }) {
  return (
    <Sequence from={at} name="Sound" layout="none">
      <Audio src={src} volume={volume} />
    </Sequence>
  );
}

/** A tile landing on frame `at`; the three knocks take turns so a row doesn't drone. */
export function Knock({ at, index, volume = 0.8 }: { at: number; index: number; volume?: number }) {
  return <Sfx src={knocks[index % knocks.length] ?? knock1} at={at} volume={volume} />;
}

/**
 * The mix, in one place (the sound designer's levels). The final loudness
 * (−14 LUFS, −1 dBTP) is a separate ffmpeg pass over the render, not done here.
 */
export const levels = {
  pad: 0.5,
  beat: 0.65,
  /** Рупор's shout: the same in every video. */
  horn: 0.4,
  /** The end card: the swish in, the chime on «Тримай слово.», the pop on the store badge. */
  endSwish: 0.45,
  endChime: 0.55,
  endPop: 0.5,
  /** The Stress mark landing on its vowel: one plucked string, the same in every video. */
  stress: 0.5,
  /** A recorded word, once there is one (see `Voice`). */
  voice: 1,
} as const;

/** How long horn.wav sounds, in frames at 30 fps: what follows the shout should land after it. */
export const hornLength = 27;

/** Рупор's shout on frame `at`, at the level every video uses. */
export function Horn({ at, volume = levels.horn }: { at: number; volume?: number }) {
  return <Sfx src={sfx.horn} at={at} volume={volume} />;
}

/**
 * The slot for the voice: «Рупор вимовляє слово». Nothing is recorded yet,
 * so a video passes no `src` and this plays nothing. Once a recording exists,
 * put it in sounds/voice/<lemma>.wav, import it in the video and pass it
 * here with the frame the word should be heard on: right after the shout
 * (about `hornLength` frames after `Horn`), under the tiles landing.
 */
export function Voice({ src, at, volume = levels.voice }: { src?: string; at: number; volume?: number }) {
  if (src === undefined) return null;
  return (
    <Sequence from={at} name="Voice" layout="none">
      <Audio src={src} volume={volume} />
    </Sequence>
  );
}

/**
 * The bed under a whole video: a warm pad throughout and, from `beatFrom`,
 * a one-bar 120 BPM loop. The loop is the slot for the owner's beat: replace
 * sounds/beat.wav (or this import) with the track and every video takes it.
 * The pad fades in and out; the beat comes in at full level, so its first
 * downbeat lands under the shout, and only fades out.
 */
export function Bed({ beatFrom, volume = 1 }: { beatFrom: number; volume?: number }) {
  const { durationInFrames, fps } = useVideoConfig();
  const fadeOut = (frame: number, start: number) =>
    interpolate(frame, [durationInFrames - start - fps, durationInFrames - start], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const fadeIn = (frame: number) => interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <>
      <Audio src={pad} loop volume={(f) => fadeIn(f) * fadeOut(f, 0) * levels.pad * volume} name="Bed: pad" />
      <Sequence from={beatFrom} name="Bed: beat" layout="none">
        <Audio src={beat} loop volume={(f) => fadeOut(f, beatFrom) * levels.beat * volume} />
      </Sequence>
    </>
  );
}
