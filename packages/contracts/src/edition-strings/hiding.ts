import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The texts of hiding from a card: the hide button, the hide choice and its undo toasts. */
export const HidingStringsSchema = z.strictObject({
  /** The hide button's VoiceOver label: what a tap will do. */
  button: TextSchema,
  /** The hide choice: the sheet the hide button opens. */
  choice: z.strictObject({
    /** Hides this Entry. */
    entry: TextSchema,
    /** On a Word card: takes the Word's Category, `{category}`, out of the Mix. */
    category: templateOf('category'),
    /** On a Correction card: takes Corrections, as a whole, out of the Mix. */
    corrections: TextSchema,
    /** On an Idiom card: takes Idioms, as a whole, out of the Mix. */
    idioms: TextSchema,
    /** On a Synonym Row card: takes Synonym Rows, as a whole, out of the Mix. */
    synonymRows: TextSchema,
    /** On a Tip card: takes Tips, as a whole, out of the Mix. */
    tips: TextSchema,
    cancel: TextSchema,
  }),
  /** The undo toast after hiding an Entry. Takes `{title}`, what the Entry's row leads with. */
  entryHidden: templateOf('title'),
  /** The undo toast after hiding a Category. Takes `{category}`, its name. */
  categoryHidden: templateOf('category'),
  /** The undo toast after hiding Corrections. */
  correctionsHidden: TextSchema,
  /** The undo toast after hiding Idioms. */
  idiomsHidden: TextSchema,
  /** The undo toast after hiding Synonym Rows. */
  synonymRowsHidden: TextSchema,
  /** The undo toast after hiding Tips. */
  tipsHidden: TextSchema,
  /** The undo button of the toasts. */
  undo: TextSchema,
});
