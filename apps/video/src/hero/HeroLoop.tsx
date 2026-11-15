import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

import { dark, light } from '../look';
import { Rupor } from '../Rupor';
import { clamp, pop } from '../shared/motion';
import { Tile } from '../Tile';

/**
 * The landing Hero's loop, 4:5 and silent: Рупор shouts into his megaphone,
 * the tiles of ГРИЗОТА fly out into a row, the Stress mark falls on О, the
 * word holds, then drops away; the last frame leads back into the first.
 */
export const heroLoopLength = 210;

const beats = {
  /** Рупор leans back to draw breath. */
  windup: 22,
  /** The shout: the rings burst and the first tile leaves the megaphone. */
  shout: 34,
  /** Rupor is glad once the word stands. */
  glad: 112,
  /** The tiles drop away. */
  drop: 168,
  /** Рупор waits again, as in frame 0. */
  rest: 192,
} as const;

/** The letters and their tilts, as the Hero's tile row under the frame draws them. */
const letters = [
  { ch: 'Г', rotate: -6, lift: 0 },
  { ch: 'Р', rotate: 4, lift: -8 },
  { ch: 'И', rotate: -2, lift: 0 },
  { ch: 'З', rotate: 5, lift: -8, red: true },
  { ch: 'О', rotate: -5, lift: 0, stressed: true },
  { ch: 'Т', rotate: 3, lift: -5 },
  { ch: 'А', rotate: -3, lift: 0 },
] as const;

const tile = { size: 118, gap: 14, top: 300 } as const;
const launchAt = (index: number) => beats.shout + 4 + index * 5;
const flight = 18;
const landAt = (index: number) => launchAt(index) + flight;
const acuteAt = landAt(letters.length - 1) + 6;

const rupor = { width: 560, left: 70, top: 830, tilt: -16 } as const;

/** Where the megaphone's mouth sits, (0.99, 0.4) of his width, swung by his tilt. */
function mouthAt(tilt: number, bob: number) {
  const height = (rupor.width * 112) / 150;
  const a = (tilt * Math.PI) / 180;
  const dx = rupor.width * 0.99 - rupor.width / 2;
  const dy = rupor.width * 0.4 - height / 2;
  return {
    x: rupor.left + rupor.width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: rupor.top + bob + height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/** A gentle breathing bob that makes whole turns over the loop, so it closes seamlessly. */
const bobAt = (frame: number) => Math.sin((frame / heroLoopLength) * Math.PI * 2 * 3) * 6;

function tiltAt(frame: number) {
  const back = interpolate(frame, [beats.windup, beats.shout], [0, 7], {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });
  const kick = interpolate(frame, [beats.shout, beats.shout + 4, beats.shout + 16], [0, -12, -7], clamp);
  const settle = interpolate(frame, [beats.glad, beats.glad + 14], [0, 7], { ...clamp, easing: pop });
  return rupor.tilt + back + kick + settle;
}

export function HeroLoop() {
  const frame = useCurrentFrame();
  const bob = bobAt(frame);
  const tilt = tiltAt(frame);
  const mouth = mouthAt(rupor.tilt, 0);
  const state =
    frame >= beats.shout && frame < beats.glad
      ? 'shouts'
      : frame >= beats.glad && frame < beats.rest
        ? 'happy'
        : 'waits';
  const shake =
    frame > beats.shout && frame < beats.shout + 40 ? Math.sin(frame * 2.2) * 6 : 0;
  const rowWidth = letters.length * tile.size + (letters.length - 1) * tile.gap;
  const rowLeft = (1080 - rowWidth) / 2;
  return (
    <AbsoluteFill style={{ background: dark.surfaceSunken }}>
      {[0, 1, 2].map((ring) => {
        const t = interpolate(
          frame,
          [beats.shout + ring * 8, beats.shout + 34 + ring * 8],
          [0, 1],
          clamp,
        );
        return (
          <div
            key={ring}
            style={{
              position: 'absolute',
              left: mouth.x - 60,
              top: mouth.y - 60,
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: `10px solid ${light.accent}`,
              scale: String(1 + t * 7),
              opacity: t === 0 || t === 1 ? 0 : 1 - t,
            }}
          />
        );
      })}
      {letters.map((letter, index) => (
        <FlyingTile
          key={index}
          letter={letter}
          index={index}
          frame={frame}
          from={mouth}
          to={{ x: rowLeft + index * (tile.size + tile.gap), y: tile.top + letter.lift }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: rupor.left,
          top: rupor.top + bob,
          translate: `${shake}px 0px`,
          rotate: `${tilt}deg`,
        }}
      >
        <Rupor state={state} width={rupor.width} ground="dark" />
      </div>
    </AbsoluteFill>
  );
}

function FlyingTile({
  letter,
  index,
  frame,
  from,
  to,
}: {
  letter: (typeof letters)[number];
  index: number;
  frame: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const start = launchAt(index);
  if (frame < start) return null;
  const t = interpolate(frame, [start, landAt(index)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const arc = Math.sin(t * Math.PI) * -120;
  const x = from.x - tile.size / 2 + (to.x - from.x + tile.size / 2) * t;
  const y = from.y - tile.size / 2 + (to.y - from.y + tile.size / 2) * t + arc;
  const spin = (index % 2 === 0 ? -1 : 1) * 200 * (1 - t);
  const scale = interpolate(t, [0, 1], [0.25, 1]);
  const squash = interpolate(
    frame,
    [landAt(index), landAt(index) + 3, landAt(index) + 9],
    [1, 0.84, 1],
    clamp,
  );
  const dropStart = beats.drop + index * 2;
  const fall = interpolate(frame, [dropStart, dropStart + 16], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.quad),
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + fall * 1200,
        rotate: `${letter.rotate + spin + fall * (index % 2 === 0 ? -40 : 40)}deg`,
        scale: `${scale} ${scale * squash}`,
        transformOrigin: 'center bottom',
        opacity: 1 - fall,
      }}
    >
      <Tile
        letter={letter.ch}
        size={tile.size}
        face={'red' in letter ? light.accent : light.tile}
        edge={'red' in letter ? light.accentEdge : light.tileEdge}
        ink={light.ink}
      />
      {'stressed' in letter && <Acute frame={frame} />}
    </div>
  );
}

/** The Stress mark falling onto О once the row stands. */
function Acute({ frame }: { frame: number }) {
  const size = tile.size;
  const t = interpolate(frame, [acuteAt, acuteAt + 8], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.quad),
  });
  const squash = interpolate(frame, [acuteAt + 8, acuteAt + 10, acuteAt + 15], [1, 0.8, 1], clamp);
  if (frame < acuteAt) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: size * 0.4,
        top: -size * 0.7,
        width: size * 0.2,
        height: size * 0.5,
        borderRadius: size * 0.1,
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
