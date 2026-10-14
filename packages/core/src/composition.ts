import { openCollections, type Collections } from './collections';
import { openCycle } from './cycle';
import { createDayChange } from './day-change';
import type { Edition } from './edition';
import { createEntries } from './entries';
import { createEntryRows, type EntryRowModel } from './entry-row';
import { openFavorites, type Favorites } from './favorites';
import { buildEntryCard, openFeed, type EntryFeedCard, type Feed } from './feed';
import { openHistory, type History } from './history';
import { openHiddenEntries, type HiddenEntries } from './hidden-entries';
import { createHiding, type Hiding } from './hiding';
import { openMix, type Mix, type MixEdition } from './mix';
import type { NotificationScheduling } from './notification-plan';
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
  /**
   * Progress: the Streak and the Best Streak, derived from the Active Days,
   * and the stats sheet's counts, which a heart, a Collection change and a
   * Seen Entry change at once.
   */
  readonly progress: Progress;
  /**
   * Tells the composition the app is in the foreground: it came back from the
   * background, or the shell's timer fired when the next local day started
   * while it was open (see `untilNextLocalDay`). The composition decides
   * whether a new local day started and turns to it in one fixed order: the
   * morning Word becomes the Word of the Day, today an Active Day, the
   * notification plan is made again and the Feed opens the day. On the same
   * day it only reads the permission again and plans by it. It runs in turn
   * with `openedFromNotification`, so the two never run side by side.
   */
  resume(): Promise<void>;
  /** The Notification times, the notification sound and the plan, kept on this device. */
  readonly notifications: Notifications;
  /**
   * The onboarding, which opens on launch until the reader finishes it: its
   * steps, the ask for permission that ends it, and its sample notification,
   * taken from the plan.
   */
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
   * Day, which on a new day is the Word of its morning notification. A
   * Hidden or Retired Word opens as a kept Entry and is Seen only if it is
   * still eligible, so a Hidden Entry never re-enters History. Nothing for
   * an id the Language Pack doesn't have: the Feed opens instead. Opening it
   * again writes nothing new. On a new local day it turns the composition to
   * the day, as `resume` does, with today's Active Day in the Word's write.
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
 * composition per app session. Opening it makes today an Active Day and
 * makes the notification plan, which `scheduling` hands to the device;
 * without it, as in tools and in tests of other features, nothing is planned.
 */
export async function openComposition({
  content,
  edition,
  userState,
  clock,
  random,
  scheduling,
}: {
  content: ContentReadPort;
  edition: Pick<Edition, 'isFeatureEnabled'> & MixEdition & NotificationsEdition;
  userState: UserState;
  clock: Clock;
  random: Random;
  scheduling?: NotificationScheduling;
}): Promise<Composition> {
  const entries = createEntries({ content, edition, userState });
  const rows = createEntryRows(entries);
  const cycle = await openCycle({ entries, userState, random });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  const { history, recorder } = await openHistory({ rows, userState });
  // The plan follows the Feed: a Reserved Word Seen there gets its notification a new Word.
  const { notifications, replan, followSeen, nextMorning } = await openNotifications({
    edition,
    userState,
    cycle,
    entries,
    clock,
    wordOfTheDay,
    // The day change opens last, once the plan and the Feed it turns are open.
    takeMorningWord: () => day.takeMorningWord(),
    scheduling,
  });
  const { feed, followEligibility, markOpenedSeen, openDay } = await openFeed({
    entries,
    userState,
    clock,
    cycle,
    wordOfTheDay,
    history: recorder,
    entrySeen: followSeen,
  });
  /**
   * After a hide, a restore or a Mix change, the Cycle reads the eligible
   * Entries again, and the Feed and the plan follow.
   */
  async function eligibilityChanged(): Promise<void> {
    await cycle.readEligibleAgain();
    await followEligibility();
    await replan();
  }
  const [favorites, collections, hiddenEntries, mix] = await Promise.all([
    openFavorites({ rows, userState, clock }),
    openCollections({ rows, userState, clock, random }),
    openHiddenEntries({ rows, userState, clock, eligibilityChanged }),
    openMix({ edition, userState, eligibilityChanged }),
  ]);
  const { progress, recordToday, todayChange } = await openProgress({
    userState,
    clock,
    history,
    favorites,
    collections,
  });
  const day = createDayChange({
    clock,
    wordOfTheDay,
    recordToday,
    todayChange,
    replan,
    openFeedDay: openDay,
  });
  await day.resume();
  // Once the day is turned to, so the welcome shows today's Word of the Day.
  const onboarding = await openOnboarding({
    userState,
    clock,
    entries,
    wordOfTheDay,
    notifications,
    nextMorning,
  });
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
    resume: () => day.resume(),
    notifications,
    onboarding,
    ...createHiding({ rows, hiddenEntries, mix }),
    entryCard,
    async openedFromNotification(entryId) {
      await day.opened((activeDay) => markOpenedSeen(entryId, activeDay));
      return entryCard(entryId);
    },
    entryRow: (entryId) => rows.row(entryId),
  };
}
