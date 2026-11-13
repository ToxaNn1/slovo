import type { CSSProperties } from 'react';
import { AbsoluteFill, Easing, interpolate, interpolateColors, random, Sequence, useCurrentFrame } from 'remotion';

import word from '../../../../editions/uk/content/words/w_00g2ap.json';
import w02 from '../../../../editions/uk/content/words/w_0wpdmz.json';
import w03 from '../../../../editions/uk/content/words/w_1kz86u.json';
import w04 from '../../../../editions/uk/content/words/w_2xoekh.json';
import w05 from '../../../../editions/uk/content/words/w_6j81py.json';
import w06 from '../../../../editions/uk/content/words/w_7vjavt.json';
import w07 from '../../../../editions/uk/content/words/w_9kbijt.json';
import w08 from '../../../../editions/uk/content/words/w_eypjwd.json';
import w09 from '../../../../editions/uk/content/words/w_jc3n25.json';
import w10 from '../../../../editions/uk/content/words/w_k30ezx.json';
import w11 from '../../../../editions/uk/content/words/w_ls5omp.json';
import w12 from '../../../../editions/uk/content/words/w_olmlqv.json';
import w13 from '../../../../editions/uk/content/words/w_oqxz04.json';
import w14 from '../../../../editions/uk/content/words/w_q517pa.json';
import w15 from '../../../../editions/uk/content/words/w_tl74ue.json';
import w16 from '../../../../editions/uk/content/words/w_ua5aqz.json';
import w17 from '../../../../editions/uk/content/words/w_v25i3l.json';
import w18 from '../../../../editions/uk/content/words/w_v8rapd.json';
import w19 from '../../../../editions/uk/content/words/w_wjgw3w.json';
import w20 from '../../../../editions/uk/content/words/w_x5jbf2.json';
import w01 from '../../../../editions/uk/content/words/w_wn96s9.json';
import { EndCardAt } from '../EndCard';
import { dark, light, uiFont, wordFont } from '../look';
import { useSafe } from '../safe';
import { Bed, Knock, levels, Sfx, sfx, Voice } from '../sound';
import { clamp, pop } from '../shared/motion';


/** The board's cells: as many as the word of the day has letters. */
const target = [...word.lemma.toUpperCase()];
const cells = target.length;
const stressed = word.stress[0] ?? 0;

/**
 * The definition as the video words it: the advert's own short line, not
 * the Entry's dictionary one (the app's Entry stays as it is).
 */
const definition = { portrait: 'Тонкі тріщинки\nна старих картинах.', landscape: 'Тонкі тріщинки на старих картинах.' };

/** The rare words the board flips through, none longer than the board. */
const pool = [w01, w02, w03, w04, w05, w06, w07, w08, w09, w10, w11, w12, w13, w14, w15, w16, w17, w18, w19, w20]
  .map((entry) => entry.lemma.toUpperCase())
  .filter((lemma) => lemma.length <= cells);

/** The words the board stops on for a moment, long enough to be read. */
const stops = ['ГОРИЦВІТ', 'ДОСВІТКИ'].filter((lemma) => pool.includes(lemma));

/** The beats of «Слово дня» in frames at 30 fps, 15 s in all. */
const beats = {
  /** The caption pops in. */
  caption: 4,
  /** The board starts flipping: three seconds of it, with two short stops. */
  flips: 8,
  /** Frames between two fast flips, and how long the board rests on a stop. */
  flipStep: 3,
  stop: 14,
  /** The fast flips end and the bed's beat starts; from here every flip settles one more cell. */
  settle: 98,
  /** Frames between two settling flips: an eighth of the 120 BPM beat. */
  settleStep: 7.5,
  /** The «СЛОВО ДНЯ» stamp lands: six beats after the settling starts. */
  stamp: 188,
  /** The definition types in. */
  define: 198,
  /** The end card: five seconds of it. */
  end: 300,
  length: 450,
} as const;

/** The frame cell i shows its letter of the word of the day for good. */
const settleAt = (i: number) => beats.settle + Math.round((i + 1) * beats.settleStep);

/** The Stress mark starts to fall once the board has settled, and lands on its cell. */
const stressFalls = settleAt(cells - 1) + 4;
const stressLands = stressFalls + 8;

/**
 * The board's flips: the frame and, for a stop, the word it rests on. Eight
 * fast flips, a stop, six more, a stop, four slowing down, then one flip per
 * settling cell.
 */
const flips: readonly { at: number; stop?: string }[] = (() => {
  const list: { at: number; stop?: string }[] = [];
  let at: number = beats.flips;
  const run = (count: number, step: (k: number) => number) => {
    for (let k = 0; k < count; k++) {
      list.push({ at });
      at += step(k);
    }
  };
  const rest = (lemma: string | undefined) => {
    if (lemma === undefined) return;
    list.push({ at, stop: lemma });
    at += beats.stop;
  };
  run(8, () => beats.flipStep);
  rest(stops[0]);
  run(6, () => beats.flipStep);
  rest(stops[1]);
  run(4, (k) => beats.flipStep + 1 + k);
  for (let i = 0; i < cells; i++) list.push({ at: settleAt(i) });
  return list;
})();

