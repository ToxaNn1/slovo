import type { ComponentType } from 'react';
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';

import { EndCardAt } from '../EndCard';
import { dark, light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { tileSizeFor, useSafe } from '../safe';
import { Bed, Horn, hornLength, Knock, levels, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { clamp, pop } from '../shared/motion';

/** The beats of an episode in frames at 30 fps, 15 s in all; an episode's scene times itself by them. */
export const beats = {
  /** The situation plays; its caption is there from the first frame. */
  setup: 0,
  /** «ну… як його…»: the word is missing; the line types in. */
  hesitate: 84,
  /** Рупор bursts in from the left. */
  ruporIn: 150,
  /** Рупор shouts the word: the first tile leaves the megaphone. The bed's beat starts here. */
  shout: 165,
  /** The first tile hits the scene's subject: the scene answers from here. */
  hit: 173,
  /** The scene has left the frame: the word card's lines come in under the tiles. */
  word: 208,
  /** The end card: 4.6 s of it. */
  end: 312,
  length: 450,
} as const;

/** A tile leaves the megaphone every `step` frames, flies `flight` to the subject and bounces `bounce` more to its place in the row. */
const tiles = { step: 2, flight: beats.hit - beats.shout, bounce: 14 } as const;

/** The frames the i-th tile leaves the megaphone, hits the subject and lands in the row. */
const leaveAt = (i: number) => beats.shout + i * tiles.step;
const hitAt = (i: number) => leaveAt(i) + tiles.flight;
const landAt = (i: number) => hitAt(i) + tiles.bounce;

/** The hesitation types a letter every 1.5 frames and stops for a moment after each «…». */
const typing = { perLetter: 1.5, pause: 8 } as const;

/** How many letters of `text` are typed `frame` frames in, and the frame the last one is. */
function typedAt(text: string, frame: number) {
  let at = 0;
  let shown = 0;
  for (const letter of text) {
    if (at > frame) break;
    shown += letter.length;
    at += typing.perLetter + (letter === '…' ? typing.pause : 0);
  }
  return frame < 0 ? 0 : shown;
}
const typedLength = (text: string) =>
  Math.ceil(
    [...text].reduce(
      (sum, letter) => sum + typing.perLetter + (letter === '…' ? typing.pause : 0),
      0,
    ),
  );

/** The part of an Edition Word an episode shows, as the words JSON writes it. */
export type Word = {
  lemma: string;
  /** Character positions of the stressed vowels in the lemma, from 0. */
  stress: readonly number[];
};

export type MissingProps = {
  word: Word;
  /** The situation, in view from the first frame; `\n` breaks the line. */
  setup: string;
  /** The line that stops short of the word; `\n` breaks the line. */
  hesitation: string;
  /** The same line with the word found: what comes before the word, and the word with its mark. */
  reply: readonly [before: string, withWord: string];
  /** The word's meaning as the video words it: the advert's own short line, not the Entry's. */
  meaning: string;
  /** Where the scene's subject stands, in pixels of the 1080×1920 frame: the tiles hit it. */
  target: { x: number; y: number };
  /** The situation: it answers the hit at `beats.hit`, is gone by `beats.word` and brings its own sounds. */
  Scene: ComponentType;
  /** The recorded word, once there is one (SOUNDS.md). */
  voice?: string;
};

/**
 * «Тобі бракувало слова»: one 15 s 9:16 episode, one shot. A situation,
 * someone stuck at «ну… як його…», Рупор shouts the missing word: its
 * tiles fly out of the megaphone, hit the scene's subject and bounce up
 * into a row; under it the line with the word found and its meaning; the
 * shared end card. Everything stays in the 9:16 safe zone, Рупор in his band.
 */
export function Missing({
  word,
  setup,
  hesitation,
  reply,
  meaning,
  target,
  Scene,
  voice,
}: MissingProps) {
  const letters = [...word.lemma];
  const typed = typedLength(hesitation);
  return (
    <AbsoluteFill style={{ background: light.background }}>
      <Sequence durationInFrames={beats.end} name="Situation">
        <Sequence durationInFrames={beats.word} name="Scene">
          <Scene />
        </Sequence>
        <Lines setup={setup} hesitation={hesitation} />
        <Shouter />
        <WordCard word={word} reply={reply} meaning={meaning} target={target} />
      </Sequence>
      <EndCardAt from={beats.end} line="Знайди слово, якого тобі бракувало." />
      <Bed beatFrom={beats.shout} />
      {/* The hesitation typing in: a quiet tick every other letter, then a muffled, unsure pluck. */}
      {Array.from({ length: Math.floor(typed / 4) }, (_, k) => (
        <Sfx key={k} src={sfx.flap} at={beats.hesitate + k * 4} volume={0.2} />
      ))}
      <Sfx src={sfx.miss} at={beats.hesitate + typed + 2} volume={0.3} />
      <Sfx src={sfx.whoosh} at={beats.ruporIn - 2} volume={0.55} />
      <Horn at={beats.shout} />
      {/* «Рупор вимовляє слово»: right after the shout, under the tiles landing. Nothing is recorded yet (SOUNDS.md). */}
      <Voice src={voice} at={beats.shout + hornLength} />
      {letters.map((_, i) => (
        <Knock key={i} index={i} at={landAt(i)} volume={0.7} />
      ))}
      <Sfx src={sfx.pluck} at={stressLands(letters.length)} volume={levels.stress} />
      <Sfx src={sfx.pop} at={beats.word + 4} volume={0.4} />
    </AbsoluteFill>
  );
}

/** The Stress mark starts to fall once the last tile has landed, and lands on its tile. */
const stressFalls = (count: number) => landAt(count - 1) + 3;
const stressLands = (count: number) => stressFalls(count) + 8;

/** The situation's caption, whole from the first frame, then the hesitation typed in its place until the word hits. */
function Lines({ setup, hesitation }: { setup: string; hesitation: string }) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  if (frame >= beats.hit + 6) return null;
  const hesitating = frame >= beats.hesitate;
  const shown = typedAt(hesitation, frame - beats.hesitate);
  const caret = hesitating && Math.floor(frame / 8) % 2 === 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: safe.left,
        width: safe.width,
        top: safe.top + 16 * s,
        textAlign: 'center',
        whiteSpace: 'pre-line',
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: (hesitating ? 76 : 84) * s,
        lineHeight: 1.16,
        letterSpacing: '0.01em',
        color: light.ink,
        opacity: interpolate(frame, [beats.hit, beats.hit + 6], [1, 0], clamp),
      }}
    >
      {hesitating ? (
        <>
          {hesitation.slice(0, shown)}
          <span style={{ opacity: caret ? 1 : 0, color: light.accent }}>▍</span>
          {/* The untyped rest keeps the line where it will be. */}
          <span style={{ opacity: 0 }}>{hesitation.slice(shown)}</span>
        </>
      ) : (
        setup
      )}
    </div>
  );
}

