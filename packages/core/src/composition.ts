import { openCollections, type Collections } from './saved/collections';
import { anagramMode } from './game/anagram-mode';
import { anglicismMode } from './game/anglicism-mode';
import { buildIdiomMode } from './game/build-idiom-mode';
import { byLettersMode } from './game/by-letters-mode';
import { correctionMode } from './game/correction-mode';
import {
  openDailyCrossword,
  type CrosswordReadPort,
  type DailyCrossword,
} from './crossword/daily-crossword';
import { openCycle } from './feed/cycle';
import { createDayChange } from './feed/day-change';
import type { Edition } from './edition/edition';
import { createEntries } from './entries/entries';
import { createEntryRows, type EntryRowModel } from './entries/entry-row';
import { openFavorites, type Favorites } from './saved/favorites';
import { buildEntryCard, buildFeedCard, openFeed, type Feed } from './feed/feed';
import { asReviewIfDue, type AnyEntryCard } from './feed/feed-card';
import { openGame, type Game } from './game/game';
import type { GameEdition, GameMode } from './game/game-mode';
import { guessWord } from './game/guess-word';
import { idiomMeaningMode } from './game/idiom-meaning-mode';
import { pairsMode } from './game/pairs-mode';
import { stressMode } from './game/stress-mode';
import { typeWordMode } from './game/type-word-mode';
import { openHistory, type History } from './saved/history';
import { openKnowledge, type Knowledge } from './knowledge/knowledge';
import { openHiddenEntries, type HiddenEntries } from './hidden/hidden-entries';
import { createHiding, type Hiding } from './hidden/hiding';
import { openMix, type Mix, type MixEdition } from './entries/mix';
import type { NotificationScheduling } from './notifications/notification-plan';
import {
  openNotifications,
  type Notifications,
  type NotificationsEdition,
} from './notifications/notifications';
import { openOnboarding, type Onboarding } from './onboarding';
import type { Clock, ContentReadPort, Random, Schedule } from './ports';
import { openProgress, type Progress } from './progress';
import type { UserState } from './user-state/user-state';
import { createWidget, type Widget } from './widget';
import { openWordOfTheDay } from './feed/word-of-the-day';

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
  /** The Knowledge Marks, which an Entry card's «Знаю» and «Не знаю» change (ADR 0043). */
  readonly knowledge: Knowledge;
  /**
   * Progress: the Streak and the Best Streak, derived from the Active Days,
   * the stats sheet's counts, which a heart, a Collection change and a Seen
   * Entry change at once, the Game's best result and the knowledge counts.
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
   * with an Entry opened from a notification or the widget, so the two never
   * run side by side. Should every try to plan the Game's offers have failed,
   * the Game tries again.
   */
  resume(): Promise<void>;
  /** The Notification times, the notification sound and the plan, kept on this device. */
  readonly notifications: Notifications;
  /**
   * The Game: the Game Modes on offer, which a hide, a restore or a Mix change
   * may stop or let start, and the Game in play, kept in memory for the session.
   */
  readonly game: Game;
  /**
   * The onboarding, which opens on launch until the reader finishes it: its
   * steps, with SLOVO ID last when the Edition has the Account, the ask for
   * permission, and its sample notification, taken from the plan.
   */
  readonly onboarding: Onboarding;
  /**
   * Opens today's Daily Crossword with the letters this device kept for it,
   * for its card and its screen; nothing when the Edition has it off, the pack
   * has no day for the local date or the composition was opened without
   * `crossword`. Open it again once the next local day starts.
   */
  openDailyCrossword(): Promise<DailyCrossword | undefined>;
  /**
   * The Entry card of any Entry, Retired or not, for a screen that opens a
   * kept Entry or the Synonym Row a Word card links back to; nothing for an id the Language Pack doesn't have. The card of
   * today's Word of the Day carries its day, and the card of an Entry due for
   * Review is a Review (`review`), as in the Feed. Opening it never
   * makes the Entry Seen: Seen comes from the Feed, a notification or the
   * widget.
   */
  entryCard(entryId: string): Promise<AnyEntryCard | undefined>;
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
  openedFromNotification(entryId: string): Promise<AnyEntryCard | undefined>;
  /** The row model of any Entry, Retired or not, for a list; nothing for an id the Language Pack doesn't have. */
  entryRow(entryId: string): Promise<EntryRowModel | undefined>;
  /**
   * The home-screen widget: the Widget Snapshot the app writes for it, and an
   * Entry opened from it (ADR 0026).
   */
  readonly widget: Widget;
  /**
   * Closes the composition, once the shell opened another over the same user
   * state (ADR 0036): from then on it writes nothing to the user state, hands
   * the device no plan, and the Game tries no planning of its offers again.
   * What it reads stays as it was. Resolves once the writes and the plans it
   * had under way end; never rejects.
   */
  close(): Promise<void>;
}

