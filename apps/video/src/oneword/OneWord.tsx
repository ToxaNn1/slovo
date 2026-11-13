import { AbsoluteFill, Easing, interpolate, interpolateColors, Sequence, useCurrentFrame } from 'remotion';

import { EndCardAt, endCardFrom } from '../EndCard';
import { light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { type Safe, tileSizeFor, useSafe } from '../safe';
import { Bed, Horn, Knock, levels, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { clamp, pop } from '../shared/motion';
import { Rings } from '../shared/Rings';

const blackEdge = 'rgba(20, 12, 10, 0.28)';
const acute = '́';

/** One episode of «Одним словом»: a long description and the one word that says it. */
export type Episode = {
  /** The word with its Stress marked by U+0301 after the stressed vowel. */
  word: string;
  /** The description, one word per row of black tiles: three to five words, nine letters each at most. */
  description: readonly string[];
  /** A line someone could really say, with the word in or near its first form; one string per line, two at most. */
  example: readonly string[];
  /** The letters given away before the shout, counted from 0; by default the first and the last. */
  hints?: readonly number[];
  /** The recording of the word, once there is one (SOUNDS.md). */
  voice?: string;
};

/**
 * The episodes. Each word is an Entry of the app (editions/uk/content/words)
 * and the description is its definition there, shortened, not bent: the video
 * and the app must say the same.
 */
export const episodes: readonly Episode[] = [
  {
    // w_olmlqv «мжичка», stress [2]: «…дрібний, густий дощ…»; СУМ-11: «Дуже дрібний густий дощ».
    word: 'мжи́чка',
    description: ['Дуже', 'дрібний', 'густий', 'дощ'],
    example: ['Надворі мжичка.', 'Парасольку бери.'],
  },
  {
    // w_q8ot2t «легіт», stress [1]: «Легкий приємний вітерець.»
    word: 'ле́гіт',
    description: ['Легкий', 'приємний', 'вітерець'],
    example: ['З річки повіяв', 'легіт.'],
  },
  {
    // w_bcutlw «баюра», stress [2]: «Велика глибока калюжа.»
    word: 'баю́ра',
    description: ['Велика', 'глибока', 'калюжа'],
    example: ['Обережно,', 'там баюра.'],
  },
];

/** The texts every episode shares. */
export const texts = {
  brand: 'SLOVO',
  title: ['Скажи одним', 'словом'],
  ask: ['Знав(-ла)', 'це слово?'],
  // The no-break spaces keep the dash off the start of a line and «у» off the end of one.
  endLine: 'Такі слова — щодня у\u00A0застосунку SLOVO',
} as const;

/** «4 слова», «5 слів»: the description's length for the counter. */
const wordsOf = (count: number) => `${count} ${count >= 2 && count <= 4 ? 'слова' : count === 1 ? 'слово' : 'слів'}`;
/** «6 літер», «4 літери»: the word's length under the empty cells. */
const lettersOf = (count: number) => `${count} ${count >= 2 && count <= 4 ? 'літери' : count === 1 ? 'літера' : 'літер'}`;

/** The beats in frames at 30 fps, 15 s in all; the bed's beat falls on every 15th frame. */
export const beats = {
  /** The empty cells pulse: the viewer counts the letters. */
  pulses: [15, 30, 45],
  /** The given letters drop into their cells, one by one. */
  hints: [54, 90],
  /** Рупор leans back for air. */
  inhale: 111,
  /** Рупор shouts; the description shakes. */
  shout: 120,
  /** The black tiles leave their rows for the cells, a row after a row, and are all in by `flips`. */
  fly: 123,
  rowLag: 2,
  /** The cells turn over into the word, left to right. */
  flips: 141,
  flipStep: 3,
  /** The word is whole. */
  solved: 165,
  /** The word has grown and stands in the middle. */
  settled: 180,
  /** «4 слова → 1» is stamped where the description was. */
  counter: 171,
  /** The Stress mark lands on its vowel. */
  stress: 188,
  /** The example types in. */
  example: 184,
  exampleTyped: 208,
  /** «Знав(-ла) це слово?»: it stands for the last 2.5 s before the end card. */
  ask: 240,
  length: 450,
} as const;

const end = endCardFrom(beats.length);
export const oneWordLength = beats.length;

/** The frame cell `i` starts to turn over on; it shows its letter three frames later. */
const flipAt = (i: number) => beats.flips + i * beats.flipStep;

/** Where everything stands, in layout units (pixels of the 1080×1920 frame). */
const at = {
  brandTop: 250,
  titleTop: 312,
  /** The description's band, and after the shout the counter's and the word's. */
  description: { top: 524, bottom: 984 },
  cellsTop: 1040,
  cell: 120,
  counterTop: 534,
  wordTop: 742,
  exampleTop: 938,
  /** The question, right of Рупор in his band. */
  ask: { left: 396, top: 1200, bottom: 1392 },
} as const;

/** The letters of the word and the one that carries the Stress. */
function parseWord(word: string) {
  const letters: string[] = [];
  let stress = -1;
  for (const char of word.normalize('NFC')) {
    if (char === acute) stress = letters.length - 1;
    else letters.push(char.toUpperCase());
  }
  if (stress < 0) throw new Error(`«${word}» has no Stress mark`);
  return { letters, stress, lemma: letters.join('').toLowerCase() };
}

type Flying = { letter: string; left: number; top: number; row: number; cell: number };

/** The sizes and places of one episode's tiles inside the safe zone. */
function layoutFor(episode: Episode, safe: Safe, s: number) {
  const { letters, stress, lemma } = parseWord(episode.word);
  const rows = episode.description.map((word) => [...word.toUpperCase()]);
  const longest = Math.max(...rows.map((row) => row.length));
  if (rows.length < 3 || rows.length > 5 || longest > 9) {
    throw new Error(`«${episode.description.join(' ')}»: three to five words, nine letters each at most`);
  }

  // The description: one word per row, as big as the band's height and the safe row let it be.
  const gap = 0.1;
  const rowGap = 16 * s;
  const band = (at.description.bottom - at.description.top) * s;
  const tile = Math.min(104 * s, tileSizeFor(longest, safe.rowWidth, gap), (band - rowGap * (rows.length - 1)) / rows.length / 1.08);
  const rowStep = tile * 1.08 + rowGap;
  const blockTop = at.description.top * s + (band - (rowStep * rows.length - rowGap)) / 2;

  // The cells, and the word once it has grown.
  const cell = Math.min(at.cell * s, tileSizeFor(letters.length, safe.rowWidth, gap));
  const cellStep = cell * (1 + gap);
  const wordTile = tileSizeFor(letters.length, safe.rowWidth, gap, 140 * s);
  const wordStep = wordTile * (1 + gap);

  const total = rows.reduce((sum, row) => sum + row.length, 0);
  const flying: Flying[] = [];
  rows.forEach((row, r) =>
    row.forEach((letter, c) => {
      flying.push({
        letter,
        left: safe.left + c * tile * (1 + gap),
        top: blockTop + r * rowStep,
        row: r,
        cell: Math.min(letters.length - 1, Math.floor((flying.length / total) * letters.length)),
      });
    }),
  );

  const hints = episode.hints ?? [0, letters.length - 1];
  return { letters, stress, lemma, rows, tile, flying, cell, cellStep, wordTile, wordStep, hints };
}

export type OneWordProps = {
  /** Which of `episodes` to play, counted from 0. */
  episode?: number;
};

/**
 * «Одним словом»: one 15 s 9:16 video per episode. A long description in
 * black tiles and a row of empty cells stand from the first frame; two
 * letters are given; Рупор shouts the description into the cells and they
 * turn over into the one word; «4 слова → 1», a line to say it in,
 * «Знав(-ла) це слово?»; the end card.
 */
export function OneWord({ episode = 0 }: OneWordProps) {
  const item = episodes[episode] ?? episodes[0];
  if (item === undefined) return null;
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={end} name="In one word">
        <Scene episode={item} />
      </Sequence>
      <EndCardAt from={end} line={texts.endLine} />
      <OneWordSound episode={item} />
    </AbsoluteFill>
  );
}

/** The sounds: the bed and its beat from the first frame, the pulses, the hints, the shout, the flips, the voice. */
export function OneWordSound({ episode }: { episode: Episode }) {
  const { letters } = parseWord(episode.word);
  const ticks = Array.from({ length: Math.floor((beats.exampleTyped - beats.example) / 6) }, (_, i) => beats.example + i * 6);
  return (
    <>
      <Bed beatFrom={0} />
      <Sfx src={sfx.stamp} at={0} volume={0.7} />
      {beats.pulses.map((frame, i) => (
        <Knock key={frame} index={i} at={frame} volume={0.3} />
      ))}
      {beats.hints.map((frame) => (
        <Sfx key={frame} src={sfx.pop} at={frame + 6} volume={0.55} />
      ))}
      <Horn at={beats.shout} />
      <Sfx src={sfx.whoosh} at={beats.fly} volume={0.55} />
      {letters.map((_, i) => (
        <Sfx key={i} src={sfx.flap} at={flipAt(i) + 2} volume={0.6} />
      ))}
      <Sfx src={sfx.chime} at={beats.solved} volume={0.5} />
      {/* «Рупор вимовляє слово»: nothing is recorded yet (SOUNDS.md). */}
      <Voice src={episode.voice} at={beats.solved} />
      <Sfx src={sfx.stamp} at={beats.counter} volume={0.6} />
      <Sfx src={sfx.pluck} at={beats.stress} volume={levels.stress} />
      {ticks.map((frame) => (
        <Sfx key={frame} src={sfx.flap} at={frame} volume={0.2} />
      ))}
      <Sfx src={sfx.swish} at={beats.ask - 2} volume={0.4} />
    </>
  );
}

function Scene({ episode }: { episode: Episode }) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const layout = layoutFor(episode, safe, s);
  const count = layout.letters.length;

  // Рупор stands at the left of his band and aims the megaphone up at the description.
  const ruporWidth = 280 * s;
  const ruporHeight = (ruporWidth * 112) / 150;
  const rupor = { left: safe.left + 10 * s, top: safe.rupor.bottom - ruporHeight - 8 * s };
  const center = { x: rupor.left + ruporWidth / 2, y: rupor.top + ruporHeight / 2 };
  const target = { x: safe.left + safe.width * 0.45, y: ((at.description.top + at.description.bottom) / 2) * s };
  const aim = Math.max(-40, (Math.atan2(target.y - center.y, target.x - center.x) * 180) / Math.PI);
  const angle = (aim * Math.PI) / 180;
  const dx = ruporWidth * 0.49;
  const dy = ruporWidth * 0.4 - ruporHeight / 2;
  const mouth = {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };

  const cellsTop = at.cellsTop * s;
  const cellLeft = (i: number) => safe.left + i * layout.cellStep;

  // The description shakes under the shout, then every tile flies into its cell.
  const since = frame - beats.shout;
  const shake = since >= 0 && since < 12 ? Math.sin(since * 2.6) * 9 * s * (1 - since / 14) : 0;
  const flight = beats.flips - beats.fly - beats.rowLag * (layout.rows.length - 1);

  // The cells swell as the tiles pour in.
  const filling = interpolate(frame, [beats.fly + 8, beats.flips], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Brand safe={safe} s={s} />
      <Title safe={safe} s={s} />
      <Rings mouth={mouth} target={target} s={s} at={beats.shout} life={22} grow={5} />
      <Shouter rupor={rupor} width={ruporWidth} height={ruporHeight} aim={aim} s={s} />

      <Count text={lettersOf(count)} left={rupor.left + ruporWidth + 46 * s} top={cellsTop + layout.cell + 56 * s} s={s} />
      <Counter words={layout.rows.length} safe={safe} s={s} />
      <Example lines={episode.example} lemma={layout.lemma} safe={safe} s={s} />
      <Ask safe={safe} s={s} />

      {/* The cells, the given letters, and the word they turn over into. */}
      {layout.letters.map((letter, i) => {
        const flip = flipAt(i);
        const turned = frame >= flip + 3;
        const scaleY = interpolate(frame, [flip, flip + 3, flip + 6], [1, 0.05, 1], clamp);
        if (!turned) {
          const hint = layout.hints.indexOf(i);
          const hintAt = hint < 0 ? undefined : beats.hints[Math.min(hint, beats.hints.length - 1)];
          let pulse = 1;
          let lit = 0;
          for (const [n, start] of beats.pulses.entries()) {
            // On the first frames the outlines blink in turn, then all pulse together.
            const from = n === 0 ? i * 2 : start;
            pulse *= interpolate(frame, [from, from + 3, from + 10], [1, 1.07, 1], clamp);
            lit = Math.max(lit, interpolate(frame, [from, from + 3, from + 10], [0, 1, 0], clamp));
          }
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cellLeft(i),
                top: cellsTop,
                width: layout.cell,
                height: layout.cell,
                scale: `${pulse * (1 + filling * 0.06)} ${pulse * (1 + filling * 0.06) * scaleY}`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  boxSizing: 'border-box',
                  borderRadius: layout.cell * 0.14,
                  border: `${7 * s}px solid ${light.accent}`,
                  background: interpolateColors(Math.max(lit * 0.6, filling), [0, 1], [light.tile, light.highlight]),
                }}
              />
              {hintAt !== undefined && frame >= hintAt && <Hint letter={letter} size={layout.cell} at={hintAt} s={s} />}
            </div>
          );
        }
        // The word leaves the cells' row, grows and stands in the middle.
        const move = interpolate(frame, [beats.solved, beats.settled], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
        const size = layout.cell + (layout.wordTile - layout.cell) * move;
        const left = cellLeft(i) + (safe.left + i * layout.wordStep - cellLeft(i)) * move;
        const top = cellsTop + (at.wordTop * s - cellsTop) * move;
        const stressed = i === layout.stress;
        const bump = interpolate(frame, [beats.settled, beats.settled + 3, beats.settled + 9], [1, 1.05, 1], clamp);
        return (
          <div key={i} style={{ position: 'absolute', left, top, scale: `${bump} ${bump * scaleY}` }}>
            <Tile
              letter={letter}
              size={size}
              face={stressed ? light.ink : light.accent}
              edge={stressed ? blackEdge : light.accentEdge}
              ink={light.background}
            />
            {stressed && <Acute size={size} />}
          </div>
        );
      })}

      {/* The description: black tiles that fly into the cells on the shout. */}
      {layout.flying.map((item, k) => {
        const start = beats.fly + item.row * beats.rowLag;
        if (frame >= start + flight) return null;
        const t = interpolate(frame, [start, start + flight], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
        const to = {
          x: cellLeft(item.cell) + (layout.cell - layout.tile) / 2,
          y: cellsTop + (layout.cell - layout.tile) / 2,
        };
        // The tile stretches along its way down, as a blur would.
        const stretch = 1 + Math.sin(t * Math.PI) * 0.5;
        const shrink = 1 - t * 0.6;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: item.left + (to.x - item.left) * t,
              top: item.top + (to.y - item.top) * t,
              translate: `${frame < start ? shake * (item.row % 2 === 0 ? 1 : -1) : 0}px 0px`,
              scale: `${shrink / Math.sqrt(stretch)} ${shrink * stretch}`,
              rotate: `${t * (k % 2 === 0 ? -14 : 12)}deg`,
              opacity: interpolate(t, [0.8, 1], [1, 0.2], clamp),
            }}
          >
            <Tile letter={item.letter} size={layout.tile} face={light.ink} edge={blackEdge} ink={light.background} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** The small brand mark, top left, through the whole story. */
function Brand({ safe, s }: { safe: Safe; s: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        top: at.brandTop * s,
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: 44 * s,
        lineHeight: 1,
        letterSpacing: '0.16em',
        color: light.accent,
      }}
    >
      {texts.brand}
    </div>
  );
}

