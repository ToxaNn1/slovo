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
 * The Decor an Edition draws in the app, by slot (`docs/design/design-system.md`):
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
  /**
   * Seasonal Decor: a motif for every Season, shown in slots 1 and 2 while
   * «Сезонний декор» is on. Without it the slots keep their plain Decor.
   */
  seasons: SeasonMotifsSchema.optional(),
  /** The Holidays, whose motif shows instead of the Season's on their day. */
  holidays: z.array(HolidaySchema).optional(),
});

export type EditionDecor = z.infer<typeof EditionDecorSchema>;
