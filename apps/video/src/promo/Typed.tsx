import { useCurrentFrame } from 'remotion';

import { uiFont } from '../look';

/** A caption typed letter by letter from `from`, two frames a letter, `bottom` above the frame's foot. */
export function Typed({
  text,
  from,
  until = Infinity,
  color,
  size,
  bottom = '13%',
}: {
  text: string;
  from: number;
  until?: number;
  color: string;
  size: number;
  bottom?: string;
}) {
  const frame = useCurrentFrame();
  if (frame < from || frame >= until) return null;
  const shown = text.slice(0, Math.floor((frame - from) / 2) + 1);
  const caret = Math.floor(frame / 15) % 2 === 0 && shown.length < text.length + 6;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        textAlign: 'center',
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: size,
        color,
        letterSpacing: '0.01em',
      }}
    >
      {shown}
      <span style={{ opacity: caret ? 1 : 0 }}>▍</span>
    </div>
  );
}
