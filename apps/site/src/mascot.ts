import type { MascotFigure, MascotShape, MascotState } from '@slovo/contracts';
import { mascotMotion, mascotPose } from '@slovo/ui/tokens';

/** The colour of each paint role of the Mascot's vector. */
export type Paints = Readonly<Record<'body' | 'ink' | 'accent', string>>;

/** One drawn path of the Mascot: SVG attributes ready for a `<path>`. */
export type MascotPath = Readonly<{
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity: number;
}>;

/** The Mascot in a state: the layers the app's Mascot draws, as plain SVG data. */
export type MascotDrawing = Readonly<{
  viewBox: string;
  /** Drawn first and outside the turn: the rays of the loud states. */
  behind: readonly MascotPath[];
  /** The figure turned about the Edition's pivot. */
  turn: string;
  figure: readonly MascotPath[];
  /** The hat, dropped in the cringe state. */
  hatShift: string;
  hat: readonly MascotPath[];
  /** Drawn last, outside the turn: the hat on the ground, confetti, sleep marks. */
  front: readonly MascotPath[];
}>;

function paintOf(paint: string, paints: Paints): string {
  return paint === 'body' || paint === 'ink' || paint === 'accent' ? paints[paint] : paint;
}

function pathsOf(shapes: readonly MascotShape[], paints: Paints): MascotPath[] {
  return shapes.map((shape) =>
    'fill' in shape
      ? { d: shape.path, fill: paintOf(shape.fill, paints), opacity: shape.opacity ?? 1 }
      : {
          d: shape.path,
          fill: 'none',
          stroke: paintOf(shape.stroke, paints),
          strokeWidth: shape.width,
          opacity: shape.opacity ?? 1,
        },
  );
}

/**
 * The Mascot (ADR 0070) as the app's Mascot puts it together from the
 * Edition's vector: which parts each state shows, the turn and the hat drop.
 */
export function drawMascot(
  figure: MascotFigure,
  state: MascotState,
  paints: Paints,
): MascotDrawing {
  const hatOff = state === 'hatOff';
  const [x, y] = figure.pivot;
  const turn = state === 'sad' ? mascotPose.sadTurn : hatOff ? mascotPose.hatOffTurn : 0;
  const drop = state === 'cringes' ? mascotPose.cringeHatDrop : 0;
  const loud = state === 'shouts' || state === 'celebrates';
  return {
    viewBox: `0 0 ${String(figure.width)} ${String(figure.height)}`,
    behind: loud ? pathsOf(figure.rays, paints) : [],
    turn: `rotate(${String(turn)} ${String(x)} ${String(y)})`,
    figure: pathsOf(
      [...figure.figure, ...(hatOff ? [] : figure.shine), ...figure.eyes[state]],
      paints,
    ),
    hatShift: `translate(0 ${String(drop)})`,
    hat: hatOff ? [] : pathsOf(figure.hat, paints),
    front: pathsOf(
      [
        ...(hatOff ? figure.hatOnGround : []),
        ...(state === 'celebrates' ? figure.confetti : []),
        ...(state === 'sleeps' ? figure.sleepMarks : []),
      ],
      paints,
    ),
  };
}

/** The CSS of the Mascot's motion in a state: a `@keyframes` rule and the `animation` that plays it. */
export type MascotMotionCss = Readonly<{ keyframes: string; animation: string }>;

/**
 * The app's Mascot motion (`mascotMotion`) written as CSS, so the site moves
 * the figure the same way. The hat-off state is still.
 */
export function mascotMotionCss(state: MascotState): MascotMotionCss | undefined {
  const plan = mascotMotion[state];
  if (plan === undefined) return undefined;
  const name = `mascot-${state}`;
  const frames = plan.frames
    .map((frame) => {
      const y = 'y' in frame ? frame.y : 0;
      const rotate = 'rotate' in frame ? frame.rotate : 0;
      const scaleX = 'scaleX' in frame ? frame.scaleX : 1;
      const scaleY = 'scaleY' in frame ? frame.scaleY : 1;
      const transform = `translateY(${String(y)}px) rotate(${String(rotate)}deg) scale(${String(scaleX)}, ${String(scaleY)})`;
      return `${String(frame.at * 100)}%{transform:${transform}}`;
    })
    .join('');
  const repeat =
    plan.repeat === 'once'
      ? '1 both'
      : plan.repeat === 'alternate'
        ? 'infinite alternate'
        : 'infinite';
  return {
    keyframes: `@keyframes ${name}{${frames}}`,
    animation: `${name} ${String(plan.duration)}ms cubic-bezier(${plan.easing.join(',')}) ${repeat}`,
  };
}
