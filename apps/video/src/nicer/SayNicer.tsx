import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, interpolateColors, Sequence, useCurrentFrame } from 'remotion';

import { EndCardAt, endCardFrom } from '../EndCard';
import { light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { type Safe, useSafe } from '../safe';
import { Bed, Horn, Knock, levels, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { charInEm, onestInEm } from './onest';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const pop = Easing.bezier(0.34, 1.56, 0.64, 1);

/** One episode of «Скажи гарніше»: an everyday answer in a chat and the nicer word for it. */
export type Episode = {
  /** What the other one wrote: the left bubble. One line, about 24 characters at most. */
  ask: string;
  /** The everyday answer. It is not a mistake: the video never crosses it out. */
  was: string;
  /** The nicer word, it lands as letter tiles: nine letters at most. The apostrophe is ’. */
  nicer: string;
  /** The punctuation after the tiles, if any. */
  mark?: string;
  /** The stressed letter of `nicer`, counted from 0 as the app's Entries count it. */
  stress: number;
  /** What stays of the answer after the word, as plain text under the tiles. */
  tail?: string;
  /** The meaning, six words at most; the video shows it under the word with its Stress mark. */
  meaning: string;
  /** The other one's answer to the nicer word: the third bubble. */
  praise: string;
  /** The recording of the word, once there is one (SOUNDS.md). */
  voice?: string;
};

/**
 * The episodes. Every pair is «usual → nicer», never «wrong → right»: both
 * words are the norm (СУМ), the second is only rarer. None of the three is an
 * Entry of the app yet; «навзаєм» and «залюбки» stand in its Examples
 * (editions/uk/content/words: w_ymz0oh, w_643f33, w_kn3ikr).
 */
export const episodes: readonly Episode[] = [
  {
    // «Навзаєм» answers a wish, not a «дякую» alone: so the left bubble wishes something.
    ask: 'Дякую! Гарних вихідних!',
    was: 'Взаємно!',
    nicer: 'навзаєм',
    mark: '!',
    stress: 4,
    meaning: 'взаємно, у відповідь',
    praise: 'О, гарно!',
  },
  {
    ask: 'Підеш із нами на каву?',
    was: 'Із задоволенням!',
    nicer: 'залюбки',
    mark: '!',
    stress: 6,
    meaning: 'охоче, із задоволенням',
    praise: 'Гарно сказано!',
  },
  {
    ask: 'Що робиш?',
    was: 'Та нічого, гортаю стрічку',
    nicer: 'знічев’я',
    stress: 4,
    tail: 'гортаю стрічку',
    meaning: 'від нічого робити',
    praise: 'Гарне слово!',
  },
];

/** The texts every episode shares. */
export const texts = {
  title: 'Скажи гарніше',
  send: 'надіслати?',
  call: ['Перешли в чат', 'замість', 'відповіді.'],
  endLine: 'Слова, якими хочеться відповідати.',
} as const;

/** The beats in frames at 30 fps, 13.5 s in all; the bed's beat falls on every 15th frame. */
export const beats = {
  /** «надіслати?» comes in under the answer and Рупор looks into the frame. */
  doubt: 24,
  /** Рупор leans back for air. */
  inhale: 52,
  /** Рупор shouts; the letters of the answer are blown off the bubble. */
  shout: 60,
  /** The empty bubble takes the size of the nicer word. */
  resize: 78,
  /** The first tile leaves the megaphone. */
  tiles: 90,
  tileStep: 3,
  tileFlight: 10,
  /** The third bubble and the meaning, at the earliest. */
  praise: 138,
  /** The chat fades out, «Перешли в чат замість відповіді.» comes in. */
  call: 216,
  length: 405,
} as const;

const end = endCardFrom(beats.length);
export const sayNicerLength = beats.length;

/** The frames of the tiles of a word with `count` tile-and-mark items. */
function tileBeats(count: number) {
  const launch = (i: number) => beats.tiles + i * beats.tileStep;
  const land = (i: number) => launch(i) + beats.tileFlight;
  /** The Stress mark starts to fall once the word is whole, and is down six frames later. */
  const stress = land(count - 1) + 4;
  const solved = stress + 6;
  return { launch, land, stress, solved, praise: Math.max(beats.praise, solved + 6) };
}

type Piece = { kind: 'tile' | 'apostrophe' | 'mark'; text: string; left: number; width: number };

/** Where everything of the chat stands, in frame pixels. */
function layoutFor(episode: Episode, safe: Safe, s: number) {
  const padX = 44 * s;

  const ask = { top: 436 * s, font: 52 * s, height: 134 * s };

  // The answer as it is typed: one line of Onest, as big as the bubble lets it be.
  const cursor = 16 * s;
  const wasFont = Math.min(60 * s, (safe.width - 2 * padX - cursor) / onestInEm(episode.was));
  if (wasFont < 44 * s) throw new Error(`«${episode.was}» is too long for its bubble`);
  const was = { font: wasFont, width: onestInEm(episode.was) * wasFont + cursor + 2 * padX, height: 150 * s };

  // The nicer word in tiles; the apostrophe and the punctuation are marks between and after them.
  const chars = [...episode.nicer.toUpperCase()];
  const mark = episode.mark ?? '';
  const gap = 0.1;
  const apostrophe = 0.3;
  const markShare = mark === '' ? 0 : 0.42;
  let units = 0;
  chars.forEach((char, i) => {
    units += (i === 0 ? 0 : gap) + (char === '’' ? apostrophe : 1);
  });
  units += markShare === 0 ? 0 : gap + markShare;
  const tile = Math.min(96 * s, (safe.width - 2 * padX) / units);
  if (tile < 72 * s) throw new Error(`«${episode.nicer}» is too long for tiles in a bubble`);
  const pieces: Piece[] = [];
  let x = 0;
  chars.forEach((char, i) => {
    x += i === 0 ? 0 : gap * tile;
    const width = (char === '’' ? apostrophe : 1) * tile;
    pieces.push({ kind: char === '’' ? 'apostrophe' : 'tile', text: char, left: x, width });
    x += width;
  });
  if (mark !== '') {
    x += gap * tile;
    pieces.push({ kind: 'mark', text: mark, left: x, width: markShare * tile });
    x += markShare * tile;
  }
  const rowWidth = x;

  const tailFont = 54 * s;
  const tailWidth = episode.tail === undefined ? 0 : onestInEm(episode.tail) * tailFont;
  // Room over the tiles for the Stress mark.
  const padTop = 70 * s;
  const padBottom = 46 * s;
  const tailHeight = episode.tail === undefined ? 0 : 76 * s;
  const answerTop = ask.top + ask.height + 48 * s;
  const nicer = {
    width: Math.max(rowWidth, tailWidth) + 2 * padX,
    height: padTop + tile + padBottom + tailHeight,
  };
  const left = (width: number) => safe.right - width;
  const row = { left: left(nicer.width) + padX, top: answerTop + padTop };
  const stressPiece = pieces[episode.stress];
  if (stressPiece === undefined || stressPiece.kind !== 'tile') {
    throw new Error(`«${episode.nicer}» has no letter ${episode.stress} to stress`);
  }

  const praiseTop = answerTop + nicer.height + 36 * s;
  return {
    padX,
    ask,
    was,
    nicer,
    answerTop,
    left,
    tile,
    pieces,
    row,
    stressPiece,
    tail: { font: tailFont, top: row.top + tile + 22 * s },
    praise: { top: praiseTop, font: 52 * s, height: 134 * s },
  };
}

export type SayNicerProps = {
  /** Which of `episodes` to play, counted from 0. */
  episode?: number;
};

/**
 * «Скажи гарніше»: one 13.5 s 9:16 video per episode. A chat of two bubbles
 * stands from the first frame; Рупор blows the everyday answer off its bubble
 * and the nicer word lands there in tiles, with its Stress mark; the other one
 * is glad, the meaning beside Рупор; «Перешли в чат замість відповіді.»; the end card.
 */
export function SayNicer({ episode = 0 }: SayNicerProps) {
  const item = episodes[episode] ?? episodes[0];
  if (item === undefined) return null;
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={end} name="Say it nicer">
        <Scene episode={item} />
      </Sequence>
      <EndCardAt from={end} line={texts.endLine} />
      <SayNicerSound episode={item} />
    </AbsoluteFill>
  );
}

/** How many tiles and marks the word lands as. */
const pieceCount = (episode: Episode) => [...episode.nicer].length + (episode.mark === undefined ? 0 : 1);

/** The sounds: the bed, the bubble's pop, the shout that blows the answer away, the tiles, the Stress mark, the call. */
export function SayNicerSound({ episode }: { episode: Episode }) {
  const count = pieceCount(episode);
  const tiles = tileBeats(count);
  return (
    <>
      <Bed beatFrom={0} />
      <Sfx src={sfx.pop} at={0} volume={0.5} />
      <Sfx src={sfx.whoosh} at={beats.inhale} volume={0.4} />
      <Horn at={beats.shout} />
      <Sfx src={sfx.swish} at={beats.shout + 4} volume={0.45} />
      {Array.from({ length: count }, (_, i) => (
        <Knock key={i} index={i} at={tiles.land(i)} />
      ))}
      <Sfx src={sfx.pluck} at={tiles.solved - 1} volume={levels.stress} />
      {/* «Рупор вимовляє слово»: nothing is recorded yet (SOUNDS.md). */}
      <Voice src={episode.voice} at={tiles.solved} />
      <Sfx src={sfx.pop} at={tiles.praise} volume={0.5} />
      <Sfx src={sfx.swish} at={beats.call - 2} volume={0.4} />
    </>
  );
}

function Scene({ episode }: { episode: Episode }) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const layout = layoutFor(episode, safe, s);
  const tiles = tileBeats(layout.pieces.length);

  // The answer's bubble: its right edge stays, it grows from the answer to the word.
  const grow = interpolate(frame, [beats.resize, beats.resize + 10], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const width = layout.was.width + (layout.nicer.width - layout.was.width) * grow;
  const height = layout.was.height + (layout.nicer.height - layout.was.height) * grow;
  const answerLeft = layout.left(width);
  const jump = interpolate(frame, [0, 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shake = frame >= beats.shout && frame < beats.shout + 16 ? Math.sin(frame * 2.4) * 7 * s * (1 - (frame - beats.shout) / 16) : 0;

  // Рупор stands at the left of his band and aims the megaphone up at the answer.
  const ruporWidth = 340 * s;
  const ruporHeight = (ruporWidth * 112) / 150;
  const rupor = { left: safe.left + 10 * s, top: safe.rupor.bottom - ruporHeight - 8 * s };
  const center = { x: rupor.left + ruporWidth / 2, y: rupor.top + ruporHeight / 2 };
  const target = { x: layout.left(layout.was.width) + layout.was.width / 2, y: layout.answerTop + layout.was.height / 2 };
  const aim = Math.max(-40, (Math.atan2(target.y - center.y, target.x - center.x) * 180) / Math.PI);
  const angle = (aim * Math.PI) / 180;
  const dx = ruporWidth * 0.49;
  const dy = ruporWidth * 0.4 - ruporHeight / 2;
  const mouth = {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
  // The way the shout blows: from the megaphone through the bubble and out of the frame.
  const reach = Math.hypot(target.x - mouth.x, target.y - mouth.y);
  const blow = { x: (target.x - mouth.x) / reach, y: (target.y - mouth.y) / reach };

  const dim = interpolate(frame, [beats.call - 4, beats.call + 6], [1, 0], clamp);

  return (
    <AbsoluteFill>
      <Title safe={safe} s={s} />
      <Shouter rupor={rupor} width={ruporWidth} height={ruporHeight} aim={aim} solved={tiles.solved} s={s} />

      <AbsoluteFill style={{ opacity: dim }}>
        <Rings mouth={mouth} target={target} s={s} />

        <Bubble side="left" left={safe.left} top={layout.ask.top} height={layout.ask.height} padX={layout.padX} s={s}>
          <Line font={layout.ask.font} color={light.ink}>
            {episode.ask}
          </Line>
        </Bubble>

        <div style={{ position: 'absolute', left: 0, top: 0, translate: `${shake}px ${(1 - jump) * 46 * s}px` }}>
          <Bubble side="right" left={answerLeft} top={layout.answerTop} width={width} height={height} padX={layout.padX} s={s}>
            <Typed text={episode.was} font={layout.was.font} blow={blow} s={s} />
          </Bubble>
        </div>
        <Doubt top={layout.answerTop + layout.was.height + 24 * s} safe={safe} s={s} />

        {layout.pieces.map((piece, i) => {
          const launch = tiles.launch(i);
          const land = tiles.land(i);
          if (frame < launch) return null;
          const t = interpolate(frame, [launch, land], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
          const to = { x: layout.row.left + piece.left, y: layout.row.top };
          const from = { x: mouth.x - piece.width / 2, y: mouth.y - layout.tile / 2 };
          const squash = interpolate(frame, [land, land + 2, land + 7], [1, 0.84, 1], clamp);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: from.x + (to.x - from.x) * t,
                top: from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 120 * s,
                scale: `${0.25 + 0.75 * t} ${(0.25 + 0.75 * t) * squash}`,
                rotate: `${(1 - t) * (i % 2 === 0 ? -50 : 40)}deg`,
                transformOrigin: 'center bottom',
              }}
            >
              {piece.kind === 'tile' ? (
                <Tile letter={piece.text} size={layout.tile} face={light.tile} edge={light.accentEdge} ink={light.accent} />
              ) : (
                <div
                  style={{
                    width: piece.width,
                    height: layout.tile,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: piece.kind === 'apostrophe' ? 'flex-start' : 'center',
                    fontFamily: wordFont,
                    fontWeight: 900,
                    fontSize: layout.tile * (piece.kind === 'apostrophe' ? 0.9 : 0.86),
                    lineHeight: 1,
                    color: light.background,
                  }}
                >
                  {piece.text}
                </div>
              )}
            </div>
          );
        })}

        <StressMark
          left={layout.row.left + layout.stressPiece.left}
          top={layout.row.top}
          tile={layout.tile}
          from={tiles.stress}
          s={s}
        />

        {episode.tail !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: layout.row.left,
              top: layout.tail.top,
              opacity: interpolate(frame, [tiles.stress - 6, tiles.stress + 2], [0, 1], clamp),
            }}
          >
            <Line font={layout.tail.font} color={light.background}>
              {episode.tail}
            </Line>
          </div>
        )}

        <Praise text={episode.praise} top={layout.praise.top} height={layout.praise.height} font={layout.praise.font} padX={layout.padX} from={tiles.praise} safe={safe} s={s} />
        <Meaning episode={episode} left={rupor.left + ruporWidth + 28 * s} top={rupor.top} height={ruporHeight} from={tiles.praise + 6} safe={safe} s={s} />
      </AbsoluteFill>

      <Call safe={safe} s={s} />
    </AbsoluteFill>
  );
}

