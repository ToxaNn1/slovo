import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The Tip card's own strings; its forms and sources take the Correction card's labels. */
export const TipCardStringsSchema = z.strictObject({
  /**
   * The word that names the kind, e.g. "порада": the card's kicker, drawn in
   * capitals («ПОРАДА»), and the Share Card's overline.
   */
  chip: TextSchema,
  /** What VoiceOver reads for the title, e.g. "Порада: {title}". */
  heading: templateOf('title'),
  /**
   * The names of the Tip card's tabs (ADR 0091), e.g. "Правило"; "Винятки"
   * only on a Tip with exceptions, while `tipExceptions` is on (ADR 0120).
   */
  tabs: z.strictObject({ rule: TextSchema, exceptions: TextSchema }),
});
