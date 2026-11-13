import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

import { dark, light, uiFont, wordFont } from '../look';
import { Rupor } from '../Rupor';
import { tileSizeFor, useSafe } from '../safe';
import { Horn, hornLength, Knock, Sfx, sfx, Voice } from '../sound';
import { Tile } from '../Tile';
import { Crack, greyInk, mainWord } from './Forgotten';
import { clamp, pop } from '../shared/motion';


/** A forgotten tile on cream: grey, its letter still readable. */
const forgottenFace = '#D6C8B8';

/** One beat of the 120 BPM bed, in frames at 30 fps. */
export const beatFrames = 15;

/** The frames of Рупор's shout, counted from the scene's first frame. */
export type ShoutBeats = {
  /** Рупор starts to fly in; not set: he stands there from the first frame. */
  enter?: number;
  /** The shout: the first ring leaves the megaphone. The bed's beat starts here. */
  shout: number;
  /** The first tile leaves the megaphone (before the first frame: the word is already landing as the video opens); the next follow `tileStep` apart and fly `tileFlight` frames. */
  tiles: number;
  tileStep: number;
  tileFlight: number;
  /** «Це слово забули.»: the tiles go grey and crack until the stamp. Not set: they stay red. */
  forgotten?: number;
  /** «SLOVO повертає.» hits: a whole number of beats after the shout. */
  stamp: number;
};

