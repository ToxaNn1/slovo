/** The tokens of Settings and its panels. */

/** The drawing of a slider on a row that is not available yet: track, fill and thumb. */
export const sliderDrawing = {
  trackHeight: 4,
  trackRadius: 2,
  thumbSize: 20,
  thumbRadius: 10,
} as const;

/**
 * A Settings row's drawing (design `SlovoApp`, Settings): its padding, the
 * gap between its parts, the sunken icon tile at its start with the slanted
 * shape inside, and the chevron that ends a row that opens a screen.
 */
export const settingsRowDrawing = {
  paddingVertical: 14,
  paddingHorizontal: 16,
  gap: 12,
  iconTile: 30,
  iconTileRadius: 9,
  icon: 14,
  chevronWidth: 8,
  chevronHeight: 13,
} as const;

/**
 * The About screen's red panel (design `SlovoApp`, `subAbout`): its height,
 * corner and padding, where the giant letter sits off its top right, and the
 * wedge before the app's name with the gap after it.
 */
export const aboutPanel = {
  height: 150,
  radius: 20,
  padding: 18,
  giant: { right: -30, top: -40 },
  wedge: { width: 23, height: 34 },
  gap: 10,
} as const;

/** The widget guide's numbered steps: the square that holds the number. */
export const guideStep = { badge: 28, badgeRadius: 4 } as const;

/**
 * The drawing of the widgets in the widget guide. It is a picture of the
 * phone, so it does not follow the text size of iOS and its wallpaper is no
 * Edition token. Its type roles are smaller than the design's real widgets
 * (28–30 for the Lemma at 170×170, 34 at 364×170), which the drawing scales
 * down with its own width.
 */
export const widgetDrawing = {
  wallpaper: '#3F3128',
  /** The white of the drawing's app icons and caption, with the opacity of each. */
  white: '#FFFFFF',
  iconOpacity: 0.16,
  captionOpacity: 0.7,
  /** The app icons are drawn in two rows of two. */
  iconRows: 2,
  iconRadius: 12,
  /** The widgets' corner radius, the design's 22–24. */
  widgetRadius: 22,
  /** The medium widget's width over its height, from the design's 364 × 170. */
  mediumAspectRatio: 364 / 170,
} as const;
