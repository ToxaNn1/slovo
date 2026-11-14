import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  random,
  useCurrentFrame,
} from 'remotion';

import { dark } from '../look';
import { tileSizeFor, useSafe } from '../safe';
import { Tile } from '../Tile';
import { Caption } from './Caption';
import { clamp } from '../shared/motion';

/** The word that opens the video, then the words around it, by their place. */
export const mainWord = 'КРАКЕЛЮР';
// Units from the main word's centre, before the camera pulls back. Placed so
// that, pulled back, every word stays inside the safe zone and clear of the caption.
const others = [
  { word: 'ГРИЗОТА', wide: [-700, -440], tall: [-140, -590] },
  { word: 'БУНДЮЧНИЙ', wide: [640, -430], tall: [110, -330] },
  { word: 'ГНОМОН', wide: [-690, 440], tall: [-190, 420] },
  { word: 'ОКАЛИНА', wide: [700, 450], tall: [130, 560] },
] as const;
const words = [{ word: mainWord, wide: [0, 0], tall: [0, 0] } as const, ...others];

export const captions = { first: 'Спочатку було слово.', second: 'Потім його забули.' } as const;

/** The forgotten tiles: light enough to read on black. */
const grey = '#3A302C';
export const greyInk = '#9A8B80';

/** How long the dark opening runs, in frames at 30 fps: 8.5 s. */
export const forgottenLength = 255;

/** The frames the dark opening's parts start on; Promo.tsx hangs its sounds on them. */
export const forgottenBeats = {
  /** The main word builds, 3 frames a letter. */
  word: 6,
  /** «Спочатку було слово.» is typed. */
  first: 10,
  firstUntil: 108,
  /** The camera pulls back; the other words appear `othersStep` apart. */
  pull: [60, 96],
  others: 56,
  othersStep: 4,
  /** The other words go grey `greyStep` apart, and «Потім його забули.» is typed with them. */
  grey: 111,
  greyStep: 6,
  greyMain: 138,
  crack: 144,
  /** The letters start to fall; each within `fallSpread` frames. */
  fall: 162,
  fallSpread: 24,
  /** Everything fades to black: under half a second. */
  fade: [240, 253],
} as const;

const b = forgottenBeats;

/**
 * Acts 1 and 2: «Спочатку було слово.» one word glows on black and the
 * camera finds a sky of them; «Потім його забули.» they grey out one by one,
 * crack and fall into a grey heap of letters.
 */
