import { z } from 'zod';

import { ColorSchema, HexColorSchema } from './shared';

/** The splash in one Theme: an image from the Edition's `decor/` folder on a plain colour. */
const SplashThemeSchema = z.strictObject({
  image: z
    .string()
    .regex(/^[a-z0-9-]+\.png$/, 'Expected the name of a PNG file in the decor folder'),
  backgroundColor: HexColorSchema,
});

/**
 * Decor slot 7, the splash the native app shows while it starts: an image
 * centred on a background colour, in light and dark. It is baked into the
 * native build, so changing it needs a new development build.
 */
export const SplashDecorSchema = z.strictObject({
  /** The width of the image on screen, in points. */
  imageWidth: z.number().int().positive(),
  light: SplashThemeSchema,
  dark: SplashThemeSchema,
});

export type SplashDecor = z.infer<typeof SplashDecorSchema>;

/** SVG path data: move, line, curve and arc commands with their numbers. */
const SvgPathSchema = z
  .string()
  .regex(/^\s*[Mm][MmLlHhVvCcSsQqTtAaZz\d\s,.+-]*$/, 'Expected SVG path data such as M0 0h2v2H0z');

/** One colour of a motif: its shapes and their colour in each colour scheme. */
export const DecorLayerSchema = z.strictObject({
  path: SvgPathSchema,
  light: ColorSchema,
  dark: ColorSchema,
});

export type DecorLayer = z.infer<typeof DecorLayerSchema>;

const SizeSchema = z.number().positive();

/**
 * A vector drawing on its own grid, `width` by `height` units, drawn as its
 * layers in order. A slot draws it at its own size in points, or scales it.
 */
export const DecorMotifSchema = z.strictObject({
  width: SizeSchema,
  height: SizeSchema,
  layers: z.array(DecorLayerSchema).min(1),
});

export type DecorMotif = z.infer<typeof DecorMotifSchema>;

/**
 * The motif of a Season or a Holiday: the tile Decor slot 1 repeats across
 * the screen and the centre of the slot 2 divider, each at its size in points.
 * It changes only those two slots (ADR 0055).
 */
export const SeasonalMotifSchema = z.strictObject({
  tile: DecorMotifSchema,
  centre: DecorMotifSchema,
  /** The Mascot's accessory for the Season or Holiday, if any. */
  accessory: z.lazy(() => MascotAccessorySchema).optional(),
});

export type SeasonalMotif = z.infer<typeof SeasonalMotifSchema>;

/** The motif of each meteorological Season. */
export const SeasonMotifsSchema = z.strictObject({
  winter: SeasonalMotifSchema,
  spring: SeasonalMotifSchema,
  summer: SeasonalMotifSchema,
  autumn: SeasonalMotifSchema,
});

export type SeasonMotifs = z.infer<typeof SeasonMotifsSchema>;

const MonthSchema = z.number().int().min(1).max(12);

/** The most days each month can have, 29 February included. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * How a Holiday falls in the year: on a fixed day and month, or on the nth
 * weekday of a month (the third Thursday of May). Every month has at least
 * four of each weekday, so `nth` goes up to 4.
 */
export const HolidayRuleSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal('fixed'),
      day: z.number().int().min(1).max(31),
      month: MonthSchema,
    })
    .refine(({ day, month }) => day <= (DAYS_IN_MONTH[month - 1] ?? 0), {
      message: 'Expected a day that month has',
      path: ['day'],
    }),
  z.strictObject({
    kind: z.literal('nthWeekday'),
    nth: z.number().int().min(1).max(4),
    weekday: z.enum(WEEKDAYS),
    month: MonthSchema,
  }),
]);

export type HolidayRule = z.infer<typeof HolidayRuleSchema>;

/** A Holiday the Edition lists: its rule and the motif it shows instead of the Season's. */
export const HolidaySchema = z.strictObject({
  rule: HolidayRuleSchema,
  motif: SeasonalMotifSchema,
});

export type Holiday = z.infer<typeof HolidaySchema>;

/**
 * What paints a shape of the Mascot: a role the Core resolves for the state,
 * the Theme and the on-red variant (`body` the figure's colour, `ink` the
 * Theme's ink, `accent` the red), or a fixed colour of the Edition.
 */
const MascotPaintSchema = z.union([z.enum(['body', 'ink', 'accent']), ColorSchema]);