/** The word shown after each flip: never the same twice running, a stop's word only on its stop. */
const shown: readonly string[] = (() => {
  const others = pool.filter((lemma) => !stops.includes(lemma));
  const words: string[] = [];
  let last = -1;
  flips.forEach((flip, n) => {
    if (flip.stop !== undefined) {
      words.push(flip.stop);
      return;
    }
    const pick = (last + 1 + Math.floor(random(`board-${n}`) * (others.length - 1))) % others.length;
    words.push(others[pick] ?? '');
    last = pick;
  });
  return words;
})();

/** The letter cell i shows after flip n (a blank before the first flip and past a short word's end). */
const letterAt = (i: number, n: number) => {
  if (n >= 0 && (flips[n]?.at ?? 0) >= settleAt(i)) return target[i] ?? '';
  return n < 0 ? '' : ([...(shown[n] ?? '')][i] ?? '');
};

/**
 * «Слово дня»: one 15 s video for 16:9 and 9:16. «Мова багатша, ніж ти
 * думаєш.», a split-flap board flips through rare words, resting on two of
 * them, settles left to right on КРАКЕЛЮР, turns red with its stressed
 * letter in ink, the Stress mark falls, the «СЛОВО ДНЯ» stamp lands, the
 * definition, the shared end card.
 */
export function Board() {
  const typed = definition.landscape.length;
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={beats.end} name="Board">
        <Scene />
      </Sequence>
      <EndCardAt from={beats.end} line="Мова багатша, ніж ти думаєш." />
      <Bed beatFrom={beats.settle} />
      <Sfx src={sfx.pop} at={beats.caption} volume={0.5} />
      {flips.map(({ at, stop }, n) => (
        // No two flaps alike in level, so a fast run doesn't drone; a stop lands a little harder.
        <Sfx key={at} src={sfx.flap} at={at} volume={stop === undefined ? 0.25 + random(`flap-${n}`) * 0.15 : 0.5} />
      ))}
      {target.map((_, i) => (
        <Knock key={i} index={i} at={settleAt(i)} volume={1} />
      ))}
      {/* «Рупор вимовляє слово»: the word of the day said aloud as the board settles. Nothing is recorded yet (SOUNDS.md). */}
      <Voice at={settleAt(cells - 1) + 2} />
      <Sfx src={sfx.pluck} at={stressLands} volume={levels.stress} />
      <Sfx src={sfx.stamp} at={beats.stamp} volume={1} />
      {/* Quiet ticks under the definition typing in. */}
      {Array.from({ length: Math.ceil(typed / 8) }, (_, k) => (
        <Sfx key={k} src={sfx.flap} at={beats.define + k * 4} volume={0.16} />
      ))}
    </AbsoluteFill>
  );
}

/** The caption, the board, the stamp and the definition. */
function Scene() {
  const frame = useCurrentFrame();
  const { width, height, portrait, s, safe } = useSafe();
  // Portrait: the board is as wide as a row may be and stands in the safe zone's middle.
  const gap = portrait ? 0.06 : 0.1;
  const padding = portrait ? 0.12 : 0.18;
  const boardWidth = portrait ? safe.rowWidth : width * 0.8;
  const size = boardWidth / (cells + (cells - 1) * gap + padding * 2);
  const cellHeight = size * (portrait ? 1.4 : 1.3);
  const pad = size * padding;
  const boardHeight = cellHeight + pad * 2;
  const boardLeft = (portrait ? safe.centerX : width / 2) - boardWidth / 2;
  const boardTop = portrait ? safe.centerY - 20 * s : height * 0.4;
  const caption = interpolate(frame, [beats.caption, beats.caption + 10], [0, 1], { ...clamp, easing: pop });
  const stamp = interpolate(frame, [beats.stamp - 6, beats.stamp], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  // The flip shown now: the last one at or before this frame.
  const n = flips.filter(({ at }) => at <= frame).length - 1;
  const text = portrait ? definition.portrait : definition.landscape;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: portrait ? safe.left : width * 0.04,
          width: portrait ? safe.width : width * 0.92,
          top: portrait ? safe.top + 110 * s : height * 0.08,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: (portrait ? 76 : 84) * s,
          lineHeight: 1.12,
          letterSpacing: '-0.02em',
          color: light.ink,
          rotate: '-2deg',
          scale: String(caption),
        }}
      >
        {portrait ? 'Мова багатша,\nніж ти думаєш.' : 'Мова багатша, ніж ти думаєш.'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: boardLeft,
          top: boardTop,
          width: boardWidth,
          height: boardHeight,
          padding: pad,
          borderRadius: size * 0.2,
          // The panel melts into the page once the board settles, so the ink tile reads on cream.
          background: interpolateColors(frame, [settleAt(stressed), settleAt(stressed) + 8], [light.ink, light.background]),
          display: 'flex',
          gap: size * gap,
        }}
      >
        {target.map((_, i) => (
          <Cell key={i} index={i} n={n} frame={frame} width={size} height={cellHeight} />
        ))}
        {/* The stamp stands above the first cells, clear of them; in portrait it stays right of the board's left edge, inside the safe zone. */}
        <div
          style={{
            position: 'absolute',
            left: portrait ? size * 0.12 : -size * 0.3,
            top: -size * (portrait ? 1.08 : 0.92),
            padding: `${size * 0.1}px ${size * 0.24}px`,
            border: `${size * 0.06}px solid ${light.ink}`,
            borderRadius: size * 0.1,
            background: light.background,
            fontFamily: wordFont,
            fontWeight: 900,
            fontSize: size * (portrait ? 0.4 : 0.34),
            lineHeight: 1.2,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            color: light.ink,
            rotate: '-9deg',
            scale: String(2.4 - stamp * 1.4),
            transformOrigin: portrait ? '30% 50%' : '50% 50%',
            opacity: stamp,
          }}
        >
          СЛОВО ДНЯ
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: portrait ? safe.left : width * 0.1,
          width: portrait ? safe.width : width * 0.8,
          top: boardTop + boardHeight + 70 * s,
          whiteSpace: 'pre-line',
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: (portrait ? 62 : 58) * s,
          lineHeight: 1.25,
          color: light.ink,
          textAlign: 'center',
        }}
      >
        {text.slice(0, Math.max(0, (frame - beats.define) * 2))}
      </div>
    </AbsoluteFill>
  );
}

