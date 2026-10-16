import { z } from 'zod';

import { TextSchema } from '../shared';

/** The texts of sharing an Entry: the share button, the share sheet and the Share Card's own labels. */
export const ShareStringsSchema = z.strictObject({
  /** The action row's share button, as VoiceOver reads it: what a tap will do. */
  button: TextSchema,
  /** The title of the sheet with the Share Card's preview. */
  title: TextSchema,
  /** The sheet's primary button, which opens the system share sheet with the image. */
  share: TextSchema,
  /** The overline of the Share Card of today's Word of the Day, in place of its Category. */
  wordOfTheDay: TextSchema,
  /** The toast when the image of the Share Card could not be made. */
  captureFailed: TextSchema,
});
