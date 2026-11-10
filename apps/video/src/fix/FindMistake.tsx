import { AbsoluteFill, Easing, interpolate, interpolateColors, Sequence, useCurrentFrame } from 'remotion';

import { EndCardAt, endCardFrom } from '../EndCard';
import { light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { type Safe, useSafe } from '../safe';
import { Bed, Horn, Knock, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { widthInEm } from './advance';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const pop = Easing.bezier(0.34, 1.56, 0.64, 1);

/** One episode of «Знайди помилку»: a phrase everyone hears, with one calque in it. */
export type Episode = {
  /** The phrase as it is heard, one string per row: three rows at most, about 24 characters in all. */
  phrase: readonly string[];
  /** The calque, exactly as it stands in one of the rows. */
  wrong: string;
  /** What takes its place: one word, it lands as red letter tiles. */
  right: string;
  /** The right form in short, for the plate that replaces «Знайди помилку». */
  answer: string;
  /** Why, in eight words at most; `\n` breaks it into its two lines. */
  rule: string;
  /** The recording of the right form, once there is one (SOUNDS.md). */
  voice?: string;
};

/**
 * The episodes. Each pair is a settled norm that the app's own Corrections
 * give too (editions/uk/content/corrections): the video and the app must say the same.
 */
export const episodes: readonly Episode[] = [
  {
    // c_bkkjrf «приймати участь» → «брати участь»
    phrase: ['Я приймаю', 'участь', 'у марафоні'],
    wrong: 'приймаю',
    right: 'беру',
    answer: 'Беру участь',
    rule: 'Участь беруть.\nПриймають гостей.',
  },
  {
    // c_gxgxon «на протязі року» → «протягом року»
    phrase: ['На протязі', 'дня', 'напишу'],
    wrong: 'На протязі',
    right: 'протягом',
    answer: 'Протягом дня',
    rule: 'На протязі можна\nхіба застудитися.',
  },
  {
    // c_pthwmo «я рахую, що» → «я вважаю, що»
    phrase: ['Я рахую,', 'що це', 'добре'],
    wrong: 'рахую',
    right: 'вважаю',
    answer: 'Я вважаю',
    rule: 'Рахують гроші.\nПро думку — «я вважаю».',
  },
];

/** The texts every episode shares. */
export const texts = {
  title: 'Знайди помилку',
  ask: 'А ти як кажеш?',
  honest: 'Чесно.',
  // The no-break space keeps the dash off the start of the second line.
  endLine: 'Виправлення на щодень\u00A0— у застосунку.',
} as const;

/** The beats in frames at 30 fps, 15 s in all; the bed's beat falls on every 15th frame. */
export const beats = {
  /** The countdown: «3» is pulsed, then «2» and «1» flip in. */
  ticks: [15, 45, 75],
  /** Рупор leans back for air. */
  inhale: 96,
  /** Рупор shouts; the calque turns black and shakes. */
  shout: 105,
  /** The crack runs down the black plate. */
  crack: 111,
  /** The two halves fall. */
  fall: 120,
  /** The gap takes the width of the right word. */
  close: 122,
  /** The first red tile leaves the megaphone. */
  tiles: 126,
  tileFlight: 10,
  /** «Знайди помилку» flips into the right form. */
  reveal: 165,
  /** The rule comes in. */
  rule: 170,
  /** «А ти як кажеш?» takes the rule's place, then «Чесно.». */
  ask: 240,
  honest: 255,
  length: 450,
} as const;

const end = endCardFrom(beats.length);
export const findMistakeLength = beats.length;

/** The frames a tile of an `count`-letter word leaves on and lands on, and the frame the word is whole. */
function tileBeats(count: number) {
  const step = count > 5 ? 3 : 4;
  const launch = (i: number) => beats.tiles + i * step;
  const land = (i: number) => launch(i) + beats.tileFlight;
  return { launch, land, solved: Math.max(150, land(count - 1) + 2) };
}

type Item = { kind: 'plate' | 'slot' | 'mark'; text: string; width: number; gap: number };
type Row = { items: Item[]; top: number };

/** The smallest letters the video may show, in layout units. */
const smallest = 56;

/**
 * Where everything of the phrase stands. The words are plates, the calque is
 * the slot; the type is as big as the widest row lets it be inside the safe
 * row width, and the red tiles as big as their row lets them.
 */
function layoutFor(episode: Episode, safe: Safe, s: number) {
  const wrong = episode.wrong.toUpperCase();
  const pad = 0.26;
  const gap = 0.2;
  let found = false;
  const parsed = episode.phrase.map((source) => {
    const row = source.toUpperCase();
    const at = found ? -1 : row.indexOf(wrong);
    const words = (text: string) =>
      text
        .split(' ')
        .filter((word) => word !== '')
        .map((text) => ({ kind: 'plate' as const, text }));
    if (at < 0) return words(row);
    found = true;
    const after = row.slice(at + wrong.length);
    const mark = /^[,.!?…:;]+/.exec(after)?.[0] ?? '';
    return [
      ...words(row.slice(0, at)),
      { kind: 'slot' as const, text: wrong },
      ...(mark === '' ? [] : [{ kind: 'mark' as const, text: mark }]),
      ...words(after.slice(mark.length)),
    ];
  });
  if (!found) throw new Error(`«${episode.wrong}» is not in the phrase «${episode.phrase.join(' ')}»`);

  const emOf = (item: { kind: Item['kind']; text: string }) =>
    item.kind === 'mark' ? widthInEm(item.text) : widthInEm(item.text) + 2 * pad;
  const gapOf = (kind: Item['kind'], index: number) => (index === 0 ? 0 : kind === 'mark' ? 0.05 : gap);
  const rowEm = (row: (typeof parsed)[number]) =>
    row.reduce((sum, item, i) => sum + emOf(item) + gapOf(item.kind, i), 0);
  const font = Math.min(92 * s, safe.rowWidth / Math.max(...parsed.map(rowEm)));
  if (font < smallest * s) throw new Error(`«${episode.phrase.join(' ')}» is too long: its type would be ${font}px`);

  const plateHeight = font * 1.42;
  const rowStep = plateHeight + 28 * s;
  const blockTop = 666 * s - (rowStep * parsed.length - 28 * s) / 2;
  const rows: Row[] = parsed.map((row, r) => ({
    top: blockTop + r * rowStep,
    items: row.map((item, i) => ({ ...item, width: emOf(item) * font, gap: gapOf(item.kind, i) * font })),
  }));

  // The red tiles: as high as a plate, smaller if their row would be wider than the safe row.
  const letters = [...episode.right.toUpperCase()].filter((letter) => letter !== ' ');
  const tileGap = 0.1;
  const units = letters.length + (letters.length - 1) * tileGap;
  const slotRow = rows.find((row) => row.items.some((item) => item.kind === 'slot')) ?? rows[0];
  const others = (slotRow?.items ?? []).reduce(
    (sum, item) => sum + item.gap + (item.kind === 'slot' ? 0 : item.width),
    0,
  );
  const tile = Math.min(plateHeight, (safe.rowWidth - others) / units);
  if (tile * 0.56 < smallest * s) throw new Error(`«${episode.right}» is too long for its row`);

  return { rows, font, plateHeight, letters, tile, tileStep: tile * (1 + tileGap), rightWidth: units * tile };
}

/** The left edge of every item of a row centred on `centerX`, with the slot `slotWidth` wide. */
function place(row: Row, centerX: number, slotWidth: number) {
  const widths = row.items.map((item) => (item.kind === 'slot' ? slotWidth : item.width));
  const total = row.items.reduce((sum, item, i) => sum + item.gap + (widths[i] ?? 0), 0);
  let x = centerX - total / 2;
  return row.items.map((item, i) => {
    x += item.gap;
    const left = x;
    x += widths[i] ?? 0;
    return left;
  });
}

export type FindMistakeProps = {
  /** Which of `episodes` to play, counted from 0. */
  episode?: number;
};

/**
 * «Знайди помилку»: one 15 s 9:16 video per episode. The phrase and the
 * question stand from the first frame; three seconds to find the calque;
 * Рупор shouts it off its row and the right word lands in red tiles; the
 * rule in one line; «А ти як кажеш? Чесно.»; the end card.
 */
export function FindMistake({ episode = 0 }: FindMistakeProps) {
  const item = episodes[episode] ?? episodes[0];
  if (item === undefined) return null;
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={end} name="Find the mistake">
        <Scene episode={item} />
      </Sequence>
      <EndCardAt from={end} line={texts.endLine} />
      <FindMistakeSound episode={item} />
    </AbsoluteFill>
  );
}

/** The sounds: the bed and its beat from the first frame, the countdown, the shout, the break, the tiles, the voice. */
export function FindMistakeSound({ episode }: { episode: Episode }) {
  const count = [...episode.right].filter((letter) => letter !== ' ').length;
  const tiles = tileBeats(count);
  return (
    <>
      <Bed beatFrom={0} />
      <Sfx src={sfx.stamp} at={0} volume={0.7} />
      {beats.ticks.map((at, i) => (
        <Sequence key={at} from={at} layout="none" name="Tick">
          <Sfx src={sfx.flap} at={0} volume={0.8} />
          <Knock index={i} at={0} volume={0.45} />
        </Sequence>
      ))}
      <Horn at={beats.shout} />
      <Sfx src={sfx.miss} at={beats.shout + 3} volume={0.6} />
      <Sfx src={sfx.crack} at={beats.crack} volume={0.7} />
      <Sfx src={sfx.rubble} at={beats.fall} volume={0.55} />
      {Array.from({ length: count }, (_, i) => (
        <Knock key={i} index={i} at={tiles.land(i)} />
      ))}
      <Sfx src={sfx.chord} at={tiles.solved} volume={0.55} />
      {/* «Рупор вимовляє правильний варіант»: nothing is recorded yet (SOUNDS.md). */}
      <Voice src={episode.voice} at={tiles.solved} />
      <Sfx src={sfx.flap} at={beats.reveal} volume={0.7} />
      <Sfx src={sfx.pop} at={beats.rule} volume={0.4} />
      <Sfx src={sfx.swish} at={beats.ask - 2} volume={0.4} />
      <Sfx src={sfx.pop} at={beats.honest} volume={0.5} />
    </>
  );
}

function Scene({ episode }: { episode: Episode }) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const layout = layoutFor(episode, safe, s);
  const tiles = tileBeats(layout.letters.length);

  const slotRowIndex = layout.rows.findIndex((row) => row.items.some((item) => item.kind === 'slot'));
  const slotRow = layout.rows[slotRowIndex];
  const slotIndex = slotRow?.items.findIndex((item) => item.kind === 'slot') ?? 0;
  const wrongWidth = slotRow?.items[slotIndex]?.width ?? 0;
  const slotWidth = interpolate(frame, [beats.close, beats.close + 10], [wrongWidth, layout.rightWidth], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const slotLeftAt = (width: number) => (slotRow === undefined ? 0 : (place(slotRow, safe.centerX, width)[slotIndex] ?? 0));
  const slotTop = slotRow?.top ?? 0;

  // Рупор stands at the left of his band and aims the megaphone up at the calque.
  const ruporWidth = 380 * s;
  const ruporHeight = (ruporWidth * 112) / 150;
  const rupor = { left: safe.left + 10 * s, top: safe.rupor.bottom - ruporHeight - 8 * s };
  const center = { x: rupor.left + ruporWidth / 2, y: rupor.top + ruporHeight / 2 };
  const target = { x: slotLeftAt(wrongWidth) + wrongWidth / 2, y: slotTop + layout.plateHeight / 2 };
  const aim = Math.max(-40, (Math.atan2(target.y - center.y, target.x - center.x) * 180) / Math.PI);
  const mouthAt = (degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    const dx = ruporWidth * 0.49;
    const dy = ruporWidth * 0.4 - ruporHeight / 2;
    return {
      x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  };
  const mouth = mouthAt(aim);

  // The countdown's look runs over the plates, as if Рупор went through them word by word.
  const looking = frame >= 12 && frame < beats.inhale;
  let plateCount = 0;
  for (const row of layout.rows) plateCount += row.items.filter((item) => item.kind !== 'mark').length;
  const look = looking ? ((frame - 12) / 9) % plateCount : -1;

  const shaking = frame >= beats.shout && frame < beats.fall;
  const blacken = interpolate(frame, [beats.shout, beats.shout + 3], [0, 1], clamp);
  let plateIndex = -1;

  return (
    <AbsoluteFill>
      <Rings mouth={mouth} target={target} s={s} />
      <Shouter rupor={rupor} width={ruporWidth} height={ruporHeight} aim={aim} solved={tiles.solved} s={s} />
      <Title answer={episode.answer} safe={safe} s={s} />

      {layout.rows.map((row, r) => {
        const lefts = place(row, safe.centerX, r === slotRowIndex ? slotWidth : 0);
        return row.items.map((item, i) => {
          const left = lefts[i] ?? 0;
          if (item.kind === 'mark') {
            return (
              <div
                key={`${r}-${i}`}
                style={{
                  position: 'absolute',
                  left,
                  top: row.top,
                  height: layout.plateHeight,
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: wordFont,
                  fontWeight: 900,
                  fontSize: layout.font,
                  lineHeight: 1,
                  color: light.ink,
                }}
              >
                {item.text}
              </div>
            );
          }
          plateIndex += 1;
          const seen = look >= plateIndex && look < plateIndex + 1 ? Math.sin((look - plateIndex) * Math.PI) : 0;
          if (item.kind === 'slot') {
            if (frame >= beats.fall) return null;
            const since = frame - beats.shout;
            const shake = shaking ? Math.sin(since * 2.6) * 11 * s * (1 - since / 30) : 0;
            return (
              <div
                key={`${r}-${i}`}
                style={{ position: 'absolute', left, top: row.top, translate: `${shake}px ${-seen * 8 * s}px` }}
              >
                <Plate
                  text={item.text}
                  width={item.width}
                  height={layout.plateHeight}
                  font={layout.font}
                  face={interpolateColors(blacken, [0, 1], [seen > 0 ? light.highlight : light.tile, light.ink])}
                  ink={interpolateColors(blacken, [0, 1], [light.ink, light.onAccent])}
                  s={s}
                />
                <CrackLine width={item.width} height={layout.plateHeight} s={s} />
              </div>
            );
          }
          return (
            <div
              key={`${r}-${i}`}
              style={{ position: 'absolute', left, top: row.top, translate: `0px ${-seen * 8 * s}px` }}
            >
              <Plate
                text={item.text}
                width={item.width}
                height={layout.plateHeight}
                font={layout.font}
                face={seen > 0 ? light.highlight : light.tile}
                ink={light.ink}
                s={s}
              />
            </div>
          );
        });
      })}

      <Timer safe={safe} s={s} />
      <Rule text={episode.rule} safe={safe} s={s} />
      <Ask safe={safe} s={s} />

      {layout.letters.map((letter, i) => {
        const launch = tiles.launch(i);
        const land = tiles.land(i);
        if (frame < launch) return null;
        const t = interpolate(frame, [launch, land], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
        const to = {
          x: slotLeftAt(layout.rightWidth) + i * layout.tileStep,
          y: slotTop + (layout.plateHeight - layout.tile) / 2,
        };
        const from = { x: mouth.x - layout.tile / 2, y: mouth.y - layout.tile / 2 };
        const squash = interpolate(frame, [land, land + 2, land + 7], [1, 0.84, 1], clamp);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: from.x + (to.x - from.x) * t,
              top: from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 150 * s,
              scale: `${0.25 + 0.75 * t} ${(0.25 + 0.75 * t) * squash}`,
              rotate: `${(1 - t) * (i % 2 === 0 ? -50 : 40)}deg`,
              transformOrigin: 'center bottom',
            }}
          >
            <Tile letter={letter} size={layout.tile} face={light.accent} edge={light.accentEdge} ink={light.onAccent} />
          </div>
        );
      })}

      {frame >= beats.fall && frame < beats.fall + 16 && slotRow !== undefined && (
        <Halves
          text={slotRow.items[slotIndex]?.text ?? ''}
          left={slotLeftAt(wrongWidth)}
          top={slotTop}
          width={wrongWidth}
          height={layout.plateHeight}
          font={layout.font}
          s={s}
        />
      )}
    </AbsoluteFill>
  );
}