/**
 * The ports the composition writes through, made to do nothing once it
 * closes: a write, a plan handed to the device or a planning of the Game's
 * offers tried again. `close` cancels the tries waiting and resolves once the
 * writes and the plans under way end.
 */
function closable({
  userState,
  scheduling,
  schedule,
}: {
  userState: UserState;
  scheduling?: NotificationScheduling;
  schedule?: Schedule;
}): {
  userState: UserState;
  scheduling: NotificationScheduling | undefined;
  schedule: Schedule | undefined;
  close: () => Promise<void>;
} {
  let closed = false;
  const underWay = new Set<Promise<void>>();
  const waiting = new Set<() => void>();
  /** Runs `change` unless the composition is closed, and keeps it under way until it ends. */
  function unlessClosed(change: () => Promise<void>): Promise<void> {
    if (closed) return Promise.resolve();
    const done = change();
    underWay.add(done);
    const end = () => underWay.delete(done);
    done.then(end, end);
    return done;
  }
  return {
    userState: { ...userState, write: (changes) => unlessClosed(() => userState.write(changes)) },
    scheduling: scheduling && {
      ...scheduling,
      scheduler: {
        ...scheduling.scheduler,
        replacePlan: (plan) => unlessClosed(() => scheduling.scheduler.replacePlan(plan)),
      },
    },
    schedule:
      schedule &&
      ((run, delay) => {
        if (closed) return () => undefined;
        const cancel = schedule(() => {
          waiting.delete(cancel);
          run();
        }, delay);
        waiting.add(cancel);
        return () => {
          waiting.delete(cancel);
          cancel();
        };
      }),
    async close() {
      closed = true;
      for (const cancel of waiting) cancel();
      waiting.clear();
      await Promise.allSettled(underWay);
    },
  };
}

/** The Core's own Game Modes, registered through the same Extension Point as an Edition's. */
const coreGameModes: readonly GameMode[] = [
  guessWord,
  correctionMode,
  stressMode,
  pairsMode,
  anagramMode,
  byLettersMode,
  typeWordMode,
  anglicismMode,
  buildIdiomMode,
  idiomMeaningMode,
];

/**
 * Opens the composition for a new app session, once the Language Pack is
 * open: one Entries module, one Cycle and one Word of the Day over the stored
 * user state, shared by every feature it opens. The Cycle and the Word of the
 * Day keep their state in memory for the session (ADR 0013), so open one
 * composition per app session. Opening it makes today an Active Day and
 * makes the notification plan, which `scheduling` hands to the device;
 * without it, as in tools and in tests of other features, nothing is planned.
 * The Game offers the Core's Game Modes, then `gameModes`, the ones an Edition
 * adds through the Extension Point. It tries a failed planning of their
 * offers again by `schedule`, and on each `resume`; without `schedule`, as in
 * tests of other features, only on `resume`. Close it with `close` once
 * another opens over the same user state.
 */
