import { AbsoluteFill, Audio, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';

import w5 from '../../../../editions/uk/content/words/w_bcutlw.json';
import w6 from '../../../../editions/uk/content/words/w_8juf5j.json';
import w4 from '../../../../editions/uk/content/words/w_b7lkj1.json';
import w1 from '../../../../editions/uk/content/words/w_olmlqv.json';
import w3 from '../../../../editions/uk/content/words/w_b2az8s.json';
import w2 from '../../../../editions/uk/content/words/w_q8ot2t.json';
import w7 from '../../../../editions/uk/content/words/w_zhv9i4.json';
import { EndCardAt, endCardFrom } from '../EndCard';
import { light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { type Safe, tileSizeFor, useSafe } from '../safe';
import { Bed, levels, Sfx, sfx } from '../sound';
import { Tile } from '../Tile';
import { clamp, pop } from '../shared/motion';

const softEdge = 'rgba(20, 12, 10, 0.28)';

/** One day of the week: the app's Entry and the meaning as the video words it. */
type Day = { entry: { lemma: string; stress: number[] }; meaning: string };

/** One episode of «7 днів — 7 слів»: a themed week, a word a day, Monday first. */
export type Episode = { theme: string; days: readonly Day[] };

/**
 * The episodes. Every word is an Entry of the app (editions/uk/content/words):
 * the lemma and its Stress are read from the Entry, so the video and the app
 * say the same. The meaning is the advert's own short line, six words at
 * most, cut from the Entry's definition and never saying more than it does.
 */
export const episodes: readonly Episode[] = [
  {
    theme: 'Тиждень погоди',
    days: [
      { entry: w1, meaning: 'дрібний густий дощ' }, // мжи́чка
      { entry: w2, meaning: 'легкий приємний вітерець' }, // ле́гіт
      { entry: w3, meaning: 'свіжий пухкий сніг' }, // поро́ша
      { entry: w4, meaning: 'морозний наліт на гілках' }, // па́морозь
      { entry: w5, meaning: 'велика глибока калюжа' }, // баю́ра
      { entry: w6, meaning: 'тепла погода серед зими' }, // відли́га
      { entry: w7, meaning: 'час перед вечором' }, // надвечі́р’я
    ],
  },
];

const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'] as const;

/** The texts every episode shares; `count` is 7 for the whole week, 5 for the weekdays' cut. */
export const texts = {
  title: (count: number) => [count === 5 ? '5 буднів.' : `${count} днів.`, `${count} слів.`] as const,
  stamp: (count: number) => [`${count} ДНІВ`, 'ПОСПІЛЬ'] as const,
  promise: ['Одне слово на день.', 'Хвилина часу.'],
  endLine: 'Почни свій тиждень сьогодні.',
} as const;

/**
 * The beats in frames at 30 fps, 15 s in all. The bed's beat falls on every
 * 15th frame: a day of the whole week is two beats long, so every word lands
 * on a beat.
 */
export const beats = {
  /** The day tiles click over at once, like a board. */
  click: 6,
  /** The headline shrinks into the top line and the tiles go up. */
  shrink: 22,
  /** Monday. */
  days: 30,
  /** All the days together: 7 × 30 frames, or 5 × 42. */
  daysLength: 210,
  /** The big word starts for its tiles' flight. */
  flight: 7,
  /** The word before goes down into the list. */
  leave: 6,
  /** Every day is done: the list moves up and grows. */
  full: 240,
  stamp: 246,
  /** «Одне слово на день. Хвилина часу.» */
  promise: 282,
  length: 450,
} as const;

const end = endCardFrom(beats.length);
export const weekLength = beats.length;

/** The frame day `d` of `count` starts on. */
const dayAt = (d: number, count: number) => beats.days + Math.round((d * beats.daysLength) / count);

/** The apostrophe the videos use, whatever the Entry has. */
const lemmaOf = (entry: Day['entry']) => entry.lemma.replace(/['ʼ]/g, '’');

/** Where everything stands, in units of the 1080×1920 frame. */
const at = {
  title: { top: 324, maxFont: 210, perLetter: 0.63 },
  header: { top: 252, font: 50 },
  /** The row of day tiles: under the headline first, then under the top line. */
  row: { hookTop: 790, top: 346 },
  theme: { top: 962 },
  /** The word of the day in red tiles, its meaning under it. */
  stage: { tilesTop: 572, maxTile: 132 },
  /** The list while the days go, and once they are done. */
  list: { top: 852, bottom: 1400, finalTop: 510, finalHeight: 630, maxStep: 110, word: 362 },
} as const;

export type WeekProps = {
  /** Which of `episodes` to play, counted from 0. */
  episode?: number;
  /** How many days: the whole week, or only the weekdays with more time for each. */
  count?: 5 | 7;
};

/**
 * «7 днів — 7 слів»: one 15 s 9:16 video per themed week. The headline, the
 * seven day tiles and the theme stand from the first frame; every day's tile
 * turns red with a tick and gives its word in red tiles with the meaning;
 * the words gather into a list; «N ДНІВ ПОСПІЛЬ» is stamped by it and Рупор
 * is glad; «Одне слово на день. Хвилина часу.»; the end card.
 */
export function Week({ episode = 0, count = 7 }: WeekProps) {
  const item = episodes[episode] ?? episodes[0];
  if (item === undefined) return null;
  const days = item.days.slice(0, count);
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={end} name="Week">
        <Scene theme={item.theme} days={days} />
      </Sequence>
      <EndCardAt from={end} line={texts.endLine} />
      <WeekSound count={days.length} />
    </AbsoluteFill>
  );
}

/**
 * The sounds: the bed and its beat from the first frame, one flap for the
 * tiles' click, a flap and a pop for every day, the stamp and a short, quiet
 * shout. No voice: seven words in seven seconds leave no room to say one.
 */
export function WeekSound({ count }: { count: number }) {
  return (
    <>
      <Bed beatFrom={0} />
      <Sfx src={sfx.flap} at={beats.click} volume={0.8} />
      {Array.from({ length: count }, (_, d) => (
        <Sequence key={d} from={dayAt(d, count)} layout="none" name="Day">
          <Sfx src={sfx.flap} at={0} volume={0.7} />
          <Sfx src={sfx.pop} at={beats.flight} volume={0.45} />
        </Sequence>
      ))}
      <Sfx src={sfx.stamp} at={beats.stamp} volume={0.75} />
      {/* Рупор is glad: his shout, cut short and under the level the other videos shout at. */}
      <Sequence from={beats.stamp + 4} durationInFrames={16} layout="none" name="Short horn">
        <Audio src={sfx.horn} volume={(f) => interpolate(f, [0, 8, 16], [0.7, 0.7, 0], clamp) * levels.horn} />
      </Sequence>
      <Sfx src={sfx.swish} at={beats.promise - 2} volume={0.4} />
    </>
  );
}

function Scene({ theme, days }: { theme: string; days: readonly Day[] }) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const count = days.length;
  const title = texts.title(count);
  // The headline is as big as its longer line lets it be inside the safe width.
  const titleFont = Math.min(
    at.title.maxFont,
    880 / (at.title.perLetter * Math.max(title[0].length, title[1].length)),
  );

  // The headline shrinks into the top line; the day tiles go up under it.
  const up = interpolate(frame, [beats.shrink, beats.shrink + 10], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const big = interpolate(frame, [beats.shrink, beats.shrink + 6], [1, 0], clamp);
  const small = interpolate(frame, [beats.shrink + 5, beats.shrink + 11], [0, 1], clamp);

  const tile = tileSizeFor(count, safe.rowWidth, 0.12, 130 * s);
  const tileStep = tile * 1.12;
  const rowLeft = safe.centerX - (count * tileStep - tile * 0.12) / 2;
  const rowTop = interpolate(up, [0, 1], [at.row.hookTop, at.row.top]) * s;
  const dayCenter = (d: number) => ({ x: rowLeft + d * tileStep + tile / 2, y: at.row.top * s + tile / 2 });

  // The list: small under the word of the day, then up and bigger once the week is done.
  const finalStep = Math.min(at.list.maxStep, at.list.finalHeight / count);
  const daysStep = Math.min(finalStep, (at.list.bottom - at.list.top) / count);
  const grown = interpolate(frame, [beats.full, beats.full + 10], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const listScale = interpolate(grown, [0, 1], [daysStep / finalStep, 1]);
  const rowY = (d: number, t: number) =>
    interpolate(t, [0, 1], [at.list.top + d * daysStep, at.list.finalTop + d * finalStep]) * s;
  const dim = interpolate(frame, [beats.promise, beats.promise + 6], [1, 0.4], clamp);

  return (
    <AbsoluteFill>
      {/* The headline: whole on the first frame. */}
      {big > 0 && (
        <div
          style={{
            position: 'absolute',
            left: safe.left,
            top: at.title.top * s,
            fontFamily: wordFont,
            fontWeight: 900,
            fontSize: titleFont * s,
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
            color: light.ink,
            opacity: big,
            scale: String(1 - 0.45 * up),
            translate: `0px ${-up * 90 * s}px`,
            transformOrigin: 'left top',
          }}
        >
          {title[0]}
          <br />
          <span style={{ color: light.accent }}>{title[1]}</span>
        </div>
      )}
      {big > 0 && (
        <div
          style={{
            position: 'absolute',
            left: safe.left,
            top: at.theme.top * s,
            fontFamily: uiFont,
            fontWeight: 600,
            fontSize: 50 * s,
            lineHeight: 1,
            color: light.ink,
            opacity: big,
          }}
        >
          {theme}
        </div>
      )}

      {/* The top line for the rest of the video: the headline left, the theme right. */}
      {small > 0 && (
        <div
          style={{
            position: 'absolute',
            left: safe.left,
            width: safe.width,
            top: at.header.top * s,
            height: 70 * s,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            whiteSpace: 'nowrap',
            opacity: small,
          }}
        >
          <div
            style={{
              fontFamily: wordFont,
              fontWeight: 900,
              fontSize: at.header.font * s,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: light.ink,
            }}
          >
            {title[0]} <span style={{ color: light.accent }}>{title[1]}</span>
          </div>
          <div style={{ fontFamily: uiFont, fontWeight: 600, fontSize: 36 * s, lineHeight: 1, color: light.muted }}>
            {theme}
          </div>
        </div>
      )}

      {days.map((_, d) => (
        <DayTile
          key={d}
          name={dayNames[d] ?? ''}
          left={rowLeft + d * tileStep}
          top={rowTop}
          size={tile}
          from={dayAt(d, count)}
          until={d + 1 < count ? dayAt(d + 1, count) : beats.full}
        />
      ))}

      {/* The list of the days done. */}
      <div style={{ opacity: dim }}>
        {days.map((day, d) => {
          const from = (d + 1 < count ? dayAt(d + 1, count) : beats.full) + 2;
          if (frame < from) return null;
          const come = interpolate(frame, [from, from + 5], [0, 1], clamp);
          return (
            <div
              key={d}
              style={{
                position: 'absolute',
                left: safe.left,
                top: rowY(d, grown),
                width: safe.width,
                height: finalStep * s,
                boxSizing: 'border-box',
                borderBottom: d + 1 < count ? `${3 * s}px solid ${light.line}` : undefined,
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                scale: String(listScale),
                transformOrigin: 'left top',
                opacity: come,
                translate: `0px ${(1 - come) * -14 * s}px`,
              }}
            >
              <div
                style={{
                  width: at.list.word * s,
                  flexShrink: 0,
                  fontFamily: wordFont,
                  fontWeight: 800,
                  fontSize: 44 * s,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: light.ink,
                }}
              >
                <Accented text={lemmaOf(day.entry)} at={day.entry.stress[0] ?? 0} color={light.accent} />
              </div>
              <div style={{ fontFamily: uiFont, fontWeight: 600, fontSize: 38 * s, lineHeight: 1, color: light.ink }}>
                {day.meaning}
              </div>
            </div>
          );
        })}
      </div>

      {/* The word of the day. */}
      {days.map((day, d) => {
        const from = dayAt(d, count);
        const until = d + 1 < count ? dayAt(d + 1, count) : beats.full;
        if (frame < from || frame >= until + beats.leave) return null;
        return (
          <WordOfDay
            key={d}
            day={day}
            from={from}
            until={until}
            source={dayCenter(d)}
            rowAt={{ x: safe.left + (at.list.word / 2) * s * listScale, y: rowY(d, 0) + (daysStep / 2) * s }}
            safe={safe}
            s={s}
          />
        );
      })}

      <Mascot safe={safe} s={s} />
      <Stamp lines={texts.stamp(count)} safe={safe} s={s} />
      <Promise rowStep={finalStep} safe={safe} s={s} />
    </AbsoluteFill>
  );
}

/** One day of the row: black with its name; from its day on, red with a tick. */
function DayTile({
  name,
  left,
  top,
  size,
  from,
  until,
}: {
  name: string;
  left: number;
  top: number;
  size: number;
  from: number;
  until: number;
}) {
  const frame = useCurrentFrame();
  const done = frame >= from + 3;
  const click = interpolate(frame, [beats.click, beats.click + 3, beats.click + 6], [1, 0.08, 1], clamp);
  const flip = interpolate(frame, [from, from + 3, from + 6], [1, 0.06, 1], clamp);
  // The day whose word is on screen stands a little higher than the rest.
  const now =
    interpolate(frame, [from + 3, from + 8], [0, 1], { ...clamp, easing: pop }) *
    interpolate(frame, [until, until + 4], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        scale: `${1 + 0.05 * now} ${(1 + 0.05 * now) * click * flip}`,
        translate: `0px ${-now * size * 0.07}px`,
      }}
    >
      <Tile
        letter=""
        size={size}
        face={done ? light.accent : light.ink}
        edge={done ? light.accentEdge : softEdge}
        ink={light.background}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.04,
          color: light.background,
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: size * (done ? 0.25 : 0.36),
          lineHeight: 1,
        }}
      >
        {name}
        {done && (
          <svg width={size * 0.5} height={size * 0.38} viewBox="0 0 50 38">
            <polyline
              points="6,20 19,32 44,6"
              fill="none"
              stroke={light.background}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * The word of the day: its red tiles shoot out of the day's tile, the
 * stressed letter in ink under the Stress mark, the meaning under them. Once
 * the next day starts it shrinks down into its row of the list.
 */
function WordOfDay({
  day,
  from,
  until,
  source,
  rowAt,
  safe,
  s,
}: {
  day: Day;
  from: number;
  until: number;
  source: { x: number; y: number };
  rowAt: { x: number; y: number };
  safe: Safe;
  s: number;
}) {
  const frame = useCurrentFrame();
  const letters = [...lemmaOf(day.entry).toUpperCase()];
  const stressed = day.entry.stress[0] ?? 0;
  // An apostrophe is no tile: it stands between two tiles, in a narrow place of its own.
  const gap = 0.1;
  const widthOf = (letter: string) => (letter === '’' ? 0.34 : 1);
  const units = letters.reduce((sum, letter) => sum + widthOf(letter), 0) + (letters.length - 1) * gap;
  const tile = Math.min(at.stage.maxTile * s, safe.rowWidth / units);
  const total = units * tile;
  const lefts: number[] = [];
  let x = safe.centerX - total / 2;
  for (const letter of letters) {
    lefts.push(x);
    x += (widthOf(letter) + gap) * tile;
  }
  const top = at.stage.tilesTop * s;
  const stagger = Math.min(1, 6 / Math.max(1, letters.length - 1));

  // It shrinks first and travels as it fades, so it never lies big over the rows it passes.
  const gone = interpolate(frame, [until, until + beats.leave], [0, 1], clamp);
  const leave = Easing.out(Easing.cubic)(gone);
  const center = { x: safe.centerX, y: top + tile * 0.9 };
  const meaning = interpolate(frame, [from + 5, from + 11], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const mark = interpolate(frame, [from + 12, from + 17], [0, 1], { ...clamp, easing: pop });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 1 - gone,
        translate: `${(rowAt.x - center.x) * leave}px ${(rowAt.y - center.y) * leave}px`,
        scale: String(1 - 0.72 * leave),
        transformOrigin: `${center.x}px ${center.y}px`,
      }}
    >
      {letters.map((letter, i) => {
        const launch = from + i * stagger;
        if (frame < launch) return null;
        const t = interpolate(frame, [launch, launch + beats.flight], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        const land = launch + beats.flight;
        const squash = interpolate(frame, [land, land + 2, land + 6], [1, 0.86, 1], clamp);
        const width = widthOf(letter) * tile;
        const to = { x: lefts[i] ?? 0, y: top };
        const start = { x: source.x - width / 2, y: source.y - tile / 2 };
        const isStressed = i === stressed;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: start.x + (to.x - start.x) * t,
              top: start.y + (to.y - start.y) * t,
              scale: `${0.2 + 0.8 * t} ${(0.2 + 0.8 * t) * squash}`,
              rotate: `${(1 - t) * (i % 2 === 0 ? -30 : 24)}deg`,
              transformOrigin: 'center bottom',
            }}
          >
            {letter === '’' ? (
              <div
                style={{
                  width,
                  height: tile,
                  display: 'flex',
                  justifyContent: 'center',
                  fontFamily: wordFont,
                  fontWeight: 900,
                  fontSize: tile * 0.8,
                  lineHeight: 1,
                  color: light.accent,
                }}
              >
                ’
              </div>
            ) : (
              <Tile
                letter={letter}
                size={tile}
                face={isStressed ? light.ink : light.accent}
                edge={isStressed ? softEdge : light.accentEdge}
                ink={light.background}
              />
            )}
            {isStressed && mark > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: tile * 0.43,
                  top: -tile * 0.5,
                  width: tile * 0.16,
                  height: tile * 0.42,
                  borderRadius: tile * 0.08,
                  background: light.accent,
                  rotate: '35deg',
                  scale: String(mark),
                  transformOrigin: 'center bottom',
                }}
              />
            )}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: safe.left,
          width: safe.width,
          top: top + tile + 46 * s,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 58 * s,
          lineHeight: 1.1,
          color: light.ink,
          opacity: meaning,
          translate: `0px ${(1 - meaning) * 18 * s}px`,
        }}
      >
        {day.meaning}
      </div>
    </div>
  );
}