/** One line of chat text. */
function Line({ font, color, children }: { font: number; color: string; children: ReactNode }) {
  return (
    <div style={{ fontFamily: uiFont, fontWeight: 600, fontSize: font, lineHeight: 1.2, whiteSpace: 'nowrap', color }}>
      {children}
    </div>
  );
}

/**
 * A chat bubble in the brand's shapes, not a messenger's: the other one's is
 * a pale sticker with an ink outline, ours is red. No avatar, time or ticks.
 */
function Bubble({
  side,
  left,
  top,
  width,
  height,
  padX,
  s,
  style,
  children,
}: {
  side: 'left' | 'right';
  left: number;
  top: number;
  width?: number;
  height: number;
  padX: number;
  s: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const round = 48 * s;
  const tight = 12 * s;
  const ours = side === 'right';
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        boxSizing: 'border-box',
        padding: `0 ${padX}px`,
        borderRadius: ours ? `${round}px ${round}px ${tight}px ${round}px` : `${round}px ${round}px ${round}px ${tight}px`,
        background: ours ? light.accent : light.surface,
        border: ours ? undefined : `${5 * s}px solid ${light.ink}`,
        boxShadow: `0 ${9 * s}px 0 ${ours ? light.accentEdge : light.ink}`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'visible',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The everyday answer, letter by letter, with the cursor after it; the shout blows the letters out of the frame. */
function Typed({ text, font, blow, s }: { text: string; font: number; blow: { x: number; y: number }; s: number }) {
  const frame = useCurrentFrame();
  const letters = [...text];
  const blink = frame < beats.shout && frame % 20 < 12;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: font,
        lineHeight: 1.2,
        color: light.background,
        whiteSpace: 'pre',
      }}
    >
      {letters.map((letter, i) => {
        // The letters next to Рупор go first.
        const start = beats.shout + 1 + (i / letters.length) * 6;
        const t = interpolate(frame, [start, start + 17], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        if (t === 1) return <span key={i} style={{ width: charInEm(letter) * font }} />;
        const side = i % 2 === 0 ? 1 : -1;
        return (
          <span
            key={i}
            style={{
              width: charInEm(letter) * font,
              display: 'inline-block',
              textAlign: 'center',
              translate: `${blow.x * t * 1000 * s + side * t * 40 * s}px ${blow.y * t * 1000 * s - Math.sin(t * Math.PI) * 60 * s}px`,
              rotate: `${side * t * (220 + (i % 3) * 70)}deg`,
              // Cream on the bubble, ink once it is over the cream background.
              color: interpolateColors(t, [0, 0.12], [light.background, light.ink]),
              opacity: interpolate(t, [0.8, 1], [1, 0], clamp),
            }}
          >
            {letter}
          </span>
        );
      })}
      <span
        style={{
          width: 5 * s,
          height: font * 1.05,
          marginLeft: 9 * s,
          borderRadius: 3 * s,
          background: light.background,
          opacity: blink ? 1 : 0,
        }}
      />
    </div>
  );
}