/** «Скажи одним словом»: already down on the first frame, it settles like a stamp in six. */
function Title({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        top: at.titleTop * s,
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: 84 * s,
        lineHeight: 1.06,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        color: light.ink,
        scale: String(1 + (1 - stamp) * 0.03),
        transformOrigin: 'left center',
      }}
    >
      {texts.title.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

/** A given letter: a red tile dropping into its cell from above, with a bounce. */
function Hint({ letter, size, at: start, s }: { letter: string; size: number; at: number; s: number }) {
  const frame = useCurrentFrame();
  const land = start + 6;
  const fall = interpolate(frame, [start, land], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const bounce = frame >= land ? Math.abs(Math.sin(((frame - land) / 8) * Math.PI)) * 26 * s * Math.max(0, 1 - (frame - land) / 12) : 0;
  const squash = interpolate(frame, [land, land + 2, land + 6], [1, 0.84, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        translate: `0px ${-fall * 420 * s - bounce}px`,
        scale: `1 ${squash}`,
        transformOrigin: 'center bottom',
        opacity: Math.min(1, (1 - fall) * 4 + 0.4),
      }}
    >
      <Tile letter={letter} size={size} face={light.accent} edge={light.accentEdge} ink={light.background} />
    </div>
  );
}

/** The Stress mark falling onto the stressed tile once the word stands in the middle. */
function Acute({ size }: { size: number }) {
  const frame = useCurrentFrame();
  const falls = beats.stress - 8;
  if (frame < falls) return null;
  const t = interpolate(frame, [falls, beats.stress], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const squash = interpolate(frame, [beats.stress, beats.stress + 2, beats.stress + 7], [1, 0.8, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: size * 0.41,
        top: -size * 0.6,
        width: size * 0.17,
        height: size * 0.46,
        borderRadius: size * 0.085,
        background: light.accent,
        rotate: '35deg',
        translate: `0px ${(1 - t) * -size * 0.9}px`,
        scale: `1 ${squash}`,
        transformOrigin: 'center bottom',
        opacity: Math.min(1, t * 3),
      }}
    />
  );
}

/** «6 літер», next to Рупор while the cells are empty: the riddle's size without the sound. */
function Count({ text, left, top, s }: { text: string; left: number; top: number; s: number }) {
  const frame = useCurrentFrame();
  if (frame >= beats.fly) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: 60 * s,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: light.ink,
        opacity: interpolate(frame, [beats.shout, beats.fly], [1, 0], clamp),
      }}
    >
      {text}
    </div>
  );
}

