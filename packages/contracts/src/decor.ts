import { z } from 'zod';

/** A colour as six hex digits, e.g. `#F5EEE2`. */
const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a six-digit hex colour such as #F5EEE2');

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
