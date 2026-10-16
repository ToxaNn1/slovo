import { localDayOf, type Clock, type WordFeedCard } from '@slovo/core';

/** The Story Share Card's image in pixels: a true 9:16. */
const STORY_IMAGE = { width: 1080, height: 1920 } as const;

/** What the system share sheet came to: the reader sent the image somewhere, or closed it. */
export type ShareSheetResult = 'shared' | 'cancelled';

/** What sharing the image of a Share Card needs from the device. */
export interface ShareImagePorts {
  /** Draws the Share Card into a PNG of `size` pixels; resolves to its temporary file. */
  capture(size: { readonly width: number; readonly height: number }): Promise<string>;
  /** Moves the file into the app's cache directory as `name`, over one of that name; resolves to its file URL. */
  keepInCache(file: string, name: string): Promise<string>;
  /** Opens the system share sheet with the file and resolves once the reader closes it. */
  openShareSheet(url: string): Promise<ShareSheetResult>;
}

/**
 * What sharing came to: the share sheet opened and closed, shared or
 * cancelled alike, or something failed on the way, so the reader can try again.
 */
export type ShareOutcome = 'closed' | 'failed';

/**
 * Shares the Share Card of an Entry as an image: captures it as a 1080×1920
 * PNG, keeps the file in the cache directory under the Entry's name, so a
 * new share of the same Entry replaces it, and opens the system share sheet
 * with the file. Writes no user state.
 */
export async function shareCardImage(
  ports: ShareImagePorts,
  entryId: string,
): Promise<ShareOutcome> {
  try {
    const file = await ports.capture(STORY_IMAGE);
    const url = await ports.keepInCache(file, `share-card-${entryId}.png`);
    await ports.openShareSheet(url);
    return 'closed';
  } catch {
    return 'failed';
  }
}

/**
 * Whether a Word's card is the card of today's Word of the Day, so its Share
 * Card says so. A Feed left open over midnight still holds the day before's.
 */
export function isTodaysWordOfTheDay(card: WordFeedCard, clock: Clock): boolean {
  const day = card.wordOfTheDay;
  if (day === undefined) return false;
  const today = localDayOf(clock.now(), clock).date;
  return day.year === today.year && day.month === today.month && day.day === today.day;
}
