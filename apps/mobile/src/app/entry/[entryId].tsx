import { entryRoute } from '@/entries/entry-route';

/**
 * An Entry opened from a link, `slovo-<edition id>://entry/<id>`, or from the
 * Feed. A notification's link opens its Word and the widget's link its Entry,
 * which the Entry screen opens as Seen; a Correction its Word card links opens
 * over it without. A notification tapped or a widget link opened over any of
 * them takes the place of the whole stack (`NotificationTaps`).
 */
export default entryRoute('link');
