import { openCollections, type Collections } from './collections';
import { openCycle } from './cycle';
import type { Edition } from './edition';
import { createEntries } from './entries';
import { createEntryRows, type EntryRowModel } from './entry-row';
import { openFavorites, type Favorites } from './favorites';
import { buildEntryCard, openFeed, type EntryFeedCard, type Feed } from './feed';
import { openHistory, type History } from './history';
import { openHiddenEntries, type HiddenEntries } from './hidden-entries';
import { createHiding, type Hiding } from './hiding';
import { openMix, type Mix, type MixEdition } from './mix';
import { openNotifications, type Notifications, type NotificationsEdition } from './notifications';
import { openOnboarding, type Onboarding } from './onboarding';
import type { Clock, ContentReadPort, Random } from './ports';
import { openProgress, type Progress } from './progress';
import type { UserState } from './user-state';
import { openWordOfTheDay } from './word-of-the-day';

/**
 * The Core features that open once the Language Pack is open, linked to each
 * other inside the composition, so a shell subscribes to what it draws and
 * holds no rule between them (ADR 0018). The settings open before the
 * Language Pack and stay apart. Its `hide` and `unhide` hold the rules of
 * the card's hide action and of the Hidden screen, each with its undo, so the
 * shell only shows the action sheet and the toast.
 */
export interface Composition extends Hiding {
  /** The Feed of the app session. */
  readonly feed: Feed;
  /** Favorites, which a heart tapped anywhere changes. */
  readonly favorites: Favorites;
  /** Collections, which the sheet and the Collections screens change. */
  readonly collections: Collections;
  /** History, which the Feed records in the same write as Seen. */
  readonly history: History;
  /** The Hidden Entries, eligible nowhere until restored. */
  readonly hiddenEntries: HiddenEntries;
  /** The Mix, whose Categories out of it are the Hidden Categories (ADR 0019). */
  readonly mix: Mix;
  /** Progress: the Streak and the Best Streak, derived from the Active Days. */
  readonly progress: Progress;
  /**
   * Tells the composition the reader is back: the app returned to the
   * foreground, or a new local day started while it was open. Today becomes
   * an Active Day, as it does when the composition opens.
   */
  resume(): Promise<void>;
  /** The Notification times and the notification sound, kept on this device. */
  readonly notifications: Notifications;
  /** Whether the reader finished the onboarding, which opens on launch until they do. */
  readonly onboarding: Onboarding;
  /**
   * The Entry card of any Entry, Retired or not, for a screen that opens a
   * kept Entry; nothing for an id the Language Pack doesn't have. Opening it
   * never makes the Entry Seen: Seen comes from the Feed or a notification.
   */
  entryCard(entryId: string): Promise<EntryFeedCard | undefined>;
  /**
   * Opens a Word from a notification: its Entry card, like `entryCard`, once
   * it is Seen, in History and today is an Active Day, in one write. It joins
   * History as the Word of the Day's card only if it is today's Word of the
   * Day. A Hidden or Retired Word opens as a kept Entry and is Seen only if it
   * is still eligible, so a Hidden Entry never re-enters History. Nothing for
   * an id the Language Pack doesn't have: the Feed opens instead. Opening it
   * again writes nothing new.
   */
  openedFromNotification(entryId: string): Promise<EntryFeedCard | undefined>;
  /** The row model of any Entry, Retired or not, for a list; nothing for an id the Language Pack doesn't have. */
  entryRow(entryId: string): Promise<EntryRowModel | undefined>;
}

/**
 * Opens the composition for a new app session, once the Language Pack is
 * open: one Entries module, one Cycle and one Word of the Day over the stored
 * user state, shared by every feature it opens. The Cycle and the Word of the
 * Day keep their state in memory for the session (ADR 0013), so open one
 * composition per app session. Opening it makes today an Active Day.
 */
export async function openComposition({
  content,
  edition,
  userState,
  clock,
  random,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'isFeatureEnabled'> & MixEdition & NotificationsEdition;
  userState: UserState;
  clock: Clock;
  random: Random;
}): Promise<Composition> {
  const entries = createEntries({ content, edition, userState });
  const rows = createEntryRows(entries);
  const cycle = await openCycle({ entries, userState, random });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  const { history, recorder } = await openHistory({ rows, userState });
  const { feed, followEligibility, markOpenedSeen } = await openFeed({
    entries,
    userState,
    clock,
    cycle,
    wordOfTheDay,
    history: recorder,
  });
  /**
   * After a hide, a restore or a Mix change, the Cycle reads the eligible
   * Entries again and the Feed follows.
   */
  async function eligibilityChanged(): Promise<void> {
    await cycle.readEligibleAgain();
    await followEligibility();
  }
  const [favorites, collections, hiddenEntries, mix, notifications, onboarding] = await Promise.all(
    [
      openFavorites({ rows, userState, clock }),
      openCollections({ rows, userState, clock, random }),
      openHiddenEntries({ rows, userState, clock, eligibilityChanged }),
      openMix({ edition, userState, eligibilityChanged }),
      openNotifications({ edition, userState }),
      openOnboarding({ userState, clock }),
    ],
  );
  const { progress, recordToday, todayChange } = await openProgress({ userState, clock });
  await recordToday();
  async function entryCard(entryId: string): Promise<EntryFeedCard | undefined> {
    const entry = await entries.get(entryId);
    return entry === undefined ? undefined : buildEntryCard(entries, entry);
  }
  return {
    feed,
    favorites,
    collections,
    history,
    hiddenEntries,
    mix,
    progress,
    resume: recordToday,
    notifications,
    onboarding,
    ...createHiding({ rows, hiddenEntries, mix }),
    entryCard,
    async openedFromNotification(entryId) {
      const today = todayChange();
      await markOpenedSeen(entryId, today.changes);
      today.commit();
      return entryCard(entryId);
    },
    entryRow: (entryId) => rows.row(entryId),
  };
}