/** «4 слова → 1»: a black stamp where the description was. */
function Counter({ words, safe, s }: { words: number; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.counter) return null;
  const hit = interpolate(frame, [beats.counter, beats.counter + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const arrow = 74 * s;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left + 6 * s,
        top: at.counterTop * s,
        height: 104 * s,
        padding: `0 ${30 * s}px`,
        borderRadius: 20 * s,
        background: light.ink,
        boxShadow: `0 ${9 * s}px 0 ${blackEdge}`,
        color: light.background,
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: 58 * s,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 22 * s,
        rotate: '-3deg',
        scale: String(1 + (1 - hit) * 0.5),
        opacity: Math.min(1, hit * 2 + 0.3),
        transformOrigin: 'left center',
      }}
    >
      <span>{wordsOf(words)}</span>
      {/* The arrow is drawn: Unbounded has no «→». */}
      <svg width={arrow} height={arrow * 0.6} viewBox="0 0 50 30">
        <path d="M3 15 H43 M31 4 L44 15 L31 26" fill="none" stroke={light.accent} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ color: light.accent, fontSize: 76 * s }}>1</span>
    </div>
  );
}

/** The example typing in under the word, the word itself in red. */
function Example({ lines, lemma, safe, s }: { lines: readonly string[]; lemma: string; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.example) return null;
  const total = lines.reduce((sum, line) => sum + [...line].length, 0);
  const typed = interpolate(frame, [beats.example, beats.exampleTyped], [0, total], clamp);
  let before = 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: at.exampleTop * s,
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: 62 * s,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        color: light.ink,
      }}
    >
      {lines.map((line, l) => {
        const chars = [...line];
        const found = line.toLowerCase().indexOf(lemma);
        const offset = before;
        before += chars.length;
        return (
          <div key={l}>
            {chars.map((char, c) => (
              <span
                key={c}
                style={{
                  // Untyped letters keep their room, so the line doesn't jump as it types.
                  opacity: offset + c < typed ? 1 : 0,
                  color: found >= 0 && c >= found && c < found + lemma.length ? light.accent : light.ink,
                }}
              >
                {char}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** «Знав(-ла) це слово?»: the call to the comments, right of Рупор. */
function Ask({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.ask) return null;
  const [first, second] = texts.ask;
  const one = interpolate(frame, [beats.ask, beats.ask + 9], [0, 1], { ...clamp, easing: pop });
  const two = interpolate(frame, [beats.ask + 5, beats.ask + 14], [0, 1], { ...clamp, easing: pop });
  return (
    <div
      style={{
        position: 'absolute',
        left: at.ask.left * s,
        width: safe.right - at.ask.left * s,
        top: at.ask.top * s,
        height: (at.ask.bottom - at.ask.top) * s,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: 78 * s,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ color: light.ink, scale: String(one), transformOrigin: 'left center' }}>{first}</div>
      <div style={{ color: light.accent, scale: String(two), transformOrigin: 'left center' }}>{second}</div>
    </div>
  );
}

/** Рупор: he waits, leans back for air, shouts up at the description, is glad, and hops on the question. */
function Shouter({
  rupor,
  width,
  height,
  aim,
  s,
}: {
  rupor: { left: number; top: number };
  width: number;
  height: number;
  aim: number;
  s: number;
}) {
  const frame = useCurrentFrame();
  const idle = -6 + Math.sin(frame / 9) * 2.5;
  const glad = -4 + Math.sin(frame / 8) * 3;
  const rotate =
    frame < beats.inhale
      ? idle
      : frame < beats.shout
        ? interpolate(frame, [beats.inhale, beats.shout - 2], [idle, 10], clamp)
        : frame < beats.flips
          ? interpolate(frame, [beats.shout, beats.shout + 3], [10, aim], { ...clamp, easing: pop })
          : interpolate(frame, [beats.flips, beats.flips + 10], [aim, glad], { ...clamp, easing: Easing.out(Easing.cubic) });
  const squeeze = interpolate(frame, [beats.inhale, beats.shout - 1, beats.shout + 3], [1, 0.9, 1], clamp);
  const shake = frame >= beats.shout && frame < beats.flips ? Math.sin(frame * 2.2) * 7 * s : 0;
  const sinceAsk = frame - beats.ask;
  const hop = sinceAsk >= 0 && sinceAsk < 24 ? -Math.abs(Math.sin((sinceAsk / 12) * Math.PI)) * 34 * s * (1 - sinceAsk / 24) : 0;
  const state = frame < beats.shout ? 'waits' : frame < beats.flips ? 'shouts' : 'happy';
  return (
    <div
      style={{
        position: 'absolute',
        left: rupor.left,
        top: rupor.top,
        width,
        height,
        translate: `${shake}px ${hop}px`,
        rotate: `${rotate}deg`,
        scale: `${squeeze} 1`,
      }}
    >
      <Rupor state={state} width={width} />
    </div>
  );
}
