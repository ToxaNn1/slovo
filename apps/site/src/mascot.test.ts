import { describe, expect, it } from 'vitest';

import { drawMascot, mascotMotionCss } from './mascot';
import { readLandingEdition } from './edition';

const mascotFigure = readLandingEdition().mascot;
const paints = { body: 'B', ink: 'I', accent: 'A' };
const fills = (paths: readonly { fill: string; stroke?: string }[]) =>
  paths.map((path) => path.stroke ?? path.fill);

describe('the Mascot drawn from the UA Edition vector', () => {
  it('shouts with rays behind it and its hat on', () => {
    const drawing = drawMascot(mascotFigure, 'shouts', paints);

    expect(drawing.behind).toHaveLength(mascotFigure.rays.length);
    expect(drawing.hat).toHaveLength(mascotFigure.hat.length);
    expect(drawing.turn).toBe('rotate(0 30 56)');
    expect(drawing.front).toEqual([]);
  });

  it('paints the body in the colour the page gives it', () => {
    const drawing = drawMascot(mascotFigure, 'waits', paints);

    expect(fills(drawing.figure)).toContain('B');
    expect(drawing.behind).toEqual([]);
  });

  it('celebrates with confetti in front', () => {
    const drawing = drawMascot(mascotFigure, 'celebrates', paints);

    expect(drawing.front).toHaveLength(mascotFigure.confetti.length);
  });

  it('takes its hat off onto the ground, turned and without shine', () => {
    const drawing = drawMascot(mascotFigure, 'hatOff', paints);

    expect(drawing.hat).toEqual([]);
    expect(drawing.front).toHaveLength(mascotFigure.hatOnGround.length);
    expect(drawing.turn).toBe('rotate(26 30 56)');
  });
});

describe("the Mascot's motion as CSS", () => {
  it('shouts back and forth like the app', () => {
    expect(mascotMotionCss('shouts')).toEqual({
      keyframes:
        '@keyframes mascot-shouts{0%{transform:translateY(0px) rotate(0deg) scale(1, 1)}100%{transform:translateY(0px) rotate(-3deg) scale(1.07, 1.07)}}',
      animation: 'mascot-shouts 320ms cubic-bezier(0.42,0,0.58,1) infinite alternate',
    });
  });

  it('stays still with its hat off', () => {
    expect(mascotMotionCss('hatOff')).toBeUndefined();
  });
});
