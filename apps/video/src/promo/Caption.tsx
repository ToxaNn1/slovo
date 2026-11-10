import { useCurrentFrame } from 'remotion';

import { uiFont } from '../look';

/** How many frames `text` takes to type, two frames a letter. */
export const typedFrames = (text: string) => text.length * 2;

/**
 * A caption typed letter by letter from `from`, two frames a letter, centred
 * on `centerX` with its top on `top` (frame pixels). It fades out over the
 * last `fadeOut` frames before `until`.
 */
export function Caption({
  text,
  from,
  until = Infinity,
  color,
  size,
  top,
  centerX,
  fadeOut = 6,
}: {
  text: string;
  from: number;
  until?: number;
  color: string;
  size: number;
  top: number;
  centerX: number;
  fadeOut?: number;
}) {
  const frame = useCurrentFrame();
  if (frame < from || frame >= until) return null;
  const shown = text.slice(0, Math.floor((frame - from) / 2) + 1);
  const caret = Math.floor(frame / 15) % 2 === 0 && shown.length < text.length;
  const opacity = Math.min(1, (until - frame) / fadeOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: centerX,
        top,
        translate: '-50% 0px',
        whiteSpace: 'nowrap',
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.15,
        color,
        letterSpacing: '0.01em',
        opacity,
      }}
    >
      {/* The whole line holds its width, so the text does not slide while it is typed. */}
      <span style={{ position: 'relative' }}>
        {shown}
        <span style={{ position: 'absolute', left: '100%', opacity: caret ? 1 : 0 }}>▍</span>
      </span>
      <span style={{ opacity: 0 }}>{text.slice(shown.length)}</span>
    </div>
  );
}
