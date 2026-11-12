/** The tokens of the splash and onboarding. */

import type { Easing } from './base';

/** One keyframe of a splash track: where it falls in the cut (0 to 1), and its value there. */
export type SplashStop = readonly [at: number, value: number];

/** CSS `ease-out`, the design's curve for the tagline and the shout lines. */
const easeOut: Easing = [0, 0, 0.58, 1];

/**
 * The splash cut of the design (`XSplash.dc.html`), on its 390 × 844 frame,
 * which the splash scales to fit the screen around its middle. On the Theme's
 * background the red wedge unfolds with a spring, the S is drawn as a stroke,
 * the wordmark's letters pop up one after another, the tagline rises, the
 * Mascot jumps in and shouts, everything fades and a red wedge wipes the
 * screen; then the app takes over. The cut plays once, whole, in `duration`,
 * on every launch: one turn of the board's loop. Every track is a list
 * of keyframes over the cut, eased segment by segment as CSS eases them, and
 * holds its first value before its first stop and its last after its last.
 * Under Reduce Motion nothing moves: the splash holds the cut's `still` frame,
 * without the wipe, for `reduceMotionHold`.
 */
export const splashMotion = {
  frame: { width: 390, height: 844 },
  duration: 4200,
  reduceMotionHold: 800,
  /** The frame the splash holds under Reduce Motion: every piece in place, the wipe not yet in. */
  still: 0.86,
  /** The mark, a red wedge with the cream S, on a 100 × 100 box drawn `size` wide. */
  logo: {
    top: 216,
    size: 200,
    easing: [0.3, 1, 0.4, 1],
    opacity: [
      [0.05, 0],
      [0.09, 1],
      [0.88, 1],
      [0.92, 0],
    ],
    scale: [
      [0.05, 0.7],
      [0.2, 1.04],
      [0.26, 1],
      [0.38, 1],
      [0.41, 1.07],
      [0.45, 1],
    ],
    turn: [
      [0.05, -10],
      [0.2, 2],
      [0.26, 0],
    ],
  },
  /** The wedge unfolds from its left edge, `originX` of the box, with a spring. */
  wedge: {
    points: '10,27 90,9 90,91 10,73',
    originX: 10,
    easing: [0.7, 0, 0.2, 1],
    scaleX: [
      [0.06, 0],
      [0.18, 1.08],
      [0.24, 1],
    ],
  },
  /** The S, drawn as a stroke along its dash. */
  s: {
    path: 'M65.5,40 C65.5,33.5 59.5,30.5 52.5,30.5 C45.5,30.5 40,33.5 40,39.5 C40,46 47,47.2 53,48.8 C59.5,50.5 66,52.5 66,59.8 C66,66.5 60,69.5 52.5,69.5 C44.5,69.5 39,66.2 39,59.5',
    stroke: 11.5,
    dash: 150,
    easing: [0.5, 0, 0.3, 1],
    offset: [
      [0.2, 150],
      [0.38, 0],
    ],
  },
  /** Each letter pops up from under its row, `stagger` of the cut after the one before. */
  letters: {
    top: 450,
    /** The row's room above and below the letters, inside its clip. */
    pad: 4,
    stagger: 0.07 / 4.2,
    easing: [0.2, 0.9, 0.3, 1.2],
    /** How far under its place a letter is, as a share of its own height. */
    rise: [
      [0.38, 1.05],
      [0.47, -0.06],
      [0.51, 0],
    ],
    opacity: [
      [0.88, 1],
      [0.92, 0],
    ],
  },
  tagline: {
    top: 534,
    easing: easeOut,
    opacity: [
      [0.52, 0],
      [0.6, 1],
      [0.88, 1],
      [0.92, 0],
    ],
    rise: [
      [0.52, 12],
      [0.6, 0],
    ],
  },
  /** The Mascot jumps in from under the screen in its `box`, lands, squashes and stands. */
  mascot: {
    left: 96,
    bottom: 60,
    box: 200,
    width: 150,
    easing: [0.3, 1, 0.4, 1],
    rise: [
      [0.56, 220],
      [0.66, -14],
      [0.71, 0],
    ],
    turn: [
      [0.56, 12],
      [0.66, -5],
      [0.71, 0],
    ],
    scaleX: [
      [0.66, 1],
      [0.71, 1.08],
      [0.75, 0.95],
      [0.79, 1],
    ],
    scaleY: [
      [0.66, 1],
      [0.71, 0.9],
      [0.75, 1.06],
      [0.79, 1],
    ],
    opacity: [
      [0.88, 1],
      [0.92, 0],
    ],
  },
  /** The shout lines beside the Mascot, on their 46 × 70 box, popping out from its left edge. */
  shout: {
    width: 46,
    height: 70,
    right: -6,
    top: 6,
    red: ['4,14 40,2 36,12', '4,56 36,58 40,68'],
    ink: '6,35 44,33 42,41 6,39',
    easing: easeOut,
    opacity: [
      [0.73, 0],
      [0.76, 1],
      [0.86, 1],
      [0.89, 0],
    ],
    scale: [
      [0.73, 0.4],
      [0.76, 1.1],
      [0.8, 1],
    ],
  },
  /** The red wedge that wipes the screen: its left edge and width as shares of the screen's, its moves as shares of its own width. */
  wipe: {
    left: -0.3,
    width: 1.6,
    bleed: 40,
    skew: -14,
    easing: [0.7, 0, 0.3, 1],
    x: [
      [0.85, -1.3],
      [0.93, 0],
      [1, 1.3],
    ],
  },
} as const;

/** The sample notification of the onboarding: its app icon (side and corner radius) and the gap between its lines. */
export const sampleNotification = { iconSize: 38, iconRadius: 9, lineGap: 2 } as const;

/**
 * An onboarding step of the design (`isOb` in `SlovoApp.dc.html`): the red
 * halftone top cut by `wedges.cut`, its shout word turned and flown in from
 * the left, the on-red Mascot, the skewed step dots and the Daily Goal tiles.
 */
export const onboardingLayout = {
  heroHeight: 440,
  /**
   * The room the board leaves under its red top for a step's content and
   * buttons, home indicator aside (844 − 34 − 440): on a shorter phone the red
   * top and its art are drawn smaller to keep it.
   */
  contentRoom: 370,
  /**
   * The shortest the red top gets so a tall step (the first Word's card)
   * shows its content: it still holds «Пропустити», the shout word and the Mascot.
   */
  minHeroHeight: 260,
  /** How far from the side a step starts when it slides in (ADR 0055). */
  slideDistance: 40,
  /**
   * Where the shout word sits on the red top, its turn in degrees, and where
   * it flies in from. Inset by the boards' side, as their glyphs' own bearing
   * puts it there, so its turned left end is never cut by the screen's edge.
   */
  shout: { left: 24, top: 96, turn: -8, flyFrom: -120 },
  /** The Mascot's corner, less its own padding, and its figure's width. */
  mascot: { right: 10, top: 270, width: 140 },
  dot: { height: 8, width: 14, currentWidth: 34, gap: 6, skew: '-20deg' },
  side: 24,
  contentTop: 6,
  gap: 14,
  /** The room under a step's buttons to the screen's bottom edge, the home indicator in it. */
  bottom: 40,
  goalTile: { height: 78, gap: 10, radius: 16, lineGap: 2 },
} as const;
