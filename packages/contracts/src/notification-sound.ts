import { z } from 'zod';

/** The containers iOS plays for a local notification's custom sound. */
export type NotificationSoundFormat = 'wav' | 'aiff' | 'caf';

/** The file extension of each format. */
const NOTIFICATION_SOUND_EXTENSIONS: readonly NotificationSoundFormat[] = ['caf', 'wav', 'aiff'];

/**
 * The file name of an Edition's notification sound in its `assets/` folder:
 * a plain name in a format iOS plays for notifications.
 */
export const NotificationSoundFileSchema = z
  .string()
  .regex(
    new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]*\\.(${NOTIFICATION_SOUND_EXTENSIONS.join('|')})$`),
    `Expected a plain file name ending in ${NOTIFICATION_SOUND_EXTENSIONS.map((extension) => `.${extension}`).join(', ')}`,
  );
