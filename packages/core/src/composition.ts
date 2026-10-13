import { openCycle } from './cycle';
import type { Edition } from './edition';
import { createEntries } from './entries';
import { openFeed, type Feed } from './feed';
import type { Clock, ContentReadPort, Random } from './ports';
import type { UserState } from './user-state';
import { openWordOfTheDay } from './word-of-the-day';

/**
 * The Core features that open once the Language Pack is open, linked to each
 * other inside the composition, so a shell subscribes to what it draws and
 * holds no rule between them (ADR 0018). The settings open before the
 * Language Pack and stay apart.
 */
export interface Composition {
  /** The Feed of the app session. */
  readonly feed: Feed;
}

/**
 * Opens the composition for a new app session, once the Language Pack is
 * open: one Entries module, one Cycle and one Word of the Day over the stored
 * user state, shared by every feature it opens. The Cycle and the Word of the
 * Day keep their state in memory for the session (ADR 0013), so open one
 * composition per app session.
 */
export async function openComposition({
  content,
  edition,
  userState,
  clock,
  random,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  random: Random;
}): Promise<Composition> {
  const entries = createEntries({ content, edition });
  const cycle = await openCycle({ entries, userState, random });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  const feed = await openFeed({ entries, userState, clock, cycle, wordOfTheDay });
  return { feed };
}
