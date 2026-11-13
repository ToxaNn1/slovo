import { AbsoluteFill, Audio, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';

import flapSound from '../../sounds/flap.wav';
import { EndCardAt, endCardFrom } from '../EndCard';
import { widthInEm } from '../fix/advance';
import { light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { type Safe, tileSizeFor, useSafe } from '../safe';
import { Bed, Horn, levels, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { clamp, pop } from '../shared/motion';


/** One card of the roulette. */
export type Card = {
  /** The lemma with its Stress mark as a combining acute (U+0301) after the stressed vowel. */
  word: string;
  /** Two or three words under the tiles while the cards flick. */
  gloss: string;
};

/** One episode of «Стоп-кадр»: eight words of one theme, the roulette stops on one of them. */
export type Episode = {
  /** The question, one string per line; it stands from the first frame. */
  title: readonly string[];
  /** What the question flips into once the roulette stops; the word answers it. */
  result: readonly string[];
  cards: readonly Card[];
  /** The word the roulette stops on, as written in `cards`. */
  final: string;
  /** The final word's meaning in full, shown once the roulette has stopped: one line, about 33 characters at most. */
  meaning: string;
  /** The call to the comments, big. */
  ask: string;
  /** The recording of the final word, once there is one (SOUNDS.md). */
  voice?: string;
};

/**
 * The episodes. Every word is an Entry of the UA Edition (editions/uk/content/words),
 * the Stress is the Entry's own, and the glosses shorten the Entry's first
 * definition without changing it: the video and the app must say the same.
 */
export const episodes: readonly Episode[] = [
  {
    title: ['Хто ти', 'сьогодні?'],
    result: ['Рупор', 'сьогодні\u00A0—'],
    cards: [
      // w_3h2ihu «Той, хто любить гуляти, проводити час, влаштовуючи легковажні витівки…; гуляка.»
      { word: 'гульві́са', gloss: 'любить погуляти' },
      // w_c48seg «Людина, яка любить спати, багато спить.»
      { word: 'сонько́', gloss: 'любить поспати' },
      // w_6ia2wr «Дотепна людина.»
      { word: 'доте́пник', gloss: 'жартує влучно' },
      // w_ti77yy «Ледача людина; ледар.»
      { word: 'ледацю́га', gloss: 'сьогодні ледарює' },
      // w_pgpivz «Той, хто спритно, уміло робить що-небудь, вправний у чому-небудь.»
      { word: 'штука́р', gloss: 'спритний і вправний' },
      // w_6yfvmc «Людина, яка звикла до чистоти й акуратності в усьому.»
      { word: 'чепуру́н', gloss: 'любить чистоту й лад' },
      // w_8kni5r «Той, хто любить багато говорити, базікати.»
      { word: 'базі́ка', gloss: 'балакає без упину' },
      // w_cdhl8d «Той, хто своєю поведінкою і вчинками викликає здивування.»
      { word: 'дива́к', gloss: 'дивує всіх довкола' },
    ],
    final: 'гульві́са',
    meaning: 'гуляка, любить легковажні витівки',
    ask: 'А ти хто?',
  },
  {
    title: ['Яка сьогодні', 'погода в тебе', 'в голові?'],
    result: ['У Рупора', 'сьогодні\u00A0—'],
    cards: [
      // w_q8ot2t «Легкий приємний вітерець.»
      { word: 'ле́гіт', gloss: 'легкий вітерець' },
      // w_olmlqv «…дрібний, густий дощ; мряка.»
      { word: 'мжи́чка', gloss: 'дрібний густий дощ' },
      // w_lhocqh «Дуже сильний вітер; ураган.»
      { word: 'буреві́й', gloss: 'дуже сильний вітер' },
      // w_8juf5j «Тепла погода взимку або ранньою весною…»
      { word: 'відли́га', gloss: 'тепло серед зими' },
      // w_dz03m0 «Дуже сильний дощ.»
      { word: 'зли́ва', gloss: 'дуже сильний дощ' },
      // w_z7k74h «Велика спека.» (the Entry allows спеко́та and спекота́)
      { word: 'спеко́та', gloss: 'велика спека' },
      // w_av3svs «Сильний вітер зі снігом; хуртовина.»
      { word: 'заметі́ль', gloss: 'вітер зі снігом' },
      // w_56a65a «Хмарна, сира погода з дощем або мокрим снігом, із багном на землі…»
      { word: 'сльота́', gloss: 'сиро, дощ і багно' },
    ],
    final: 'ле́гіт',
    meaning: 'легкий приємний вітерець',
    ask: 'А в тебе що?',
  },
];

/** The texts every episode shares. */
export const texts = {
  brand: 'SLOVO',
  hint: 'Тисни на екран',
  comments: 'Пиши в коментарях',
  again: 'Не подобається?\nТисни ще раз.',
  // The no-break spaces keep the dash off the start of the second line and «у» off the end of the first.
  endLine: 'Сотні таких слів\u00A0— у\u00A0застосунку.',
} as const;

/**
 * How long one card stands while the roulette runs, in frames. Four is the
 * least that survives the platforms' re-encoding as a clean frame to pause on;
 * try five if an upload shows smeared cards (the stop then moves later).
 */
export const flick = 4;
/** Full rounds of the cards at full speed. */
const rounds = 5;
/** How long the last cards stand as the roulette slows down. */
const slowing = [6, 9, 14] as const;

/** The beats in frames at 30 fps for an episode of `count` cards: 15 s in all with eight. */
export function beatsFor(count: number) {
  const slow = rounds * count * flick;
  const stop = slow + slowing.reduce((sum, hold) => sum + hold, 0);
  return {
    /** Рупор's quiet shout under the roulette. */
    horn: 18,
    /** The roulette slows down. */
    slow,
    /** It stops: the word stays, the question flips into the answer's lead-in. */
    stop,
    /** «А ти хто? Пиши в коментарях»: in view for 2.4 s before the end card. */
    ask: stop + 54,
    comments: stop + 64,
    again: stop + 76,
    length: stop + 126 + 135,
  };
}

/** Every episode shows this many cards: the beats and the length are fixed for it. */
const CARDS = 8;

export const beats = beatsFor(CARDS);
export const stopFrameLength = beats.length;
const end = endCardFrom(beats.length);

/** The frames the card changes on, the first card on frame 0, the last change on the stop. */
function changesFor(count: number) {
  const { slow } = beatsFor(count);
  const frames: number[] = [];
  for (let f = 0; f < slow; f += flick) frames.push(f);
  let f = slow;
  for (const hold of slowing) {
    f += hold;
    frames.push(f);
  }
  return frames;
}

/** Which card is up on `frame`, counted in changes from the first one. */
function changeAt(frame: number, changes: readonly number[]) {
  let index = 0;
  for (let i = 0; i < changes.length; i++) if (frame >= (changes[i] ?? 0)) index = i;
  return index;
}

/** A word's letters in capitals and the index of its stressed one. */
function lettersOf(word: string) {
  const letters: string[] = [];
  let stressed = -1;
  for (const char of word) {
    if (char === '\u0301') stressed = letters.length - 1;
    else letters.push(char.toUpperCase());
  }
  return { letters, stressed };
}

export type StopFrameProps = {
  /** Which of `episodes` to play, counted from 0. */
  episode?: number;
};

/**
 * «Стоп-кадр»: one 15 s 9:16 video per episode. A card of words flicks too
 * fast to read; the viewer pauses the video and gets a word. Left alone, the
 * roulette slows down and stops by itself, Рупор gets his word, then the
 * call to the comments and the end card. Only the card changes: the frame
 * around it never flashes.
 */
export function StopFrame({ episode = 0 }: StopFrameProps) {
  const item = episodes[episode] ?? episodes[0];
  if (item === undefined) return null;
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={end} name="Stop frame">
        <Scene episode={item} />
      </Sequence>
      <EndCardAt from={end} line={texts.endLine} />
      <StopFrameSound episode={item} />
    </AbsoluteFill>
  );
}

/** The sounds: the bed and its beat from the first frame, a quiet flap on every card, lower as it slows, the chime on the stop. */
export function StopFrameSound({ episode }: { episode: Episode }) {
  const changes = changesFor(episode.cards.length);
  const fast = changes.length - slowing.length;
  return (
    <>
      <Bed beatFrom={0} />
      <Sfx src={sfx.stamp} at={0} volume={0.7} />
      <Horn at={beats.horn} volume={levels.horn * 0.6} />
      {changes.map((at, i) => {
        if (i === 0) return null;
        const late = i - fast;
        return (
          <Sequence key={at} from={at} layout="none" name="Flap">
            <Audio
              src={flapSound}
              volume={late < 0 ? 0.22 : 0.4 + late * 0.1}
              playbackRate={late < 0 ? 1 : 0.9 - late * 0.1}
            />
          </Sequence>
        );
      })}
      <Sfx src={sfx.chime} at={beats.stop} volume={0.6} />
      <Sfx src={sfx.pop} at={beats.stop + 2} volume={0.5} />
      <Sfx src={sfx.chord} at={beats.stop + 8} volume={0.35} />
      {/* «Рупор вимовляє слово»: nothing is recorded yet (SOUNDS.md). */}
      <Voice src={episode.voice} at={beats.stop + 8} />
      <Sfx src={sfx.swish} at={beats.ask - 2} volume={0.4} />
      <Sfx src={sfx.pop} at={beats.comments} volume={0.5} />
    </>
  );
}

/** The layout in units of the 1080×1920 frame; everything stays inside the safe zone (safe.ts). */
const box = {
  brand: 250,
  title: { top: 318, height: 204 },
  hint: { top: 550, height: 80 },
  // Above the frame's middle: TikTok draws its pause triangle there.
  card: { top: 660, height: 280 },
  ask: 972,
} as const;

function Scene({ episode }: { episode: Episode }) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const count = episode.cards.length;
  if (count !== CARDS) throw new Error(`An episode has ${CARDS} cards, not ${count}`);
  const changes = changesFor(count);
  const finalIndex = episode.cards.findIndex((card) => card.word === episode.final);
  if (finalIndex === -1) throw new Error(`«${episode.final}» is not one of the episode's cards`);
  // The first card is chosen so that the last change lands on the final word.
  const first = (((finalIndex - (changes.length - 1)) % count) + count) % count;
  const change = changeAt(frame, changes);
  const card = episode.cards[(first + change) % count] ?? episode.cards[0];
  const stopped = frame >= beats.stop;

  // Рупор stands at the left of his band and shouts up at the card.
  const ruporWidth = 320 * s;
  const ruporHeight = (ruporWidth * 112) / 150;
  const rupor = { left: safe.left + 36 * s, top: safe.rupor.bottom - ruporHeight - 12 * s };
  const aim = -34;
  const center = { x: rupor.left + ruporWidth / 2, y: rupor.top + ruporHeight / 2 };
  const angle = (aim * Math.PI) / 180;
  const dx = ruporWidth * 0.49;
  const dy = ruporWidth * 0.4 - ruporHeight / 2;
  const mouth = {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
  const target = { x: safe.centerX + 120 * s, y: (box.card.top + box.card.height) * s };

  if (card === undefined) return null;
  return (
    <AbsoluteFill>
      <Rings mouth={mouth} target={target} s={s} />
      <Shouter rupor={rupor} width={ruporWidth} aim={aim} s={s} />
      <div
        style={{
          position: 'absolute',
          left: safe.left,
          top: box.brand * s,
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
      <Title episode={episode} safe={safe} s={s} />
      <Hint safe={safe} s={s} />
      <WordCard
        episode={episode}
        card={card}
        meaning={stopped ? episode.meaning : undefined}
        // Every change is a hard cut; only the last card settles with a bounce.
        landed={stopped ? frame - beats.stop : undefined}
        safe={safe}
        s={s}
      />
      <Ask episode={episode} safe={safe} s={s} ruporRight={rupor.left + ruporWidth} />
    </AbsoluteFill>
  );
}

/** The question in ink, already stamped on the first frame; on the stop it flips into the answer's lead-in. */
function Title({ episode, safe, s }: { episode: Episode; safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  const answered = frame >= beats.stop + 4;
  const lines = answered ? episode.result : episode.title;
  const widest = Math.max(...lines.map((line) => widthInEm(line)));
  const lineHeight = 1.08;
  const font = Math.min(96 * s, safe.width / widest, (box.title.height * s) / (lines.length * lineHeight));
  const stamp = interpolate(frame, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const flip = interpolate(frame, [beats.stop, beats.stop + 4, beats.stop + 8], [1, 0.04, 1], clamp);
  const bump = interpolate(frame, [beats.stop + 8, beats.stop + 11, beats.stop + 16], [1, 1.05, 1], clamp);
  const press = 1 + (1 - stamp) * 0.03;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: box.title.top * s,
        height: box.title.height * s,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: font,
        lineHeight,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        color: light.ink,
        scale: `${bump * press} ${bump * press * flip}`,
      }}
    >
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

/** «Тисни на екран»: the red plate under the question, pulsing until the roulette stops by itself. */
function Hint({ safe, s }: { safe: Safe; s: number }) {
  const frame = useCurrentFrame();
  if (frame >= beats.stop + 5) return null;
  const pulse = 1 + Math.sin((frame / 15) * Math.PI) * 0.035;
  const leave = interpolate(frame, [beats.stop, beats.stop + 5], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: box.hint.top * s,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          height: box.hint.height * s,
          padding: `0 ${40 * s}px`,
          borderRadius: (box.hint.height / 2) * s,
          background: light.accent,
          boxShadow: `0 ${7 * s}px 0 ${light.accentEdge}`,
          color: light.background,
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 50 * s,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 18 * s,
          scale: String(pulse * leave),
        }}
      >
        <PauseSign size={34 * s} />
        {texts.hint}
      </div>
    </div>
  );
}

/** Two bars: what the tap does. */
function PauseSign({ size }: { size: number }) {
  const bar = { width: size * 0.3, height: size, borderRadius: size * 0.08, background: light.background };
  return (
    <div style={{ display: 'flex', gap: size * 0.26 }}>
      <div style={bar} />
      <div style={bar} />
    </div>
  );
}

/**
 * The card: the word in red tiles, the stressed tile in ink under its Stress
 * mark, the meaning below. The plate and the tile size are the same for every
 * word of an episode, so only the letters change from card to card.
 */
function WordCard({
  episode,
  card,
  meaning,
  landed,
  safe,
  s,
}: {
  episode: Episode;
  card: Card;
  meaning?: string;
  landed?: number;
  safe: Safe;
  s: number;
}) {
  const { letters, stressed } = lettersOf(card.word);
  const padding = 28 * s;
  const gap = 0.12;
  const longest = Math.max(...episode.cards.map((item) => lettersOf(item.word).letters.length));
  const tile = tileSizeFor(longest, safe.width - 2 * padding, gap, 100 * s);
  const settle =
    landed === undefined ? 1 : interpolate(landed, [0, 9], [1.14, 1], { ...clamp, easing: pop });
  const tilesTop = 56 * s;
  const below = tilesTop + tile * 1.08 + 10 * s;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: box.card.top * s,
        height: box.card.height * s,
        boxSizing: 'border-box',
        borderRadius: 32 * s,
        background: light.surface,
        border: `${5 * s}px solid ${light.ink}`,
        boxShadow: `0 ${10 * s}px 0 ${light.ink}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: tilesTop,
          display: 'flex',
          justifyContent: 'center',
          gap: tile * gap,
          scale: String(settle),
          transformOrigin: 'center center',
        }}
      >
        {letters.map((letter, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <Tile
              letter={letter}
              size={tile}
              face={i === stressed ? light.ink : light.accent}
              edge={i === stressed ? light.muted : light.accentEdge}
              ink={light.background}
            />
            {i === stressed && (
              <div
                style={{
                  position: 'absolute',
                  left: tile / 2 - tile * 0.07 + tile * 0.06,
                  top: -tile * 0.44,
                  width: tile * 0.14,
                  height: tile * 0.36,
                  borderRadius: tile * 0.07,
                  background: light.accent,
                  rotate: '35deg',
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: padding,
          right: padding,
          top: below,
          bottom: 8 * s,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          whiteSpace: 'pre-line',
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: (meaning === undefined ? 52 : 44) * s,
          lineHeight: 1.14,
          color: light.ink,
        }}
      >
        {meaning ?? card.gloss}
      </div>
    </div>
  );
}

/** The call to the comments under the card, and the second try next to Рупор. */
function Ask({ episode, safe, s, ruporRight }: { episode: Episode; safe: Safe; s: number; ruporRight: number }) {
  const frame = useCurrentFrame();
  if (frame < beats.ask) return null;
  const at = (start: number) => interpolate(frame, [start, start + 9], [0, 1], { ...clamp, easing: pop });
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: safe.left,
          width: safe.width,
          top: box.ask * s,
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
        <div style={{ fontSize: 92 * s, color: light.ink, scale: String(at(beats.ask)) }}>{episode.ask}</div>
        <div
          style={{
            marginTop: 10 * s,
            fontSize: 54 * s,
            color: light.accent,
            rotate: '-2deg',
            scale: String(at(beats.comments)),
          }}
        >
          {texts.comments}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: ruporRight + 40 * s,
          right: `calc(100% - ${safe.right}px)`,
          top: 1236 * s,
          whiteSpace: 'pre-line',
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 46 * s,
          lineHeight: 1.2,
          color: light.ink,
          opacity: interpolate(frame, [beats.again, beats.again + 8], [0, 1], clamp),
          translate: `0px ${(1 - at(beats.again)) * 20 * s}px`,
        }}
      >
        {texts.again}
      </div>
    </>
  );
}

/** The rings of the shout: they leave the megaphone towards the card for as long as the roulette runs at full speed. */
function Rings({ mouth, target, s }: { mouth: { x: number; y: number }; target: { x: number; y: number }; s: number }) {
  const frame = useCurrentFrame();
  const every = 12;
  const life = 26;
  const rings: number[] = [];
  for (let born = -every * 2; born < beats.slow - 8; born += every) {
    if (frame > born && frame < born + life) rings.push(born);
  }
  const size = 90 * s;
  return (
    <>
      {rings.map((born) => {
        const t = (frame - born) / life;
        return (
          <div
            key={born}
            style={{
              position: 'absolute',
              left: mouth.x + (target.x - mouth.x) * t * 0.62 - size / 2,
              top: mouth.y + (target.y - mouth.y) * t * 0.62 - size / 2,
              width: size,
              height: size,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `${9 * s}px solid ${light.accent}`,
              scale: String(0.5 + t * 2.4),
              opacity: 1 - t,
            }}
          />
        );
      })}
    </>
  );
}

/** Рупор: he shouts and trembles while the cards flick, falls silent and watches them slow down, celebrates his word, then turns glad to the viewer. */
function Shouter({
  rupor,
  width,
  aim,
  s,
}: {
  rupor: { left: number; top: number };
  width: number;
  aim: number;
  s: number;
}) {
  const frame = useCurrentFrame();
  const state =
    frame < beats.slow ? 'shouts' : frame < beats.stop ? 'surprised' : frame < beats.ask ? 'celebrates' : 'happy';
  const glad = -5 + Math.sin(frame / 8) * 3;
  const rotate =
    frame < beats.slow
      ? aim
      : frame < beats.stop
        ? interpolate(frame, [beats.slow, beats.slow + 6], [aim, aim + 8], clamp)
        : interpolate(frame, [beats.stop, beats.stop + 8], [aim + 8, glad], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tremble = frame < beats.slow ? { x: Math.sin(frame * 2.2) * 5 * s, y: Math.cos(frame * 1.7) * 3 * s } : { x: 0, y: 0 };
  const since = frame - beats.stop;
  const hop = since >= 0 && since < 36 ? -Math.abs(Math.sin((since / 12) * Math.PI)) * 40 * s * (1 - since / 36) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: rupor.left,
        top: rupor.top,
        translate: `${tremble.x}px ${tremble.y + hop}px`,
        rotate: `${rotate}deg`,
      }}
    >
      <Rupor state={state} width={width} />
    </div>
  );
}
