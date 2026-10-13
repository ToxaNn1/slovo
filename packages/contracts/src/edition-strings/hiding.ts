import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The texts of hiding from a card: the hide button, the hide choice and its undo toasts. */
export const HidingStringsSchema = z.strictObject({
  /** The hide button's VoiceOver label: what a tap will do. */
  button: TextSchema,
  /** The hide choice: the system action sheet the hide button opens. */
  choice: z.strictObject({
    /** Hides this Entry. */
    entry: TextSchema,
    cancel: TextSchema,
  }),
  /** The undo toast after hiding an Entry. Takes `{title}`, what the Entry's row leads with. */
  entryHidden: templateOf('title'),
  /** The undo button of the toasts. */
  undo: TextSchema,
});