/**
 * A word with the Stress mark drawn over its letter `at`, as Stress.tsx draws
 * it: the mark is ours, not a combining acute, so it looks the same in both fonts.
 */
function Accented({ text, at: index, color }: { text: string; at: number; color: string }) {
  const letters = [...text];
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {letters.slice(0, index).join('')}
      <span style={{ position: 'relative', display: 'inline-block', color }}>
        {letters[index]}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            // «і» and «ї» have dots of their own: the mark goes above them.
            top: 'іїІЇ'.includes(letters[index] ?? '') ? '-0.3em' : '-0.1em',
            width: '0.1em',
            height: '0.3em',
            marginLeft: '-0.02em',
            borderRadius: '0.05em',
            background: color,
            rotate: '35deg',
          }}
        />
      </span>
      {letters.slice(index + 1).join('')}
    </span>
  );
}

/**
 * Рупор: he waits under the headline on the first frame, ducks out while the
 * days go (the list needs his place), and is back, glad, once the week is done.
 */
function Mascot({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  const waiting = frame < beats.shrink + 12;
  if (!waiting && frame < beats.full) return null;
  const width = (waiting ? 380 : 330) * s;
  const height = (width * 112) / 150;
  const top = safe.rupor.bottom - height - 8 * s;
  const duck = interpolate(frame, [beats.shrink, beats.shrink + 10], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const back = interpolate(frame, [beats.full + 2, beats.full + 12], [0, 1], { ...clamp, easing: pop });
  const since = frame - beats.stamp;
  const hop = since >= 0 && since < 24 ? -Math.abs(Math.sin((since / 12) * Math.PI)) * 30 * s * (1 - since / 24) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left + 10 * s,
        top,
        width,
        height,
        translate: waiting ? `0px ${duck * 700 * s}px` : `0px ${hop}px`,
        rotate: `${(waiting ? -7 : -4) + Math.sin(frame / 8) * 2.5}deg`,
        scale: waiting ? '1' : String(back),
        transformOrigin: 'center bottom',
      }}
    >
      <Rupor state={waiting ? 'waits' : 'happy'} width={width} />
    </div>
  );
}

