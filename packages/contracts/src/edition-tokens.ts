import { z } from 'zod';

import { ColorSchema } from './shared';

/**
 * The colour roles of one colour scheme (ADR 0070, `docs/design/README.md`). The
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
  /** Category chips, the example-pair box, skeleton blocks. */
  surfaceSunken: ColorSchema,
  /** Card borders, list separators, the tab bar's top line. */
  line: ColorSchema,
  /**
   * A correct answer, as text in this scheme («Правильно!») and the ✓ of a
   * Correction's example pair; the light scheme's also fills the right option
   * under white text in both Themes. Never Decor.
   */
  correct: ColorSchema,
  /**
   * A wrong answer, as text in this scheme («Не цього разу»); the light
   * scheme's also fills the reader's wrong choice under white text in both
   * Themes. Never Decor.
   */
  wrong: ColorSchema,
  /** The filled heart of an Entry in Favorites; never Decor. */
  heart: ColorSchema,
  /** Delete and Clear actions, with white text on them; never Decor. */
  destructive: ColorSchema,
  /** The face of a tile or button. */
  tile: ColorSchema,
  /** The 3D edge of a tile, and its offset shadow. */
  tileEdge: ColorSchema,
  /** The red's edge and its pressed shadow. */
  accentEdge: ColorSchema,
  /** Text and marks on the accent. */
  onAccent: ColorSchema,
  /** The crossword's Word, the selected letter. */
  highlight: ColorSchema,
  /** The off track, the locked Badge, the empty tile. */
  silhouette: ColorSchema,
  /** The tab bar, drawn over a blur. */
  tabBar: ColorSchema,
});

export type ColorTokens = z.infer<typeof ColorTokensSchema>;

/** The name of one colour role. */
export const ColorRoleSchema = ColorTokensSchema.keyof();

export type ColorRole = z.infer<typeof ColorRoleSchema>;

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
      tile: RadiusSchema,
      card: RadiusSchema,
      chip: RadiusSchema,
      button: RadiusSchema,
      sheet: RadiusSchema,
    })
    .optional(),
});

export type EditionTokens = z.infer<typeof EditionTokensSchema>;
