import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of the Mix screen: the Category chips, the Corrections switch and the last-Category hint. */
export const MixStringsSchema = z.strictObject({
  /** The screen's title; the name of the Settings row. */
  title: TextSchema,
  /** The line under the title. */
  subtitle: TextSchema,
  /** The chip that turns every Category on, and the Settings row's value while every Category is in. */
  all: TextSchema,
  /** The Settings row's value while only some Categories are in the Mix. Takes `{count}`. */
  categories: PluralSchema,
  /** The Corrections switch's name and what it shows. */
  corrections: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
  /** The Rarity Floor choice: its name, the line under it, and a floor's chip. Takes `{rarity}`. */
  rarity: z.strictObject({ title: TextSchema, subtitle: TextSchema, floor: templateOf('rarity') }),
  /** The line that says why the last Category's chip can't be turned off. VoiceOver reads it as that chip's hint. */
  lastCategoryHint: TextSchema,
});
