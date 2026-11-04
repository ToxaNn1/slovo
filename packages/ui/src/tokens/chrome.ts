import { shadowColor, space } from './base';

/** The tokens of the navigation chrome, sheets, toasts and the shared controls. */

/** The tab bar of the design. */
export const tabBar = {
  /** A tab's height above the safe area. */
  height: 56,
  /** A tab's icon, square. */
  icon: 24,
  /** Space between a tab's icon and its label. */
  gap: 5,
  /** The red slanted indicator over the active tab, `top` points over the tab. */
  indicator: { width: 34, height: 6, top: -9, skewX: '-24deg' },
} as const;

/** The padding of a label chip, by density. */
export const labelChipPadding = {
  tight: { horizontal: 7, vertical: 3 },
  roomy: { horizontal: 10, vertical: 5 },
} as const;

/** The segmented control's drawing (design `SlovoApp`): a sunken track around its segments. */
export const segmentedDrawing = {
  padding: 4,
  gap: 4,
  radius: 12,
  segmentHeight: 38,
  segmentRadius: 9,
} as const;

/** The toggle's drawing (design `SlovoApp`): a track and the knob that travels inside it. */
export const switchDrawing = {
  width: 54,
  height: 32,
  radius: 10,
  knob: 26,
  knobRadius: 8,
  /** The gap between the knob and the track's edge. */
  inset: 3,
  /** The knob's hard shadow straight below it. */
  knobShadow: { depth: 2, color: 'rgba(20, 12, 10, 0.3)' },
} as const;

/** The chip's drawing (design `SlovoApp`, the Saved tabs): a label with an optional count. */
export const chipDrawing = {
  height: 38,
  paddingHorizontal: 14,
  gap: 6,
  /** How far the count fades beside its label. */
  countOpacity: 0.7,
  /** The chip's scale while it is pressed. */
  pressedScale: 0.95,
} as const;

/** The search field's drawing (design `SlovoApp`): a sunken box, a magnifier and a clear button. */
export const searchFieldDrawing = {
  height: 50,
  radius: 14,
  paddingHorizontal: 14,
  gap: 10,
  icon: 18,
  clear: 28,
  clearRadius: 8,
  clearIcon: 10,
} as const;

/** The text field's drawing (design `XSettings`): its box, and the border a problem draws. */
export const textFieldDrawing = {
  height: 58,
  radius: 15,
  border: 2.5,
} as const;

/** The checkbox's and the radio's mark: its side, the checkbox's corner and the outline. */
export const choiceMark = { size: 26, radius: 8, border: 2.5, tick: 16 } as const;

/**
 * «Sign in with Google» in Google's branding rules for the button
 * (https://developers.google.com/identity/branding-guidelines): the fill,
 * stroke and label of its light and dark themes, which follow the Theme, and
 * the side and the four colours of Google's "G" logo, and its label's type:
 * medium weight in the system's sans-serif. Google's, not an Edition's, so no
 * Edition token changes them, and the label is the one text that takes no
 * type role (ADR 0070).
 */
export const googleSignInButton = {
  light: { fill: '#FFFFFF', stroke: '#747775', label: '#1F1F1F' },
  dark: { fill: '#131314', stroke: '#8E918F', label: '#E3E3E3' },
  logoSize: 20,
  labelType: { fontSize: 15, fontWeight: '500' },
  logo: { blue: '#4285F4', green: '#34A853', yellow: '#FBBC05', red: '#EA4335' },
} as const;

/** The height of the provider sign-in buttons, Google's and Apple's, like the secondary button's. */
export const signInButtonHeight = 50;

/** A toast's corner radius, from the design; layout, not an Edition token. */
export const toastRadius = 6;

/** `elev.toast`: `0 10 30 rgba(0, 0, 0, .4)`. */
export const toastElevation = {
  shadowColor,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.4,
  shadowRadius: 15,
} as const;

/**
 * The action row under an Entry card (XActions a1–a3): five raised tiles
 * with an icon over a label, each `height` tall with this `radius`, `gap`
 * between its icon and label, `rowGap` between the tiles and `icon` its
 * icon's side; their edge is shallower than a button's (`edge`, pressed down
 * to the same thin one), and a filed tile's ink face stands on `inverseEdge`.
 * The pennant before the hint line is `pennant` wide and tall, `hintGap` from
 * its text. On a Correction, Idiom, Synonym Row or Tip card (a10) the row is
 * `compact`: icon-only items of that width, height, radius, icon and gap,
 * under a hairline with `paddingTop` above them.
 */
export const actionTile = {
  height: 64,
  radius: 14,
  gap: 6,
  rowGap: 7,
  icon: 22,
  iconStroke: 2,
  edge: { depth: 4, translateY: 3 },
  inverseEdge: 'rgba(0, 0, 0, 0.35)',
  pennant: { width: 8, height: 12 },
  hintGap: 8,
  compact: { width: 46, height: 44, radius: 12, icon: 21, gap: 4, paddingTop: 8 },
} as const;

/**
 * A screen's header with a back tile (design `SlovoApp`, Settings): the gap
 * between the back tile and the title, and the room under it.
 */
export const backHeader = { gap: 12, paddingBottom: 14 } as const;

/**
 * The mistake report's comment field: four lines of `fieldText` show inside
 * its padding and its 1-point border before it scrolls. Its letters scale with
 * the text size up to `maxFontScale`, and its cap scales with them, so it
 * shows four lines at every text size.
 */
export const mistakeReportField = {
  lines: 4,
  padding: space[3],
  border: 1,
  maxFontScale: 1.5,
} as const;