/** «надіслати?»: the doubt under the answer, gone on the shout. */
function Doubt({ top, safe, s }: { top: number; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.doubt || frame >= beats.shout + 4) return null;
  const come = interpolate(frame, [beats.doubt, beats.doubt + 6], [0, 1], clamp);
  const go = interpolate(frame, [beats.shout, beats.shout + 4], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width - 12 * s,
        top,
        textAlign: 'right',
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: 42 * s,
        lineHeight: 1.2,
        color: light.muted,
        opacity: come * go,
        translate: `0px ${(1 - come) * 10 * s}px`,
      }}
    >
      {texts.send}
    </div>
  );
}

/** The Stress mark: it falls on the stressed tile last, once the word is whole. */
function StressMark({ left, top, tile, from, s }: { left: number; top: number; tile: number; from: number; s: number }) {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const fall = interpolate(frame, [from, from + 6], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const bump = interpolate(frame, [from + 6, from + 9, from + 14], [1, 1.25, 1], clamp);
  const markWidth = tile * 0.17;
  const markHeight = tile * 0.5;
  return (
    <div
      style={{
        position: 'absolute',
        // The mark leans right: its foot stands over the middle of the tile.
        left: left + tile / 2 - markWidth / 2 + markHeight * 0.14,
        top: top - markHeight - 4 * s - (1 - fall) * 150 * s,
        width: markWidth,
        height: markHeight,
        borderRadius: markWidth / 2,
        background: light.background,
        rotate: '35deg',
        scale: String(bump),
        opacity: interpolate(frame, [from, from + 2], [0, 1], clamp),
      }}
    />
  );
}

/** The third bubble: the other one likes the word. */
function Praise({
  text,
  top,
  height,
  font,
  padX,
  from,
  safe,
  s,
}: {
  text: string;
  top: number;
  height: number;
  font: number;
  padX: number;
  from: number;
  safe: Safe;
  s: number;
}) {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const come = interpolate(frame, [from, from + 8], [0, 1], { ...clamp, easing: pop });
  return (
    <Bubble side="left" left={safe.left} top={top} height={height} padX={padX} s={s} style={{ scale: String(come), transformOrigin: 'left bottom' }}>
      <Line font={font} color={light.ink}>
        {text}
      </Line>
    </Bubble>
  );
}

/** The word in lower case with its Stress mark, and what it means: right of Рупор, in his band. */
function Meaning({
  episode,
  left,
  top,
  height,
  from,
  safe,
  s,
}: {
  episode: Episode;
  left: number;
  top: number;
  height: number;
  from: number;
  safe: Safe;
  s: number;
}) {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const come = interpolate(frame, [from, from + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // One line: as big as the room right of Рупор lets it be.
  const font = Math.min(46 * s, ((safe.right - left) * 0.99) / onestInEm(episode.meaning));
  if (font < 40 * s) throw new Error(`«${episode.meaning}» is too long for one line`);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        width: safe.right - left,
        top,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: come,
        translate: `0px ${(1 - come) * 20 * s}px`,
      }}
    >
      <div style={{ fontFamily: wordFont, fontWeight: 800, fontSize: 64 * s, lineHeight: 1.25, color: light.accent }}>
        <Accented text={episode.nicer} at={episode.stress} />
      </div>
      <div
        style={{
          marginTop: 10 * s,
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: font,
          lineHeight: 1.2,
          color: light.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {episode.meaning}
      </div>
    </div>
  );
}

/** A word with the Stress mark drawn over its letter `at`: the mark is ours, not a combining acute. */
function Accented({ text, at }: { text: string; at: number }) {
  const letters = [...text];
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {letters.slice(0, at).join('')}
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {letters[at]}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '-0.08em',
            width: '0.1em',
            height: '0.3em',
            marginLeft: '-0.02em',
            borderRadius: '0.05em',
            background: 'currentColor',
            rotate: '35deg',
          }}
        />
      </span>
      {letters.slice(at + 1).join('')}
    </span>
  );
}