/** The red wedge that cuts the black open diagonally and leaves cream: the first 16 frames. */
export function Wedge() {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const black = interpolate(frame, [4, 14], [0, 1], clamp);
  if (frame > 16) return null;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: dark.background,
          clipPath: `polygon(${black * 140}% 0, 100% 0, 100% 100%, ${black * 140 - 40}% 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: light.accent,
          clipPath: `polygon(${sweep * 140 - 18}% 0, ${sweep * 140}% 0, ${sweep * 140 - 40}% 100%, ${
            sweep * 140 - 58
          }% 100%)`,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Рупор shouts on cream; the letters fly out of the megaphone and land as
 * the word; «SLOVO повертає.» is stamped under it on a beat. With
 * `beats.forgotten` the word goes grey first («Це слово забули.») and the
 * stamp brings it back red. Portrait keeps it all in the safe zone, Рупор in his band.
 */
export function Shout({ beats }: { beats: ShoutBeats }) {
  const frame = useCurrentFrame();
  const { width, height, portrait, s, safe } = useSafe();
  const enter =
    beats.enter === undefined
      ? 0
      : interpolate(frame, [beats.enter, beats.shout], [-700 * s, 0], { ...clamp, easing: pop });
  const shake = frame > beats.shout && frame < beats.shout + 24 ? Math.sin(frame * 2.2) * 6 * s : 0;
  const hit = frame >= beats.stamp && frame < beats.stamp + 6 ? Math.sin((frame - beats.stamp) * 2.6) * 5 * s : 0;

  const size = portrait ? tileSizeFor(mainWord.length, safe.rowWidth, 0.12, 112 * s) : 132 * s;
  const gap = size * 0.12;
  const total = mainWord.length * size + (mainWord.length - 1) * gap;
  // Landscape: Рупор left, the word beside him; portrait: the word on top, Рупор under it in his band.
  const ruporWidth = (portrait ? 500 : 440) * s;
  const ruporHeight = (ruporWidth * 112) / 150;
  const rupor = portrait
    ? { left: safe.left + 20 * s, top: safe.rupor.bottom - ruporHeight - 10 * s }
    : { left: width * 0.04, top: height * 0.28 };
  const mouth = { x: rupor.left + ruporWidth * 0.99, y: rupor.top + ruporWidth * 0.4 };
  const wordLeft = portrait ? safe.centerX - total / 2 : (width - total) / 2 + 160 * s;
  const wordTop = portrait ? safe.top + 180 * s : height * 0.36;
  const lineTop = wordTop + size * 1.5;

  const forgotten = beats.forgotten !== undefined && frame >= beats.forgotten && frame < beats.stamp;
  const toGrey =
    beats.forgotten === undefined
      ? 0
      : interpolate(frame, [beats.forgotten, beats.forgotten + 6], [0, 1], clamp) * (frame < beats.stamp ? 1 : 0);
  const crack =
    beats.forgotten === undefined || frame >= beats.stamp
      ? 0
      : interpolate(frame, [beats.forgotten + 2, beats.forgotten + 12], [0, 1], clamp);

  // The stamp: «SLOVO повертає.» drops from big to its place in 5 frames and lands on the beat.
  const drop = interpolate(frame, [beats.stamp - 5, beats.stamp], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const settle = interpolate(frame, [beats.stamp, beats.stamp + 3, beats.stamp + 8], [0.94, 1.03, 1], clamp);
  const stampScale = frame < beats.stamp ? 2.6 - 1.6 * drop : settle;
  const stampSize = (portrait ? 124 : 112) * s;

  return (
    <AbsoluteFill style={{ background: light.background, translate: `0px ${hit}px` }}>
      {[0, 1, 2].map((ring) => {
        const t = interpolate(frame, [beats.shout + ring * 6, beats.shout + 30 + ring * 6], [0, 1], clamp);
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
              scale: String(1 + t * 9),
              opacity: t === 0 ? 0 : 1 - t,
            }}
          />
        );
      })}
      <div style={{ position: 'absolute', left: rupor.left, top: rupor.top, translate: `${enter + shake}px 0px` }}>
        <Rupor state={forgotten ? 'sad' : 'shouts'} width={ruporWidth} />
      </div>
      {[...mainWord].map((letter, i) => {
        const at = beats.tiles + i * beats.tileStep;
        const landed = at + beats.tileFlight;
        const t = interpolate(frame, [at, landed], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.8, 0.3, 1.15) });
        const x = wordLeft + i * (size + gap);
        const land = frame >= landed && frame < landed + 4 ? 0.92 : 1;
        // The stamp makes the row jump, a letter after a letter.
        const jump =
          Math.sin(interpolate(frame, [beats.stamp + i, beats.stamp + i + 8], [0, Math.PI], clamp)) * 22 * s;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: mouth.x + (x - mouth.x) * t,
              top: mouth.y + (wordTop - mouth.y) * t - Math.sin(t * Math.PI) * 120 * s - jump,
              scale: String((0.3 + 0.7 * t) * land),
              rotate: `${(1 - t) * -30}deg`,
              opacity: frame < at ? 0 : 1,
            }}
          >
            <Tile
              letter={letter}
              size={size}
              face={toGrey > 0 ? forgottenFace : light.accent}
              edge={toGrey > 0 ? light.tileEdge : light.accentEdge}
              ink={toGrey > 0 ? greyInk : light.background}
            />
            <Crack seed={`shout-${i}`} size={size} progress={crack} stroke={light.background} />
          </div>
        );
      })}
      {beats.forgotten !== undefined && forgotten && (
        <div
          style={{
            position: 'absolute',
            left: wordLeft,
            top: lineTop + 30 * s,
            fontFamily: uiFont,
            fontWeight: 600,
            fontSize: (portrait ? 76 : 64) * s,
            lineHeight: 1.15,
            color: light.ink,
            opacity: interpolate(frame, [beats.forgotten, beats.forgotten + 5], [0, 1], clamp),
          }}
        >
          Це слово забули.
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: wordLeft + 8 * s,
          top: lineTop,
          fontFamily: wordFont,
          fontWeight: 900,
          fontSize: stampSize,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          color: light.ink,
          rotate: '-3deg',
          scale: String(stampScale),
          opacity: frame < beats.stamp - 5 ? 0 : Math.min(1, 0.3 + drop),
          transformOrigin: portrait ? '45% 50%' : '50% 50%',
        }}
      >
        <span style={{ color: light.accent }}>SLOVO</span>
        {portrait ? <br /> : ' '}
        повертає.
      </div>
    </AbsoluteFill>
  );
}

/**
 * The shout's sounds for a scene starting on frame `at`: the horn, the slot
 * for the spoken word right after it, a knock per tile landing, a crack as
 * the word is forgotten and the stamp on «SLOVO повертає.».
 */
export function ShoutSound({ at, beats, voice }: { at: number; beats: ShoutBeats; voice?: string }) {
  return (
    <>
      <Horn at={at + beats.shout} />
      {/* «Рупор вимовляє слово»: nothing is recorded yet (SOUNDS.md). */}
      <Voice src={voice} at={at + beats.shout + hornLength} />
      {[...mainWord].map((_, i) => {
        const landed = at + beats.tiles + i * beats.tileStep + beats.tileFlight;
        // A tile that landed before the video's first frame makes no sound.
        return landed < 0 ? null : <Knock key={i} index={i} at={landed} />;
      })}
      {beats.forgotten !== undefined && <Sfx src={sfx.crack} at={at + beats.forgotten} volume={0.7} />}
      <Sfx src={sfx.stamp} at={at + beats.stamp} volume={0.75} />
    </>
  );
}
