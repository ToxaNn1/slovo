import { z } from 'zod';

import { ColorSchema } from './shared';

/**
 * The colour roles of one colour scheme (`docs/design/design-system.md`). The
 * Core names the roles; an Edition supplies the values.
 */
export const ColorTokensSchema = z.strictObject({
  /** The screen. */
  background: ColorSchema,
  /** Cards, grouped lists and sheets. */
  surface: ColorSchema,
  /** Primary text. */
  ink: ColorSchema,
  /** Secondary labels: part of speech, captions. */
  muted: ColorSchema,
  /** The active tab, links, the Pronunciation button, selected controls. */
  accent: ColorSchema,
  /** Decor only; never carries text. */
  decor: ColorSchema,
  /** Examples, synonym values, row subtitles. */
  inkSecondary: ColorSchema,
  /** Category chips, the example-pair box, skeleton blocks. */
  surfaceSunken: ColorSchema,
  /** The track of a segmented control or a progress bar. */
  track: ColorSchema,
  /** Card borders, list separators, the tab bar's top line. */
  line: ColorSchema,
  /** Tab bar items that are not selected. */
  inactiveTab: ColorSchema,
  /** A correct answer and the ✓ of a Correction's example pair; never Decor. */
  correct: ColorSchema,
  /** The filled heart of an Entry in Favorites; never Decor. */
  heart: ColorSchema,
  /** Delete and Clear actions, with white text on them; never Decor. */
  destructive: ColorSchema,
});

export type ColorTokens = z.infer<typeof ColorTokensSchema>;

const RadiusSchema = z.number().nonnegative();

/**
 * The design tokens an Edition supplies: `editions/<edition>/tokens.json`.
 * Each group is optional; the Core's neutral tokens fill a group the Edition
 * leaves out. Layouts, sizes and touch targets are never tokens (ADR 0006).
 */
export const EditionTokensSchema = z.strictObject({
  colors: z.strictObject({ light: ColorTokensSchema, dark: ColorTokensSchema }).optional(),
  /** Font family names: `word` for Lemmas, Definitions and Examples, `ui` for the rest. */
  fontFamilies: z.strictObject({ word: z.string().min(1), ui: z.string().min(1) }).optional(),
  radii: z
    .strictObject({
      card: RadiusSchema,
      chip: RadiusSchema,
      button: RadiusSchema,
      sheet: RadiusSchema,
    })
    .optional(),
});

export type EditionTokens = z.infer<typeof EditionTokensSchema>;
