import { entryRoute } from '@/entries/entry-route';

/**
 * An Entry opened from the Word of the Day archive, which makes nothing Seen
 * (ADR 0054), or a Correction opened from a Word's Entry screen there.
 */
export default entryRoute('wordsOfTheDay');
