import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  Sequence,
  useCurrentFrame,
} from 'remotion';

import { EndCardAt } from '../EndCard';
import { dark, light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { tileSizeFor, useSafe } from '../safe';
import { Bed, Horn, Knock, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { clamp, pop } from '../shared/motion';
import { word as snapshotWord } from '../words';

const word = snapshotWord('w_lu00tl');

/** The beats of «Де наголос?» in frames at 30 fps, 15 s in all. */
const beats = {
  /** «Де наголос?» pops in. */
  ask: 4,
  /** The Stress mark appears over the word and waits. */
  markIn: 54,
  /** «Твій варіант?»: a second for the viewer's own guess before the first hit. */
  guess: 58,
  /** The mark hits the wrong vowels. */
  misses: [100, 130],
  /** Рупор bursts in from the left. */
  ruporIn: 150,
  /** Рупор shouts. The bed's beat starts here. */
  shout: 165,
  /** The mark slams onto the stressed vowel: two beats after the shout, clear of the horn. */
  slam: 195,
  /** The answer: «цимба́ли», then «не ци́мбали», then the meaning. */
  answer: 203,
  wrong: 211,
  define: 221,
  /** The end card: 4.6 s of it. */
  end: 312,
  length: 450,
} as const;

/** The tile the mark hits at each miss, then the stressed one. */
const missed = [1, 6] as const;
const stressed = word.stress[0] ?? 0;
const lemma = word.lemma;

/**
 * The texts as the video words them: the wrong Stress people say, and the
 * advert's own short meaning, not the Entry's dictionary one.
 */
const wrongStress = missed[0];
const meaning = 'Струнний інструмент,\nна якому грають молоточками.';

/** The frame the i-th tile lands on. */
const landAt = (i: number) => 20 + i * 5;

/**
 * The mark's path over the row: frames, then the tile it is over (fractional
 * between tiles) and its lift above a tile's top in tile sizes (0 touches).
 */
const path = {
  frames: [54, 88, 94, 100, 107, 114, 122, 130, 137, 146, 170, 186, 191, 195, 201],
  over: [3, 3, 2, 1, 1, 2.2, 4.6, 6, 6, 5.4, 4.7, 4.3, 4, 4, 4],
  lift: [-0.8, -0.8, -0.85, 0, -0.6, -0.8, -0.85, 0, -0.6, -0.8, -0.8, -0.8, -0.85, 0.04, -0.1],
};

/**
 * «Де наголос?»: one 15 s 9:16 video. ЦИМБАЛИ lands in red tiles; the big
 * Stress mark waits a second over them («Твій варіант?»), hops like a
 * dulcimer hammer, hits И twice and misses, Рупор shouts, the mark slams
 * onto А; «цимба́ли», «не ци́мбали» and the meaning; the shared end card.
 * Everything stays in the 9:16 safe zone, Рупор in his band under the text.
 */
export function Stress() {
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={beats.end} name="Where is the Stress">
        <Row />
        <Sequence from={beats.ruporIn} name="Рупор shouts">
          <Shouter />
        </Sequence>
      </Sequence>
      <EndCardAt from={beats.end} line="А як кажеш ти?" />
      <Bed beatFrom={beats.shout} />
      <Sfx src={sfx.pop} at={beats.ask} volume={0.5} />
      {[...lemma].map((_, i) => (
        <Knock key={i} index={i} at={landAt(i)} />
      ))}
      <Sfx src={sfx.pop} at={beats.guess} volume={0.35} />
      {beats.misses.map((at) => (
        <Sfx key={at} src={sfx.miss} at={at} volume={0.45} />
      ))}
      <Sfx src={sfx.whoosh} at={beats.ruporIn - 2} volume={0.55} />
      <Horn at={beats.shout} />
      {/* The right Stress: louder than a miss, and after the horn has rung out. */}
      <Sfx src={sfx.chord} at={beats.slam} volume={0.8} />
      {/* «Рупор вимовляє слово»: «цимба́ли» said aloud right after the chord's attack, as the answer appears. Nothing is recorded yet (SOUNDS.md). */}
      <Voice at={beats.slam + 12} />
    </AbsoluteFill>
  );
}

/** The question, the word in tiles, the hopping mark, the guess prompt and the answer. */
function Row() {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const letters = [...lemma.toUpperCase()];
  const gap = 0.08;
  // A little narrower than a row may be: the leaning mark over the last tile stays in the safe zone too.
  const size = tileSizeFor(letters.length, safe.rowWidth - 20 * s, gap);
  const step = size * (1 + gap);
  const total = letters.length * size + (letters.length - 1) * size * gap;
  const top = safe.top + 380 * s;
  const under = top + size + 36 * s;
  const ask = interpolate(frame, [beats.ask, beats.ask + 10], [0, 1], { ...clamp, easing: pop });
  const guess =
    interpolate(frame, [beats.guess, beats.guess + 10], [0, 1], { ...clamp, easing: pop }) *
    interpolate(frame, [beats.shout, beats.shout + 6], [1, 0], clamp);
  const answer = interpolate(frame, [beats.answer, beats.answer + 10], [0, 1], {
    ...clamp,
    easing: pop,
  });
  const wrong = interpolate(frame, [beats.wrong, beats.wrong + 8], [0, 1], clamp);
  const define = interpolate(frame, [beats.define, beats.define + 10], [0, 1], clamp);
  const column = {
    position: 'absolute',
    left: safe.left,
    width: safe.width,
    textAlign: 'center',
  } as const;
  return (
    <AbsoluteFill>
      <div
        style={{
          ...column,
          top: safe.top + 20 * s,
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: 100 * s,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: light.ink,
          rotate: '-3deg',
          scale: String(ask),
        }}
      >
        Де наголос?
      </div>
      <div
        style={{
          position: 'absolute',
          left: safe.centerX - total / 2,
          top,
          display: 'flex',
          gap: size * gap,
        }}
      >
        {letters.map((letter, i) => (
          <LetterTile key={i} letter={letter} index={i} size={size} frame={frame} />
        ))}
        <Mark size={size} step={step} frame={frame} />
      </div>
      <div
        style={{
          ...column,
          top: under + 14 * s,
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 68 * s,
          lineHeight: 1.2,
          color: light.ink,
          scale: String(guess),
          opacity: guess > 0 ? 1 : 0,
        }}
      >
        Твій варіант?
      </div>
      <div
        style={{
          ...column,
          top: under,
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: 104 * s,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: light.ink,
          scale: String(answer),
          opacity: answer > 0 ? 1 : 0,
        }}
      >
        <Accented text={lemma} at={stressed} color={light.accent} />
      </div>
      <div
        style={{
          ...column,
          top: under + 104 * 1.15 * s + 10 * s,
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 58 * s,
          lineHeight: 1.2,
          color: light.muted,
          opacity: wrong,
          translate: `0px ${(1 - wrong) * 16 * s}px`,
        }}
      >
        не <Accented text={lemma} at={wrongStress} color={light.muted} />
      </div>
      <div
        style={{
          ...column,
          left: safe.left + 30 * s,
          width: safe.width - 60 * s,
          top: under + 104 * 1.15 * s + 10 * s + 58 * 1.2 * s + 20 * s,
          whiteSpace: 'pre-line',
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 46 * s,
          lineHeight: 1.22,
          color: light.ink,
          opacity: define,
          translate: `0px ${(1 - define) * 16 * s}px`,
        }}
      >
        {meaning}
      </div>
    </AbsoluteFill>
  );
}

/**
 * A word with the Stress mark drawn over its letter `at`: the mark is ours,
 * not a combining acute, so it looks the same in both fonts.
 */
function Accented({ text, at, color }: { text: string; at: number; color: string }) {
  const letters = [...text];
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {letters.slice(0, at).join('')}
      <span style={{ position: 'relative', display: 'inline-block', color }}>
        {letters[at]}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '-0.06em',
            width: '0.1em',
            height: '0.3em',
            marginLeft: '-0.02em',
            borderRadius: '0.05em',
            background: color,
            rotate: '35deg',
          }}
        />
      </span>
      {letters.slice(at + 1).join('')}
    </span>
  );
}

