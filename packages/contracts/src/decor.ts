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
});

export type EditionDecor = z.infer<typeof EditionDecorSchema>;
