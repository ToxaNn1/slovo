import { entryRoute } from '@/entries/entry-route';

/**
 * An Entry a Search result opens, which makes nothing Seen (ADR 0054); a
 * Correction, a Synonym Row or a Word its card links opens over it the same way.
 */
export default entryRoute('search');