/** One tile: it lands, shakes and greys when the mark misses on it, turns ink when the mark hits it. */
function LetterTile({
  letter,
  index,
  size,
  frame,
}: {
  letter: string;
  index: number;
  size: number;
  frame: number;
}) {
  const { s } = useSafe();
  const land = interpolate(frame, [landAt(index) - 8, landAt(index)], [0, 1], {
    ...clamp,
    easing: pop,
  });
  const missAt = beats.misses[missed.findIndex((tile) => tile === index)];
  const shakeFor = (since: number) =>
    since >= 0 && since < 14 ? Math.sin(since * 2.5) * 12 * s * (1 - since / 14) : 0;
  let face = light.accent;
  let edge = light.accentEdge;
  let shake = 0;
  let squash = 1;
  if (missAt !== undefined) {
    const grey = interpolate(
      frame,
      [missAt, missAt + 3, missAt + 14, missAt + 22],
      [0, 1, 1, 0],
      clamp,
    );
    face = interpolateColors(grey, [0, 1], [light.accent, light.muted]);
    edge = interpolateColors(grey, [0, 1], [light.accentEdge, light.ink]);
    shake = shakeFor(frame - missAt);
    squash = interpolate(frame, [missAt, missAt + 2, missAt + 7], [1, 0.92, 1], clamp);
  }
  if (index === stressed && frame >= beats.slam) {
    face = light.ink;
    edge = dark.background;
    squash = interpolate(frame, [beats.slam, beats.slam + 3, beats.slam + 10], [1, 0.82, 1], clamp);
  }
  return (
    <div
      style={{
        translate: `${shake}px ${(1 - land) * -500 * s}px`,
        opacity: land > 0 ? 1 : 0,
        scale: `1 ${squash}`,
        transformOrigin: 'center bottom',
      }}
    >
      <Tile letter={letter} size={size} face={face} edge={edge} ink={light.background} />
    </div>
  );
}