/** One shape of the Mascot, filled or stroked, at an optional opacity. */
const MascotShapeSchema = z.union([
  z.strictObject({
    path: SvgPathSchema,
    fill: MascotPaintSchema,
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.strictObject({
    path: SvgPathSchema,
    stroke: MascotPaintSchema,
    width: SizeSchema,
    opacity: z.number().min(0).max(1).optional(),
  }),
]);

export type MascotShape = z.infer<typeof MascotShapeSchema>;

const MascotShapesSchema = z.array(MascotShapeSchema).min(1);

/**
 * The Mascot's vector on its own grid, in parts the Core puts together for
 * each state (ADR 0070): the figure, its shine, the eyes of every state, the
 * hat on the head and on the ground (the hat-off state), and the rays,
 * confetti and sleep marks some states add. `pivot` is where the sad and
 * hat-off states turn the figure.
 */
export const MascotFigureSchema = z.strictObject({
  width: SizeSchema,
  height: SizeSchema,
  pivot: z.tuple([z.number(), z.number()]),
  figure: MascotShapesSchema,
  shine: MascotShapesSchema,
  eyes: z.strictObject({
    sleeps: MascotShapesSchema,
    waits: MascotShapesSchema,
    shouts: MascotShapesSchema,
    happy: MascotShapesSchema,
    surprised: MascotShapesSchema,
    cringes: MascotShapesSchema,
    sad: MascotShapesSchema,
    celebrates: MascotShapesSchema,
    hatOff: MascotShapesSchema,
  }),
  hat: MascotShapesSchema,
  hatOnGround: MascotShapesSchema,
  rays: MascotShapesSchema,
  confetti: MascotShapesSchema,
  sleepMarks: MascotShapesSchema,
});

export type MascotFigure = z.infer<typeof MascotFigureSchema>;

/** A state the Core draws the Mascot in. */
export type MascotState = keyof MascotFigure['eyes'];

/**
 * The Season's or Holiday's accessory, a layer on the Mascot's figure; with
 * `replacesHat` it is worn instead of the hat. It never changes the palette.
 */
export const MascotAccessorySchema = z.strictObject({
  shapes: MascotShapesSchema,
  replacesHat: z.boolean(),
});

export type MascotAccessory = z.infer<typeof MascotAccessorySchema>;

/** A point of a pictogram shape on its 100 by 100 grid. */
const GridPointSchema = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);

/**
 * One shape of a Category pictogram on a 100 by 100 grid: a polygon through
 * its points, or a circle of its radius in the middle of the grid.
 */
export const PictogramShapeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('polygon'), points: z.array(GridPointSchema).min(3) }),
  z.strictObject({ kind: z.literal('circle'), radius: z.number().positive().max(50) }),
]);

export type PictogramShape = z.infer<typeof PictogramShapeSchema>;

/**
 * The colours of a Category tile, as roles the Theme resolves: `accent` the
 * loud red face, `ink` the ink face, `tile` the plain face, `sunken` the
 * sunken face, and `quiet` the sunken face with muted shapes and text, where
 * the Mascot takes its hat off.
 */
export const CATEGORY_COVERS = ['accent', 'ink', 'tile', 'sunken', 'quiet'] as const;

export type CategoryCover = (typeof CATEGORY_COVERS)[number];

/** The art of one Category or Correction Category: its two-shape pictogram and its cover. */
export const CategoryArtSchema = z.strictObject({
  pictogram: z.strictObject({ large: PictogramShapeSchema, small: PictogramShapeSchema }),
  cover: z.enum(CATEGORY_COVERS),
});

export type CategoryArt = z.infer<typeof CategoryArtSchema>;

/**
 * The Decor an Edition draws in the app, by slot (ADR 0014, `docs/design/README.md`):
 * `editions/<edition>/decor/decor.json`. Every slot is optional; the Core's
 * neutral Decor fills a slot the Edition leaves out. Decor holds shapes and
 * colours only, never text or behaviour (ADR 0014).
 */
export const EditionDecorSchema = z.strictObject({
  /** Slot 1: a tile repeated across the screen behind everything, at its size in points. */
  background: z.strictObject({ tile: DecorMotifSchema }).optional(),
  /**
   * Slot 2: the ornament divider. The band repeats sideways at its size in
   * points on both sides of the centre, drawn at its size in points.
   */
  divider: z.strictObject({ band: DecorMotifSchema, centre: DecorMotifSchema }).optional(),
  /** Slot 3: the top-left corner of a card frame, at its size; mirrored for the others. */
  corners: z.strictObject({ corner: DecorMotifSchema }).optional(),
  /**
   * Slot 4: the empty-state illustration, scaled to the size the screen asks
   * for, and an optional one for an error state.
   */
  emptyState: z
    .strictObject({ illustration: DecorMotifSchema, error: DecorMotifSchema.optional() })
    .optional(),
  /**
   * Slot 7 as the app draws it over the native splash: the mark at the native
   * splash image's width, so the two line up, and an optional band near the bottom.
   */
  splash: z.strictObject({ mark: DecorMotifSchema, band: DecorMotifSchema.optional() }).optional(),
  /**
   * Slot 6: the victory illustration on the Game's result screen, scaled to the
   * size the screen asks for. Its layers are stitched in one after another.
   */
  victory: z.strictObject({ illustration: DecorMotifSchema }).optional(),
  /**
   * Slot 5, the Share Card frame: the band repeated across the Story card at
   * the top and, mirrored, at the bottom, and the top-left corner mirrored into
   * the four corners of the Square card, both scaled with the card.
   */
  shareCard: z.strictObject({ band: DecorMotifSchema, corner: DecorMotifSchema }).optional(),
  /** The Mascot's vector, which the Core draws in its states (ADR 0070). */
  mascot: MascotFigureSchema.optional(),
  /**
   * Seasonal Decor: a motif for every Season, shown in slots 1 and 2 while
   * «Сезонний декор» is on. Without it the slots keep their plain Decor.
   */
  seasons: SeasonMotifsSchema.optional(),
  /** The Holidays, whose motif shows instead of the Season's on their day. */
  holidays: z.array(HolidaySchema).optional(),
  /**
   * The art of every Category and Correction Category, by its id. The
   * Edition check asks for one for each and for no other id.
   */
  categories: z.record(z.string(), CategoryArtSchema).optional(),
});

export type EditionDecor = z.infer<typeof EditionDecorSchema>;