export async function openComposition({
  content,
  edition,
  clock,
  random,
  gameModes = [],
  crossword,
  ...ports
}: {
  content: ContentReadPort;
  /** The Daily Crossword's days, which the pack reader gives next to `content`; without it, as in tests of other features, there is none. */
  crossword?: CrosswordReadPort;
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'> &
    MixEdition &
    NotificationsEdition &
    GameEdition;
  userState: UserState;
  clock: Clock;
  random: Random;
  scheduling?: NotificationScheduling;
  schedule?: Schedule;
  gameModes?: readonly GameMode[];
}): Promise<Composition> {
  const { userState, scheduling, schedule, close } = closable(ports);
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
    // The plan and the day change need each other (`replan`, `takeMorningWord`),
    // so `day` is declared below, once the plan and the Feed it turns are open.
    // That is safe: only a plan and `nextMorning` call it, a plan comes only
    // from `replan`, `followSeen` or a change of the Notification times, sound
    // or permission, and the composition calls none of them before `day.resume()`.
    takeMorningWord: () => day.takeMorningWord(),
    scheduling,
  });
  // Before the Knowledge Marks, which leave a Hidden Entry out. A hide or a
  // restore calls `eligibilityChanged`, which needs the Feed and the Game
  // declared below; that is safe, as none can come before the composition opens.
  const hiddenEntries = await openHiddenEntries({ rows, userState, clock, eligibilityChanged });
  const { knowledge, followDay: followKnowledgeDay } = await openKnowledge({
    edition,
    rows,
    hiddenEntries,
    userState,
    clock,
  });
  const { feed, followEligibility, markOpenedSeen, openDay } = await openFeed({
    entries,
    userState,
    clock,
    cycle,
    knowledge,
    wordOfTheDay,
    history: recorder,
    entrySeen: followSeen,
  });
  const {
    game,
    followEligibility: followGameEligibility,
    planOffers,
  } = await openGame({
    edition,
    entries,
    history,
    knowledge,
    userState,
    random,
    ...(schedule === undefined ? {} : { schedule }),
    modes: [...coreGameModes, ...gameModes],
  });
  /**
   * After a hide, a restore or a Mix change, the Cycle reads the eligible
   * Entries again, and the Feed, the plan and the Game Modes on offer follow.
   */
  async function eligibilityChanged(): Promise<void> {
    await cycle.readEligibleAgain();
    await followEligibility();
    await replan();
    await followGameEligibility();
  }
  const [favorites, collections, mix] = await Promise.all([
    openFavorites({ rows, userState, clock }),
    openCollections({ rows, userState, clock, random }),
    Promise.all([entries.categories(), entries.correctionCategories()]).then(([word, correction]) =>
      openMix({ edition, categories: { word, correction }, userState, eligibilityChanged }),
    ),
  ]);
  const { progress, recordToday, todayChange } = await openProgress({
    userState,
    clock,
    history,
    favorites,
    collections,
    game,
    knowledge,
  });
  const day = createDayChange({
    clock,
    wordOfTheDay,
    followKnowledgeDay,
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
    account: edition.isFeatureEnabled('account'),
  });
  // The Game Modes are planned last: planning reads the whole pack, so the
  // launch never waits for it. A start or a change of eligibility waits its turn
  // behind it, and a planning that fails is tried again (see `planOffers`).
  planOffers();
  async function entryCard(entryId: string): Promise<AnyEntryCard | undefined> {
    const entry = await entries.get(entryId);
    // Today's Word of the Day carries its day, as on its Feed card.
    const today = wordOfTheDay.chosen();
    const card =
      entry?.kind === 'word' && today?.wordId === entry.id
        ? await buildEntryCard(entries, entry, today.date)
        : await buildFeedCard(entries, entryId);
    if (card === undefined) return undefined;
    // A Review wherever its card is shown, as on the Feed (ADR 0043).
    return asReviewIfDue(card, knowledge);
  }
  /** An Entry opened from outside the app, from a notification or the widget: one rule for both. */
  async function openedFromOutside(entryId: string): Promise<AnyEntryCard | undefined> {
    await day.opened((activeDay) => markOpenedSeen(entryId, activeDay));
    return entryCard(entryId);
  }
  return {
    feed,
    favorites,
    collections,
    history,
    hiddenEntries,
    mix,
    knowledge,
    progress,
    resume() {
      planOffers();
      return day.resume();
    },
    notifications,
    game,
    onboarding,
    async openDailyCrossword() {
      if (crossword === undefined) return undefined;
      return openDailyCrossword({ content: crossword, userState, clock, edition });
    },
    ...createHiding({ rows, hiddenEntries, mix }),
    entryCard,
    openedFromNotification: openedFromOutside,
    entryRow: (entryId) => rows.row(entryId),
    widget: createWidget({
      edition,
      entries,
      favorites,
      collections,
      onboarding,
      clock,
      opened: openedFromOutside,
    }),
    close,
  };
}
