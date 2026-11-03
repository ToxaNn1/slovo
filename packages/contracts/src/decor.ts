import { z } from 'zod';

import { ColorSchema, HexColorSchema } from './shared';

/** The native splash in one Theme: a plain colour. */
const SplashThemeSchema = z.strictObject({
  backgroundColor: HexColorSchema,
});

/**
 * The splash the native app shows while it starts, before any JavaScript
 * runs: a plain colour in light and dark, the colour the app's own splash
 * cut opens on (ADR 0014, 0070). It is baked into the native build, so
 * changing it needs a new development build.
 */
export const SplashDecorSchema = z.strictObject({
  light: SplashThemeSchema,
  dark: SplashThemeSchema,
});

export type SplashDecor = z.infer<typeof SplashDecorSchema>;

/** SVG path data: move, line, curve and arc commands with their numbers. */
const SvgPathSchema = z
  .string()
  .regex(/^\s*[Mm][MmLlHhVvCcSsQqTtAaZz\d\s,.+-]*$/, 'Expected SVG path data such as M0 0h2v2H0z');

const SizeSchema = z.number().positive();

/**
 * The motif of a Season or a Holiday: the accessory the Mascot wears while
 * seasonal Decor is on (ADR 0055).
 */
export const SeasonalMotifSchema = z.strictObject({
  accessory: z.lazy(() => MascotAccessorySchema),
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
 * The Decor an Edition draws in the app (ADR 0014, `docs/design/README.md`):
 * `editions/<edition>/decor/decor.json`. Every part is optional; without one
 * the Core draws nothing in its place. Decor holds shapes and colours only,
 * never text or behaviour (ADR 0014).
 */
export const EditionDecorSchema = z.strictObject({
  /** The Mascot's vector, which the Core draws in its states (ADR 0070). */
  mascot: MascotFigureSchema.optional(),
  /**
   * Seasonal Decor: a motif for every Season, whose accessory the Mascot
   * wears while «Сезонний декор» is on.
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
