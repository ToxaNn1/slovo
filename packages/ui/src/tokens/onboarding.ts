/** The tokens of the splash and onboarding. */

/**
 * The splash cut of the design (`startSplash` in `SlovoApp.dc.html`), on its
 * 390 × 844 frame, which the splash scales to the screen's width. The wordmark's
 * letters fly in one after another, the ink band cuts across with the tagline,
 * the Mascot rolls in shouting, and the app takes over after `hold`. The daily
 * open runs the same cut at `pace` of the first launch's; under Reduce Motion
 * the cut is one fade and the app takes over after `reduceMotionHold`.
 */
export const splashMotion = {
  frame: { width: 390, height: 844 },
  first: { pace: 1, hold: 2050, reduceMotionHold: 800 },
  daily: { pace: 0.28, hold: 560, reduceMotionHold: 350 },
  /** Each letter: where it stands, its turn, and its fly in from the screen's middle. */
  letters: [
    { x: -40, y: 70, rotate: -4 },
    { x: 178, y: 110, rotate: 6 },
    { x: -56, y: 300, rotate: 3 },
    { x: 190, y: 330, rotate: -7 },
    { x: 40, y: 520, rotate: -10 },
  ],
  letter: {
    /** The middle of the frame the letters fly from, less the letter's own offset. */
    from: { x: 90, y: 580 },
    fromScale: 0.15,
    fromTurn: -30,
    duration: 500,
    delay: 500,
    stagger: 80,
    easing: [0.2, 0.9, 0.25, 1.15],
  },
  /** The ink band, as fractions of the screen, drawn in from the left. */
  band: [
    [0, 0.58],
    [1, 0.36],
    [1, 0.52],
    [0, 0.74],
  ],
  cut: { duration: 350, delay: 1250, easing: [0.7, 0, 0.3, 1] },
  tagline: { turn: -12.5 },
  mascot: { x: 110, y: 640 },
  /** The Mascot rolls in from the left, turning as it comes. */
  roll: { duration: 600, from: -360, turn: -560, easing: [0.25, 0.9, 0.3, 1.1] },
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
  /** Where the shout word sits on the red top, its turn in degrees, and where it flies in from. */
  shout: { left: -14, top: 96, turn: -8, flyFrom: -120 },
  /** The Mascot's corner, less its own padding, and its figure's width. */
  mascot: { right: 10, top: 270, width: 140 },
  dot: { height: 8, width: 14, currentWidth: 34, gap: 6, skew: '-20deg' },
  side: 24,
  contentTop: 6,
  gap: 14,
  bottom: 40,
  goalTile: { height: 78, gap: 10, radius: 16, lineGap: 2 },
} as const;
