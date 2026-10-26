import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The Tip card's own strings; its forms and sources take the Correction card's labels. */
export const TipCardStringsSchema = z.strictObject({
  /** The chip beside the title that names the kind, e.g. "порада". */
  chip: TextSchema,
  /** What VoiceOver reads for the title, e.g. "Порада: {title}". */
  heading: templateOf('title'),
});