/** Where Рупор stands in his band, and where his megaphone's mouth is, in frame pixels. */
function useRupor() {
  const { s, safe } = useSafe();
  const width = 420 * s;
  const height = (width * 112) / 150;
  const tilt = -16;
  const left = safe.left + 10 * s;
  const top = (safe.rupor.top + safe.rupor.bottom) / 2 - height / 2;
  // The mouth sits at (0.99, 0.4) of his width; the tilt swings it around his middle.
  const a = (tilt * Math.PI) / 180;
  const dx = width * 0.99 - width / 2;
  const dy = width * 0.4 - height / 2;
  const mouth = {
    x: left + width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: top + height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
  };
  return { width, left, top, tilt, mouth };
}

/** Рупор bursts into his band, shouts up at the scene, then is glad beside the word. */
function Shouter() {
  const frame = useCurrentFrame();
  const { s } = useSafe();
  const { width, left, top, tilt, mouth } = useRupor();
  if (frame < beats.ruporIn) return null;
  const enter = interpolate(frame, [beats.ruporIn, beats.shout], [-700 * s, 0], {
    ...clamp,
    easing: pop,
  });
  const shake = frame > beats.shout && frame < beats.shout + 24 ? Math.sin(frame * 2.2) * 8 * s : 0;
  const calm = frame >= beats.word;
  return (
    <AbsoluteFill>
      {[0, 1, 2].map((ring) => {
        const t = interpolate(
          frame,
          [beats.shout + ring * 6, beats.shout + 30 + ring * 6],
          [0, 1],
          clamp,
        );
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
          rotate: calm ? `${-4 + Math.sin(frame / 8) * 3}deg` : `${tilt}deg`,
        }}
      >
        <Rupor state={calm ? 'happy' : 'shouts'} width={width} />
      </div>
    </AbsoluteFill>
  );
}

/**
 * The word: its tiles fly from the megaphone to the subject, bounce off it
 * into a row, the Stress mark falls on its vowel; under the row the line
 * with the word found and, smaller, its meaning.
 */
function WordCard({
  word,
  reply,
  meaning,
  target,
}: Pick<MissingProps, 'word' | 'reply' | 'meaning' | 'target'>) {
  const frame = useCurrentFrame();
  const { s, safe } = useSafe();
  const { mouth } = useRupor();
  const letters = [...word.lemma.toUpperCase()];
  const gap = 0.12;
  const size = tileSizeFor(letters.length, safe.rowWidth, gap, 112 * s);
  const total = letters.length * size + (letters.length - 1) * size * gap;
  const rowLeft = safe.centerX - total / 2;
  const rowTop = safe.top + 190 * s;
  const line = interpolate(frame, [beats.word + 4, beats.word + 14], [0, 1], {
    ...clamp,
    easing: pop,
  });
  const small = interpolate(frame, [beats.word + 16, beats.word + 26], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {letters.map((letter, i) => {
        if (frame < leaveAt(i)) return null;
        // The tiles strike around the subject's middle, not all on one spot.
        const strike = {
          x: target.x * s + ((i % 3) - 1) * 46 * s - size / 2,
          y: target.y * s + (((i * 7) % 5) - 2) * 26 * s - size / 2,
        };
        const slot = { x: rowLeft + i * size * (1 + gap), y: rowTop };
        const fly = interpolate(frame, [leaveAt(i), hitAt(i)], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.quad),
        });
        const back = interpolate(frame, [hitAt(i), landAt(i)], [0, 1], {
          ...clamp,
          easing: Easing.inOut(Easing.quad),
        });
        const from = { x: mouth.x - size / 2, y: mouth.y - size / 2 };
        const x =
          back === 0 ? from.x + (strike.x - from.x) * fly : strike.x + (slot.x - strike.x) * back;
        const y =
          back === 0
            ? from.y + (strike.y - from.y) * fly
            : strike.y + (slot.y - strike.y) * back - Math.sin(back * Math.PI) * 90 * s;
        const landed = frame >= landAt(i);
        const squash = landed && frame < landAt(i) + 4 ? 0.9 : 1;
        const stressed = word.stress.includes(i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              scale: String((back === 0 ? 0.35 + 0.5 * fly : 0.85 + 0.15 * back) * squash),
              rotate: `${back === 0 ? (1 - fly) * -30 : Math.sin(back * Math.PI) * (i % 2 === 0 ? 24 : -24)}deg`,
            }}
          >
            <Tile
              letter={letter}
              size={size}
              face={stressed && landed ? light.ink : light.accent}
              edge={stressed && landed ? dark.background : light.accentEdge}
              ink={light.background}
            />
            {stressed && <Acute size={size} frame={frame} falls={stressFalls(letters.length)} />}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: safe.left,
          width: safe.width,
          top: rowTop + size + 76 * s,
          textAlign: 'center',
          fontFamily: wordFont,
          fontWeight: 800,
          fontSize: 82 * s,
          lineHeight: 1.18,
          letterSpacing: '-0.01em',
          color: light.ink,
          scale: String(line),
          opacity: line > 0 ? 1 : 0,
        }}
      >
        {reply[0]}
        <br />
        <span style={{ color: light.accent }}>{reply[1]}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: safe.left + 40 * s,
          width: safe.width - 80 * s,
          top: rowTop + size + 76 * s + 82 * 1.18 * 2 * s + 40 * s,
          textAlign: 'center',
          textWrap: 'balance',
          fontFamily: uiFont,
          fontWeight: 600,
          fontSize: 52 * s,
          lineHeight: 1.25,
          color: light.ink,
          opacity: small,
          translate: `0px ${(1 - small) * 20 * s}px`,
        }}
      >
        {meaning}
      </div>
    </AbsoluteFill>
  );
}

/** The Stress mark falling onto the stressed tile from frame `falls`; the pluck sounds as it lands. */
function Acute({ size, frame, falls }: { size: number; frame: number; falls: number }) {
  const t = interpolate(frame, [falls, falls + 8], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.quad),
  });
  const squash = interpolate(frame, [falls + 8, falls + 10, falls + 15], [1, 0.8, 1], clamp);
  if (frame < falls) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: size * 0.36,
        top: -size * 0.82,
        width: size * 0.22,
        height: size * 0.62,
        borderRadius: size * 0.11,
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
