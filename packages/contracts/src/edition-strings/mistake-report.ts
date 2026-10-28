import { z } from 'zod';

import { TextSchema } from '../shared';

/** The texts of a Mistake Report: the card menu's action, the sheet and its toasts (ADR 0056). */
export const MistakeReportStringsSchema = z.strictObject({
  /** The card menu's action that opens the sheet, e.g. «Повідомити про помилку». */
  action: TextSchema,
  /** The name of every type of mistake the reader picks from. */
  types: z.strictObject({
    typo: TextSchema,
    stress: TextSchema,
    definition: TextSchema,
    other: TextSchema,
  }),
  /** The label of the comment field, which says it is optional. */
  comment: TextSchema,
  /** The button that sends the report and closes the sheet. */
  send: TextSchema,
  /** The toast once the report is taken. */
  sent: TextSchema,
  /** The toast when the reader has sent too many reports today. */
  tooMany: TextSchema,
});
