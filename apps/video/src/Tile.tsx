import type { CSSProperties } from 'react';

import { wordFont } from './look';

/** One chunky pressed letter tile, as the Daily Crossword draws it. */
export function Tile({
  letter,
  size,
  face,
  edge,
  ink,
  style,
}: {
  letter: string;
  size: number;
  face: string;
  edge: string;
  ink: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.14,
        background: face,
        boxShadow: `0 ${size * 0.08}px 0 ${edge}`,
        color: ink,
        fontFamily: wordFont,
        fontWeight: 900,
        fontSize: size * 0.56,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {letter}
    </div>
  );
}
