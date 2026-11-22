import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, pluralOf, templateOf } from './shared';

/** The texts of the Mix screen: the Category chips, the switches of Corrections, Idioms, Synonym Rows and Tips, with the Categories of Corrections, and the last-Category hints. */
export const MixStringsSchema = z.strictObject({
  /** The screen's title; the name of the Settings row. */
  title: TextSchema,
  /** The line under the title. */
  subtitle: TextSchema,
  /** The chip that turns every Category on, and the Settings row's value while every Category is in. */
  all: TextSchema,
  /** The Settings row's value while only some Categories are in the Mix. Takes `{count}`. */
  categories: PluralSchema,
  /**
   * The Corrections switch's name and what it shows; the VoiceOver label of a
   * chip of a Category of Corrections under it, which takes `{category}`; and
   * the line that says why the last Category of Corrections can't be turned
   * off, which VoiceOver reads as that chip's hint.
   */
  corrections: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    category: templateOf('category'),
    lastCategoryHint: TextSchema,
  }),
  /** The Idioms switch's name and what it shows. */
  idioms: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
  /** The Synonym Rows switch's name and what it shows; also the Hidden screen's section of hidden rows. */
  synonymRows: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
  /** The Tips switch's name and what it shows; also the Hidden screen's section of hidden Tips. */
  tips: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
  /**
   * The Mix kind weight choice under a kind's switch: its VoiceOver label,
   * which takes `{kind}`, the kind's name, and the names of the three weights.
   */
  kindWeight: z.strictObject({
    title: templateOf('kind'),
    /** The segment that takes the kind out of the Mix, and the one that puts it in while the weights are off. */
    off: TextSchema,
    on: TextSchema,
    less: TextSchema,
    normal: TextSchema,
    more: TextSchema,
  }),
  /**
   * The Quick Question frequency choice: its title, its subtitle and the names
   * of the four frequencies, never, every 20th, every 10th and every 6th card.
   */
  quickQuestion: z.strictObject({
    title: TextSchema,
    subtitle: TextSchema,
    off: TextSchema,
    rare: TextSchema,
    normal: TextSchema,
    often: TextSchema,
    /** What each frequency means, under its name: «без питань», «1 на 20 карток»… */
    lines: z.strictObject({
      off: TextSchema,
      rare: TextSchema,
      normal: TextSchema,
      often: TextSchema,
    }),
  }),
  /**
   * The setting tiles of «Мої Теми» (board XMix, variant E), each opening its
   * sheet, and the value of the rarity tile while every rarity is in.
   */
  tiles: z.strictObject({
    rarity: TextSchema,
    kinds: TextSchema,
    quickQuestion: TextSchema,
    rarityAll: TextSchema,
  }),
  /** The plates of the setting sheets and the button that closes them. */
  sheets: z.strictObject({
    rarity: TextSchema,
    kinds: TextSchema,
    correctionCategories: TextSchema,
    quickQuestion: TextSchema,
    done: TextSchema,
  }),
  /**
   * The Categories of Corrections on the kinds' sheet: the row under the
   * Corrections choice that opens them, its count (`{selected}`, `{total}`),
   * the heading of their own sheet with the count, its line and the way back.
   */
  correctionCategories: z.strictObject({
    row: TextSchema,
    count: templateOf('selected', 'total'),
    heading: templateOf('selected', 'total'),
    line: TextSchema,
    back: TextSchema,
  }),
  /**
   * A Category group's button: how many of its Categories are in
   * (`{selected}`, `{total}`) and what a tap does (`{action}`), «усі» or «зняти».
   */
  group: z.strictObject({
    toggle: templateOf('selected', 'total', 'action'),
    all: TextSchema,
    none: TextSchema,
  }),
  /** The count beside the title: how many Categories of Words are in, «12 з 16». */
  count: templateOf('selected', 'total'),
  /** What VoiceOver reads for that count: the Categories in (`{selected}`) of all (`{count}`), «У Міксі 12 з 16 тем». */
  countLabel: pluralOf('selected'),
  /** The line that says why the last Category's chip can't be turned off. VoiceOver reads it as that chip's hint. */
  lastCategoryHint: TextSchema,
});
