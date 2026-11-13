import { interpolate, useCurrentFrame } from 'remotion';

import { light } from '../look';
import { clamp } from './motion';

type Point = { x: number; y: number };

/** Рупор's shout: three rings from his mouth towards `target`, from frame `at`, each `life` frames long, growing `grow` times. */
export function Rings({
  mouth,
  target,
  s,
  at,
  life,
  grow,
}: {
  mouth: Point;
  target: Point;
  s: number;
  at: number;
  life: number;
  grow: number;
}) {
  const frame = useCurrentFrame();
  return (
    <>
      {[0, 1, 2].map((ring) => {
        const t = interpolate(frame, [at + ring * 5, at + life + ring * 5], [0, 1], clamp);
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
              scale: String(0.6 + t * grow),
              opacity: 1 - t,
            }}
          />
        );
      })}
    </>
  );
}