export function Forgotten() {
  const frame = useCurrentFrame();
  const { height, portrait, s, safe } = useSafe();
  const zoomTo = portrait ? 0.75 : 0.7;
  const zoom = interpolate(frame, [...b.pull], [1, zoomTo], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const fade = interpolate(frame, [...b.fade], [1, 0], clamp);
  const center = { x: safe.centerX, y: portrait ? safe.centerY : height / 2 - 40 * s };
  const mainSize = portrait ? tileSizeFor(mainWord.length, safe.rowWidth) : 132 * s;
  const otherSize = (portrait ? 80 : 96) * s;
  // Where the heap lies: on the safe zone's foot in 9:16, on the frame's foot in 16:9.
  const floor = portrait ? safe.bottom : height;
  // Both captions stand right under the main word, clear of the words around.
  const captionTop = center.y + mainSize * 0.5 + 44 * s;
  const captionSize = (portrait ? 64 : 54) * s;

  return (
    <AbsoluteFill style={{ background: dark.background }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <div style={{ position: 'absolute', left: center.x, top: center.y, scale: String(zoom) }}>
          {words.map((w, k) => {
            const [x, y] = portrait ? w.tall : w.wide;
            return (
              <Word
                key={w.word}
                index={k}
                word={w.word}
                x={x * s}
                y={y * s}
                size={k === 0 ? mainSize : otherSize}
                // Portrait: a letter fades as it reaches the heap, not under it.
                fadeAt={portrait ? (floor - 150 * s - center.y) / zoomTo - y * s : undefined}
              />
            );
          })}
        </div>
        <Heap floor={floor} />
        <Caption
          text={captions.first}
          from={b.first}
          until={b.firstUntil}
          color={dark.ink}
          size={captionSize}
          top={captionTop}
          centerX={center.x}
        />
        <Caption
          text={captions.second}
          from={b.grey}
          color={dark.ink}
          size={captionSize}
          top={captionTop}
          centerX={center.x}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Word({
  word,
  index,
  x,
  y,
  size,
  fadeAt,
}: {
  word: string;
  index: number;
  x: number;
  y: number;
  size: number;
  /** How far down (in the word's own pixels) a falling letter is gone; none: it falls out of the frame. */
  fadeAt?: number;
}) {
  const frame = useCurrentFrame();
  const { height } = useSafe();
  const gap = size * 0.12;
  const total = word.length * size + (word.length - 1) * gap;
  // The main word builds first; the others show up as the camera pulls back.
  const appear = index === 0 ? b.word : b.others + index * b.othersStep;
  // The others go grey first, the main word last.
  const greyAt = index === 0 ? b.greyMain : b.grey + (index - 1) * b.greyStep;
  const toGrey = interpolate(frame, [greyAt, greyAt + 8], [0, 1], clamp);
  const breathe = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI);
  const crack = interpolate(frame, [b.crack, b.crack + 14], [0, 1], clamp);

  return (
    <div
      style={{ position: 'absolute', left: x - total / 2, top: y - size / 2, display: 'flex', gap }}
    >
      {[...word].map((letter, i) => {
        const at = appear + i * 3;
        const pop = interpolate(frame, [at, at + 8], [0, 1], {
          ...clamp,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        });
        const fallAt = b.fall + random(`fall-${index}-${i}`) * b.fallSpread;
        const fall = interpolate(frame, [fallAt, fallAt + 26], [0, 1], {
          ...clamp,
          easing: Easing.in(Easing.quad),
        });
        const spin = (random(`spin-${index}-${i}`) - 0.5) * 80;
        // Far enough to leave the frame from the top row, the camera pulled back.
        const down = fall * height * 1.8;
        const opacity =
          fadeAt === undefined
            ? 1
            : interpolate(
                down,
                [Math.max(0, fadeAt - size * 2), Math.max(size, fadeAt)],
                [1, 0],
                clamp,
              );
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              scale: String(pop),
              translate: `0px ${down}px`,
              rotate: `${fall * spin}deg`,
              opacity,
            }}
          >
            <Tile
              letter={letter}
              size={size}
              face={interpolateColors(toGrey, [0, 1], [dark.tile, grey])}
              edge={dark.tileEdge}
              ink={interpolateColors(toGrey, [0, 1], [dark.ink, greyInk])}
              style={{
                boxShadow: `0 ${size * 0.08}px 0 ${dark.tileEdge}, 0 0 ${
                  (1 - toGrey) * (24 + 22 * breathe) * (size / 96)
                }px rgba(255, 244, 230, ${(1 - toGrey) * 0.28})`,
              }}
            />
            <Crack seed={`${index}-${i}`} size={size} progress={crack} stroke={dark.background} />
          </div>
        );
      })}
    </div>
  );
}

/** A craquelure over a tile, drawn in as the word is forgotten. */
export function Crack({
  seed,
  size,
  progress,
  stroke,
}: {
  seed: string;
  size: number;
  progress: number;
  stroke: string;
}) {
  const point = (n: number) => (0.15 + random(`${seed}-${n}`) * 0.7) * 100;
  const d = `M${point(1)} 0 L${point(2)} 35 L${point(3)} 60 L${point(4)} 100 M${point(2)} 35 L100 ${point(5)} M${point(3)} 60 L0 ${point(6)}`;
  if (progress <= 0) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ position: 'absolute', inset: 0 }}
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
    </svg>
  );
}

/** The forgotten letters, piled grey on `floor` as the words fall. */
const heapLetters = words.flatMap((w) => [...w.word]);

function Heap({ floor }: { floor: number }) {
  const frame = useCurrentFrame();
  const { width, height, portrait, s, safe } = useSafe();
  const size = 84 * s;
  // Portrait: the whole heap inside the safe zone; landscape: across the frame's foot, half sunk.
  const left = portrait ? safe.left + size * 0.2 : 0;
  const span = (portrait ? safe.width - size * 0.4 : width) - size;
  const base = portrait ? floor - size * 1.25 : floor - size * 0.7;
  const rise = height * (portrait ? 0.1 : 0.13);
  return (
    <>
      {heapLetters.map((letter, i) => {
        // A mound: tiles stack higher towards the middle.
        const x = random(`hx-${i}`);
        const mound = Math.sin(x * Math.PI) * (0.4 + random(`hh-${i}`) * 0.6);
        const landAt = b.fall + 10 + random(`ht-${i}`) * (b.fallSpread + 8);
        const drop = interpolate(frame, [landAt - 10, landAt], [1, 0], {
          ...clamp,
          easing: Easing.in(Easing.quad),
        });
        if (frame < landAt - 10) return null;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: left + x * span,
              top: base - mound * rise,
              translate: `0px ${-drop * height * 0.3}px`,
              opacity: 1 - drop,
              rotate: `${(random(`hr-${i}`) - 0.5) * 70}deg`,
            }}
          >
            <Tile letter={letter} size={size} face={grey} edge={dark.tileEdge} ink={greyInk} />
          </div>
        );
      })}
    </>
  );
}
