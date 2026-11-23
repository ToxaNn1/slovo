import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of the Hidden screen: Hidden Entries, Hidden Categories and bringing them back. */
export const HiddenStringsSchema = z.strictObject({
  /** The screen's title. */
  title: TextSchema,
  /** The line under the title. */
  subtitle: TextSchema,
  /** The heading over the Hidden Entries. */
  entries: TextSchema,
  /** The heading over the Hidden Categories. */
  categories: TextSchema,
  /** How many Entries are hidden, in the value of the rows that open the screen. Takes `{count}`. */
  count: PluralSchema,
  /** How many Categories are hidden, in the same value. Takes `{count}`. */
  countCategories: PluralSchema,
  /** How many kinds of cards are out of the Mix, in the same value. Takes `{count}`. */
  countKinds: PluralSchema,
  /** What joins the parts of that value, e.g. «4 типи карток · 1 запис». */
  countSeparator: TextSchema,
  /** The button that brings an Entry back. */
  restore: TextSchema,
  /** The same button as VoiceOver reads it. Takes `{title}`, what the row leads with. */
  restoreLabel: templateOf('title'),
  /** The button that puts a Category back in the Mix. */
  turnOn: TextSchema,
  /** The same button as VoiceOver reads it. Takes `{name}`, the Category's name. */
  turnOnLabel: templateOf('name'),
  /** The Corrections row's button as VoiceOver reads it. */
  turnOnCorrectionsLabel: TextSchema,
  /** The Idioms row's button as VoiceOver reads it. */
  turnOnIdiomsLabel: TextSchema,
  /** What VoiceOver reads for the «Увімкнути» button of Synonym Rows out of the Mix. */
  turnOnSynonymRowsLabel: TextSchema,
  /** What VoiceOver reads for the «Увімкнути» button of Tips out of the Mix. */
  turnOnTipsLabel: TextSchema,
  /** What labels a row under its Lemma, e.g. «слово · ім., ж. р.». Takes `{kind}` and `{labels}`. */
  rowLabels: templateOf('kind', 'labels'),
  /** The same line as VoiceOver reads it. Takes `{kind}` and `{labels}`. */
  rowLabelsSpoken: templateOf('kind', 'labels'),
  /** What joins the labels of a row, e.g. «, ». */
  labelSeparator: TextSchema,
  /** The undo toast after bringing an Entry back. Takes `{title}`, what the Entry's row leads with. */
  entryRestored: templateOf('title'),
  /** The undo button of that toast. */
  undo: TextSchema,
  /** Shown when nothing is hidden. */
  empty: TextSchema,
  /** The one action of every row of the one list, whatever is hidden. */
  show: TextSchema,
  /** What VoiceOver reads for it. Takes `{title}`, the row's name. */
  showLabel: templateOf('title'),
  /** The kind label under a row's name in the one list. */
  kinds: z.strictObject({ entry: TextSchema, category: TextSchema, kind: TextSchema }),
});