/**
 * The red Stress mark with an ink outline, big enough to follow on a phone:
 * it hops along `path` like a dulcimer hammer and rests over the stressed tile.
 */
function Mark({ size, step, frame }: { size: number; step: number; frame: number }) {
  const over = interpolate(frame, path.frames, path.over, {
    ...clamp,
    easing: Easing.inOut(Easing.sin),
  });
  const lift = interpolate(frame, path.frames, path.lift, {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const hovering = frame < 88 || (frame > 146 && frame < 186);
  const bob = hovering ? Math.sin(frame / 5) * 0.05 : 0;
  const swing = hovering ? Math.sin(frame / 6) * 10 : 0;
  const appear = interpolate(frame, [beats.markIn, beats.markIn + 8], [0, 1], {
    ...clamp,
    easing: pop,
  });
  const markWidth = size * 0.38;
  const markHeight = size * 1.08;
  return (
    <div
      style={{
        position: 'absolute',
        // The mark leans right, so its foot is left of its middle: shift it so the foot lands on the tile's middle.
        left: over * step + size / 2 - markWidth / 2 + markHeight * 0.12,
        top: -markHeight - size * 0.04 + (lift + bob) * size,
        width: markWidth,
        height: markHeight,
        boxSizing: 'border-box',
        borderRadius: markWidth / 2,
        background: light.accent,
        border: `${size * 0.055}px solid ${light.ink}`,
        rotate: `${35 + swing}deg`,
        scale: String(appear),
        opacity: appear > 0 ? 1 : 0,
      }}
    />
  );
}

/** Рупор bursts into his band, shouts up at the word, then is glad under the answer. */
function Shouter() {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const shoutAt = beats.shout - beats.ruporIn;
  const enter = interpolate(frame, [0, shoutAt], [-700 * s, 0], { ...clamp, easing: pop });
  const shake = frame > shoutAt && frame < shoutAt + 24 ? Math.sin(frame * 2.2) * 8 * s : 0;
  const calm = frame >= beats.answer - beats.ruporIn;
  const ruporWidth = 360 * s;
  const ruporHeight = (ruporWidth * 112) / 150;
  const left = safe.left + 20 * s;
  const top = safe.rupor.bottom - ruporHeight - 6 * s;
  const mouth = { x: left + ruporWidth * 0.95, y: top + ruporWidth * 0.2 };
  return (
    <AbsoluteFill>
      {[0, 1, 2].map((ring) => {
        const t = interpolate(frame, [shoutAt + ring * 6, shoutAt + 30 + ring * 6], [0, 1], clamp);
        return (
          <div
            key={ring}
            style={{
              position: 'absolute',
              left: mouth.x - 60 * s,
              top: mouth.y - 60 * s,
              width: 120 * s,
              height: 120 * s,
              borderRadius: '50%',
              border: `${10 * s}px solid ${light.accent}`,
              scale: String(1 + t * 8),
              opacity: t === 0 ? 0 : 1 - t,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left,
          top,
          translate: `${enter + shake}px 0px`,
          rotate: calm ? `${-4 + Math.sin(frame / 8) * 3}deg` : '-14deg',
        }}
      >
        <Rupor state={calm ? 'happy' : 'shouts'} width={ruporWidth} />
      </div>
    </AbsoluteFill>
  );
}

export const stressLength = beats.length;