/** «N ДНІВ ПОСПІЛЬ»: the black stamp by the list's corner, right of Рупор. */
function Stamp({ lines, safe, s }: { lines: readonly string[]; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.stamp) return null;
  const hit = interpolate(frame, [beats.stamp, beats.stamp + 4], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const bump = interpolate(frame, [beats.stamp + 4, beats.stamp + 7, beats.stamp + 12], [1, 0.94, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        right: 1080 * s - safe.right + 24 * s,
        top: 1176 * s,
        padding: `${24 * s}px ${36 * s}px ${28 * s}px`,
        borderRadius: 24 * s,
        background: light.ink,
        boxShadow: `0 ${9 * s}px 0 ${softEdge}`,
        color: light.background,
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: 64 * s,
        lineHeight: 1.08,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        rotate: '-5deg',
        scale: String((2.2 - 1.2 * hit) * bump),
        opacity: Math.min(1, hit * 2),
      }}
    >
      <span style={{ color: light.accent }}>{lines[0]}</span>
      <br />
      {lines[1]}
    </div>
  );
}

/**
 * «Одне слово на день. Хвилина часу.»: a black plate over the dimmed list,
 * coming up from below. It covers whole rows of the list, from the second
 * one on, so no row is cut in half.
 */
function Promise({ rowStep, safe, s }: { rowStep: number; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.promise) return null;
  const come = interpolate(frame, [beats.promise, beats.promise + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: (at.list.finalTop + rowStep + 6) * s,
        height: (Math.ceil(250 / rowStep) * rowStep - 22) * s,
        display: 'flex',
        justifyContent: 'center',
        opacity: come,
        translate: `0px ${(1 - come) * 90 * s}px`,
      }}
    >
      <div
        style={{
          // As wide as the list, so no letter of a covered row shows beside it.
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRadius: 32 * s,
          background: light.ink,
          boxShadow: `0 ${10 * s}px 0 ${softEdge}`,
          fontFamily: wordFont,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 56 * s, color: light.background }}>{texts.promise[0]}</div>
        <div style={{ marginTop: 14 * s, fontSize: 76 * s, color: light.accent }}>{texts.promise[1]}</div>
      </div>
    </div>
  );
}