/** One word of the phrase: a pale sticker with an ink outline and a pressed ink edge. */
function Plate({
  text,
  width,
  height,
  font,
  face,
  ink,
  s,
}: {
  text: string;
  width: number;
  height: number;
  font: number;
  face: string;
  ink: string;
  s: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        boxSizing: 'border-box',
        borderRadius: height * 0.16,
        background: face,
        border: `${5 * s}px solid ${light.ink}`,
        boxShadow: `0 ${height * 0.08}px 0 ${light.ink}`,
        color: ink,
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: font,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {text}
    </div>
  );
}

/** The line the black plate breaks along, in shares of its width and height, top to bottom. */
const breakLine = [
  [0.53, 0],
  [0.46, 0.28],
  [0.56, 0.52],
  [0.47, 0.78],
  [0.51, 1.2],
] as const;

/** The crack running down the black plate before it falls apart. */
function CrackLine({ width, height, s }: { width: number; height: number; s: number }) {
  const frame = useCurrentFrame();
  const drawn = interpolate(frame, [beats.crack, beats.fall - 2], [0, 1], clamp);
  if (drawn === 0) return null;
  const points = breakLine.map(([x, y]) => `${x * width},${Math.min(1, y) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <polyline
        points={points}
        fill="none"
        stroke={light.background}
        strokeWidth={6 * s}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - drawn}
      />
    </svg>
  );
}

/** The two halves of the broken plate, falling off the row. */
function Halves({
  text,
  left,
  top,
  width,
  height,
  font,
  s,
}: {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  font: number;
  s: number;
}) {
  const frame = useCurrentFrame();
  const t = frame - beats.fall;
  const line = breakLine.map(([x, y]) => `${x * 100}% ${(y / 1.2) * 100}%`);
  const clips = [
    `polygon(0% 0%, ${line.join(', ')}, 0% 100%)`,
    `polygon(100% 0%, ${line.join(', ')}, 100% 100%)`,
  ];
  const opacity = interpolate(t, [7, 15], [1, 0], clamp);
  return (
    <>
      {clips.map((clipPath, side) => {
        const direction = side === 0 ? -1 : 1;
        return (
          <div
            key={side}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              // Taller than the plate, so the clip keeps its pressed edge.
              height: height * 1.2,
              clipPath,
              opacity,
              translate: `${direction * t * 5 * s}px ${(t * t * 2.6 - t * 6) * s}px`,
              rotate: `${direction * t * 2.4}deg`,
              transformOrigin: side === 0 ? '25% 50%' : '75% 50%',
            }}
          >
            <Plate text={text} width={width} height={height} font={font} face={light.ink} ink={light.onAccent} s={s} />
          </div>
        );
      })}
    </>
  );
}

/** The plate on top: «Знайди помилку» as a black stamp, flipped into the right form on red once the phrase is mended. */
function Title({ answer, safe, s }: { answer: string; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  const mended = frame >= beats.reveal + 4;
  const text = (mended ? answer : texts.title).toUpperCase();
  const padding = 30 * s;
  const font = Math.min((mended ? 72 : 60) * s, (safe.rowWidth - 2 * padding - 24 * s) / widthInEm(text));
  // The stamp is already down on the first frame, inside the safe zone, and settles in six.
  const stamp = interpolate(frame, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tilt = -3 - (1 - stamp) * 1.5;
  const press = 1 + (1 - stamp) * 0.02;
  const flip = interpolate(frame, [beats.reveal, beats.reveal + 4, beats.reveal + 8], [1, 0.04, 1], clamp);
  const bump = interpolate(frame, [beats.reveal + 8, beats.reveal + 11, beats.reveal + 16], [1, 1.06, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: 272 * s,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          height: 112 * s,
          padding: `0 ${padding}px`,
          borderRadius: 20 * s,
          background: mended ? light.accent : light.ink,
          boxShadow: `0 ${9 * s}px 0 ${mended ? light.accentEdge : 'rgba(20, 12, 10, 0.28)'}`,
          color: light.onAccent,
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: font,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          rotate: `${tilt}deg`,
          translate: `0px ${(1 - stamp) * 10 * s}px`,
          scale: `${bump * press} ${bump * press * flip}`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Where the countdown, then the rule, then the question stand: between the phrase and Рупор's band. */
const under = { top: 916, bottom: 1100 } as const;

/** The countdown: one black tile, «3», «2», «1», a second each; gone on the shout. */
function Timer({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame >= beats.shout + 6) return null;
  const [first, second, third] = beats.ticks;
  const digit = frame < second ? 3 : frame < third ? 2 : 1;
  const size = 150 * s;
  let flip = 1;
  let pulse = 1;
  for (const tick of [second, third]) {
    flip *= interpolate(frame, [tick - 3, tick, tick + 3], [1, 0.05, 1], clamp);
  }
  for (const tick of [first, second, third]) {
    pulse *= interpolate(frame, [tick, tick + 3, tick + 10], [1, 1.14, 1], clamp);
  }
  const leave = interpolate(frame, [beats.shout, beats.shout + 5], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.centerX - size / 2,
        top: ((under.top + under.bottom) / 2) * s - size / 2,
        scale: `${pulse * leave} ${pulse * leave * flip}`,
      }}
    >
      <Tile letter={String(digit)} size={size} face={light.ink} edge="rgba(20, 12, 10, 0.28)" ink={light.onAccent} />
    </div>
  );
}

/** The rule in one line of two, under the mended phrase. */
function Rule({ text, safe, s }: { text: string; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.rule || frame >= beats.ask) return null;
  const come = interpolate(frame, [beats.rule, beats.rule + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const go = interpolate(frame, [beats.ask - 5, beats.ask], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: under.top * s,
        height: (under.bottom - under.top) * s,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        whiteSpace: 'pre-line',
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: 60 * s,
        lineHeight: 1.22,
        color: light.ink,
        opacity: come * go,
        translate: `0px ${(1 - come) * 24 * s}px`,
      }}
    >
      {text}
    </div>
  );
}

/** «А ти як кажеш?» and, a beat later, «Чесно.»: the call to the comments. */
function Ask({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.ask) return null;
  const ask = interpolate(frame, [beats.ask, beats.ask + 9], [0, 1], { ...clamp, easing: pop });
  const honest = interpolate(frame, [beats.honest, beats.honest + 8], [0, 1], { ...clamp, easing: pop });
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: (under.top + 2) * s,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: wordFont,
        fontWeight: 900,
        lineHeight: 1.08,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ fontSize: 80 * s, color: light.ink, scale: String(ask) }}>{texts.ask}</div>
      <div
        style={{
          marginTop: 6 * s,
          fontSize: 96 * s,
          color: light.accent,
          rotate: '-3deg',
          scale: String(honest),
          opacity: honest > 0 ? 1 : 0,
        }}
      >
        {texts.honest}
      </div>
    </div>
  );
}

/** The rings of the shout, going from the megaphone towards the calque. */
function Rings({ mouth, target, s }: { mouth: { x: number; y: number }; target: { x: number; y: number }; s: number }) {
  const frame = useCurrentFrame();
  return (
    <>
      {[0, 1, 2].map((ring) => {
        const t = interpolate(frame, [beats.shout + ring * 5, beats.shout + 24 + ring * 5], [0, 1], clamp);
        if (t === 0 || t === 1) return null;
        const size = 120 * s;
        return (
          <div
            key={ring}
            style={{
              position: 'absolute',
              left: mouth.x + (target.x - mouth.x) * t * 0.7 - size / 2,
              top: mouth.y + (target.y - mouth.y) * t * 0.7 - size / 2,
              width: size,
              height: size,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `${10 * s}px solid ${light.accent}`,
              scale: String(0.6 + t * 6),
              opacity: 1 - t,
            }}
          />
        );
      })}
    </>
  );
}

/** Рупор: he waits and looks, leans back for air, shouts up at the calque, is glad, and hops on the question. */
function Shouter({
  rupor,
  width,
  height,
  aim,
  solved,
  s,
}: {
  rupor: { left: number; top: number };
  width: number;
  height: number;
  aim: number;
  solved: number;
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
        : frame < solved
          ? interpolate(frame, [beats.shout, beats.shout + 3], [10, aim], { ...clamp, easing: pop })
          : interpolate(frame, [solved, solved + 8], [aim, glad], { ...clamp, easing: Easing.out(Easing.cubic) });
  const squeeze = interpolate(frame, [beats.inhale, beats.shout - 1, beats.shout + 3], [1, 0.9, 1], clamp);
  const shake = frame >= beats.shout && frame < beats.shout + 22 ? Math.sin(frame * 2.2) * 7 * s : 0;
  const sinceAsk = frame - beats.ask;
  const hop = sinceAsk >= 0 && sinceAsk < 24 ? -Math.abs(Math.sin((sinceAsk / 12) * Math.PI)) * 34 * s * (1 - sinceAsk / 24) : 0;
  const state = frame < beats.shout ? 'waits' : frame < solved ? 'shouts' : 'happy';
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
