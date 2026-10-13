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
  /** The Settings row's value: how many Entries are hidden. Takes `{count}`. */
  count: PluralSchema,
  /** The button that brings an Entry back. */
  restore: TextSchema,
  /** The same button as VoiceOver reads it. Takes `{title}`, what the row leads with. */
  restoreLabel: templateOf('title'),
  /** The button that puts a Category back in the Mix. */
  turnOn: TextSchema,
  /** The same button as VoiceOver reads it. Takes `{name}`, the Category's name. */
  turnOnLabel: templateOf('name'),
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
});