/**
 * One split-flap cell: on a flip the top half of the old letter folds down
 * and the bottom half of the new one unfolds over it. A settled cell is red,
 * the stressed one ink, as the word card draws them.
 */
function Cell({ index, n, frame, width, height }: { index: number; n: number; frame: number; width: number; height: number }) {
  const now = letterAt(index, n);
  const before = letterAt(index, n - 1);
  const at = flips[n]?.at ?? 0;
  const span = Math.min(4, (flips[n + 1]?.at ?? Infinity) - at);
  const p = n < 0 || now === before ? 1 : interpolate(frame, [at, at + span], [0, 1], clamp);
  const settled = frame >= settleAt(index);
  const isStressed = settled && index === stressed;
  const face = isStressed ? light.ink : settled ? light.accent : dark.tile;
  const edge = isStressed ? dark.background : settled ? light.accentEdge : dark.tileEdge;
  const ink = settled ? light.background : dark.ink;
  const half = (letter: string, part: 'top' | 'bottom', style?: CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: height / 2,
        top: part === 'top' ? 0 : height / 2,
        overflow: 'hidden',
        background: face,
        borderRadius: part === 'top' ? `${width * 0.12}px ${width * 0.12}px 0 0` : `0 0 ${width * 0.12}px ${width * 0.12}px`,
        backfaceVisibility: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height,
          marginTop: part === 'top' ? 0 : -height / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: width * 0.62,
          lineHeight: 1,
          color: ink,
        }}
      >
        {letter}
      </div>
    </div>
  );
  const land = interpolate(frame, [settleAt(index), settleAt(index) + 6], [0.9, 1], { ...clamp, easing: pop });
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        perspective: width * 6,
        borderRadius: width * 0.12,
        boxShadow: `0 ${width * 0.06}px 0 ${edge}`,
        scale: String(settled ? land : 1),
      }}
    >
      {half(now, 'top')}
      {half(p < 1 ? before : now, 'bottom')}
      {p < 0.5 && half(before, 'top', { rotate: `x ${-p * 180}deg`, transformOrigin: 'center bottom' })}
      {p >= 0.5 && p < 1 && half(now, 'bottom', { rotate: `x ${(1 - p) * 180}deg`, transformOrigin: 'center top' })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height / 2 - width * 0.012,
          height: width * 0.024,
          background: light.ink,
          opacity: 0.6,
        }}
      />
      {isStressed && <Acute size={width} frame={frame} />}
    </div>
  );
}

/** The Stress mark falling onto the stressed cell once the board has settled; the pluck sounds as it lands. */
function Acute({ size, frame }: { size: number; frame: number }) {
  const t = interpolate(frame, [stressFalls, stressLands], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const squash = interpolate(frame, [stressLands, stressLands + 2, stressLands + 7], [1, 0.8, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: size * 0.4,
        top: -size * 0.74,
        width: size * 0.19,
        height: size * 0.56,
        borderRadius: size * 0.095,
        background: light.accent,
        rotate: '35deg',
        translate: `0px ${(1 - t) * -size * 1.4}px`,
        scale: `1 ${squash}`,
        transformOrigin: 'center bottom',
        opacity: Math.min(1, t * 3),
      }}
    />
  );
}

export const boardLength = beats.length;