/** «Перешли в чат замість відповіді.»: the call, once the chat has faded out. */
function Call({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.call) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: 610 * s,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: 84 * s,
        lineHeight: 1.16,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {texts.call.map((line, i) => {
        const start = beats.call + i * 4;
        const come = interpolate(frame, [start, start + 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        return (
          <div
            key={line}
            style={{
              color: i === 0 ? light.ink : light.accent,
              opacity: interpolate(frame, [start, start + 4], [0, 1], clamp),
              translate: `0px ${(1 - come) * 70 * s}px`,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

/** The plate on top: the series' name, down from the first frame. */
function Title({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  const settle = interpolate(frame, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', left: safe.left + 8 * s, top: 276 * s }}>
      <div
        style={{
          height: 100 * s,
          padding: `0 ${30 * s}px`,
          borderRadius: 20 * s,
          background: light.ink,
          boxShadow: `0 ${9 * s}px 0 rgba(20, 12, 10, 0.28)`,
          color: light.background,
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: 52 * s,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          rotate: `${-3 - (1 - settle) * 1.5}deg`,
          transformOrigin: 'left center',
          translate: `0px ${(1 - settle) * 10 * s}px`,
        }}
      >
        {texts.title.toUpperCase()}
      </div>
    </div>
  );
}

/** The rings of the shout, going from the megaphone towards the answer. */
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
              scale: String(0.6 + t * 5),
              opacity: 1 - t,
            }}
          />
        );
      })}
    </>
  );
}

/** Рупор: he looks into the frame at the doubt, leans back for air, shouts up at the answer, is glad, and hops on the call. */
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
  if (frame < beats.doubt - 6) return null;
  const enter = interpolate(frame, [beats.doubt - 6, beats.doubt + 20], [-(rupor.left + width), 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
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
  const sinceCall = frame - beats.call;
  const hop = sinceCall >= 0 && sinceCall < 24 ? -Math.abs(Math.sin((sinceCall / 12) * Math.PI)) * 34 * s * (1 - sinceCall / 24) : 0;
  const state = frame < beats.inhale ? 'surprised' : frame < beats.shout ? 'waits' : frame < solved ? 'shouts' : 'happy';
  return (
    <div
      style={{
        position: 'absolute',
        left: rupor.left,
        top: rupor.top,
        width,
        height,
        translate: `${enter + shake}px ${hop}px`,
        rotate: `${rotate}deg`,
        scale: `${squeeze} 1`,
      }}
    >
      <Rupor state={state} width={width} />
    </div>
  );
}
