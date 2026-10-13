import type { Entry, Word } from '@slovo/contracts';

import { buildCorrectionCard, type CorrectionCardModel } from './correction-card';
import type { Cycle } from './cycle';
import type { Entries } from './entries';
import type { HistoryRecorder } from './history';
import { todayKey, type LocalDate } from './local-date';
import type { Clock } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';
import { buildWordCard, type WordCardModel } from './word-card';
import type { WordOfTheDay, WordOfTheDayChoice } from './word-of-the-day';

/** How long a card must stay on screen before its Entry counts as Seen. */
export const SEEN_DWELL_MS = 1500;

/** One card in this many is a Correction's, while the Cycle has unseen Corrections. */
export const CORRECTION_EVERY = 5;

/** The card of a Word. */
export interface WordFeedCard {
  readonly kind: 'word';
  /** What the card shows, built by the Core. */
  readonly wordCard: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of. */
  readonly wordOfTheDay?: LocalDate;
}

/** The card of a Correction. */
export interface CorrectionFeedCard {
  readonly kind: 'correction';
  /** What the card shows, built by the Core. */
  readonly correctionCard: CorrectionCardModel;
}

/** The card of an Entry: a Word or a Correction. */
export type EntryFeedCard = WordFeedCard | CorrectionFeedCard;

/**
 * One card of the Feed: an Entry, or the end-of-Cycle card that tells the
 * reader every live Entry is Seen and the next card starts a new Cycle.
 */
export type FeedCard = EntryFeedCard | { readonly kind: 'end-of-cycle' };

/** The id of the Entry a card shows, if it shows one. */
export function entryIdOf(card: EntryFeedCard): string;
export function entryIdOf(card: FeedCard | undefined): string | undefined;
export function entryIdOf(card: FeedCard | undefined): string | undefined {
  if (card?.kind === 'word') return card.wordCard.wordId;
  return card?.kind === 'correction' ? card.correctionCard.correctionId : undefined;
}

/**
 * The Feed of one app session. Its cards are the ones shown so far, oldest
 * first; a card's position is its index there, so going back walks them. A
 * card whose Entry stops being eligible leaves them at once, and goes back to
 * its place when its Entry is eligible again (ADR 0015).
 */
export interface Feed {
  /**
   * The cards shown so far. A change never edits this array: it makes a new
   * one and tells the subscribers.
   */
  readonly cards: readonly FeedCard[];
  /**
   * The position of the card the Feed opens on: the card the reader was on,
   * after today's Word of the Day, when they come back the same local day.
   */
  readonly startPosition: number;
  /**
   * The position of the card on screen, as the Feed keeps it, or nothing
   * while none is. It moves with the cards when a change of eligibility drops
   * or puts back cards: the card on screen keeps its place, the next card
   * takes it when the card on screen is dropped, and a card put back takes
   * the screen back if it left it and the reader hasn't moved since. A shell
   * turns to it after the cards change. When no card after the dropped one
   * stays, the next card comes in the same change and takes the screen; only
   * when the Feed has no next card is it one past the last card.
   */
  readonly position: number | undefined;
  /** Calls `listener` after each change of the cards. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Tells the Feed which card is on screen now, or that none is (the screen
   * is out of focus or the app in the background). The card that leaves the
   * screen makes its Entry Seen if it stayed there for at least
   * `SEEN_DWELL_MS` and belongs to the current Cycle. While a card is on
   * screen, the Feed keeps the card after it ready, so the next swipe never
   * waits; on a new local day, today's Word of the Day takes the place of a
   * card got ready the day before. Reporting the card already on screen again keeps its dwell time
   * and only gets the next card ready if that failed before. Resolves once
   * the report is kept and the next card is ready.
   */
  show(position: number | undefined): Promise<void>;
  /**
   * Adds the next card to the session and returns it, or nothing when the
   * Language Pack has no live Entry. After the last unseen Entry of the Cycle
   * comes the end-of-Cycle card.
   */
  next(): Promise<FeedCard | undefined>;
  /**
   * Opens a Correction the Word card at `position` links («often said»): its
   * card goes right after the Word's, and the Feed goes on after it. Returns
   * the position of the Correction's card, or nothing when the Word card
   * doesn't link that Correction.
   */
  openLinkedCorrection(position: number, correctionId: string): Promise<number | undefined>;
}

/**
 * The card of an Entry, built from the Language Pack's Entries. The card of a
 * Word on the day it is the Word of the Day carries that day.
 */
export async function buildEntryCard(
  entries: Entries,
  entry: Word,
  wordOfTheDay?: LocalDate,
): Promise<WordFeedCard>;
export async function buildEntryCard(entries: Entries, entry: Entry): Promise<EntryFeedCard>;
export async function buildEntryCard(
  entries: Entries,
  entry: Entry,
  wordOfTheDay?: LocalDate,
): Promise<EntryFeedCard> {
  if (entry.kind === 'correction') {
    return { kind: 'correction', correctionCard: buildCorrectionCard(entry) };
  }
  const wordCard = await buildWordCard({ word: entry, entries });
  return wordOfTheDay === undefined
    ? { kind: 'word', wordCard }
    : { kind: 'word', wordCard, wordOfTheDay };
}

const { feedPosition } = userStateRecords;

/**
 * Opens the Feed for a new app session, over the Entries, the Cycle and the
 * Word of the Day the Core composition opened and shares with every other
 * feature. It opens on the card the reader was on when they come back the
 * same local day, and otherwise on the Word of the Day, which also opens a
 * new local day in a Feed left open over midnight.
 *
 * After the Cycle's last unseen Entry comes the end-of-Cycle card, and the
 * card after that starts a new Cycle: nothing Seen, a new shuffle from a new
 * seed. When the reader swipes past that Entry before it is Seen, its card
 * comes again in place of the end-of-Cycle card. A new local day that finds every Word Seen starts the new Cycle
 * itself, with its Word of the Day and no end-of-Cycle card, because the
 * Word of the Day always opens the day.
 *
 * The Cycle covers the eligible Entries. When they hold Corrections, every
 * `CORRECTION_EVERY`th card is a Correction's while the Cycle has unseen
 * Corrections. Corrections are shuffled and Seen like Words, and the Cycle
 * ends only once every eligible Word and Correction is Seen. The Word of the
 * Day is always a Word.
 *
 * The composition calls `followEligibility` once the Cycle has read the
 * eligible Entries again: the Feed drops every card whose Entry the Cycle no
 * longer covers and puts back the dropped ones it covers again, see
 * `Feed.position` for the card on screen. A card that leaves the screen this
 * way is Seen by the dwell rule, like any card that leaves it.
 */
export async function openFeed({
  entries,
  userState,
  clock,
  cycle,
  wordOfTheDay,
  history,
}: {
  entries: Entries;
  userState: UserState;
  clock: Clock;
  cycle: Cycle;
  wordOfTheDay: WordOfTheDay;
  history: HistoryRecorder;
}): Promise<{ feed: Feed; followEligibility: () => Promise<void> }> {
  /**
   * Every card of the session, oldest first, also the ones dropped because
   * their Entry stopped being eligible: a dropped card keeps its place here
   * and goes back to it when its Entry is eligible again. Places count in
   * here; positions count in `cards`.
   */
  let session: readonly FeedCard[] = [];
  /** The cards of the session dropped because their Entry is not eligible now. */
  let dropped: ReadonlySet<FeedCard> = new Set();
  /** The cards shown: the session's cards not dropped. */
  let cards: readonly FeedCard[] = [];
  const listeners = new Set<() => void>();
  /** The place of the current Cycle's first card: the cards before it belong to an earlier Cycle. */
  let cycleStart = 0;
  /** The place of the card on screen now, and since when, if one is. */
  let onScreen: { readonly place: number; readonly since: number } | undefined;
  /**
   * The card dropped from the screen while the reader hasn't moved since: it
   * takes the screen back when its Entry is eligible again, as on an undo.
   */
  let droppedFromScreen: FeedCard | undefined;

  /** Changes the session's cards without telling the subscribers yet. */
  function setSession(changed: readonly FeedCard[], changedDropped = dropped): void {
    session = changed;
    dropped = changedDropped;
    cards = session.filter((card) => !dropped.has(card));
  }

  function tellSubscribers(): void {
    for (const listener of listeners) listener();
  }

  function changeSession(changed: readonly FeedCard[], changedDropped = dropped): void {
    setSession(changed, changedDropped);
    tellSubscribers();
  }

  /** The position of the card at `place`, or of the card that will come there. */
  const positionOf = (place: number) =>
    session.slice(0, place).filter((card) => !dropped.has(card)).length;

  /** The place of the card at `position`, or of the card that will come there. */
  function placeOf(position: number): number {
    const card = cards[position];
    return card === undefined ? session.length + position - cards.length : session.indexOf(card);
  }

  /** The cards shown in the current Cycle. */
  const cycleCards = () => session.slice(cycleStart).filter((card) => !dropped.has(card));

  /**
   * The session without the card, if given, for the change about to be made:
   * the places after it move one back, the one on screen too.
   */
  function without(card: FeedCard | undefined): readonly FeedCard[] {
    const place = card === undefined ? -1 : session.indexOf(card);
    if (place === -1) return session;
    if (cycleStart > place) cycleStart -= 1;
    if (onScreen !== undefined && onScreen.place > place)
      onScreen = { ...onScreen, place: onScreen.place - 1 };
    return session.filter((kept) => kept !== card);
  }

  /**
   * Opens on the card the reader was on, if it was today and the Cycle still
   * covers its Entry, after today's Word of the Day, so the reader can go back to it.
   */
  async function restore(): Promise<boolean> {
    const position = await userState.read(feedPosition);
    if (position?.date !== todayKey(clock)) return false;
    if (!cycle.covers(position.entryId)) return false;
    const entry = await entries.get(position.entryId);
    if (entry === undefined) return false;
    const today = wordOfTheDay.chosen();
    const opening =
      today !== undefined && cycle.covers(today.wordId) ? await wordOfTheDayCard(today) : undefined;
    if (opening?.wordCard.wordId === entry.id) changeSession([opening]);
    else
      changeSession([
        ...(opening === undefined ? [] : [opening]),
        await buildEntryCard(entries, entry),
      ]);
    return true;
  }

  /**
   * The ids of the Entries shown in this session in the current Cycle, also
   * the dropped ones, which are shown again when their Entry is eligible again.
   */
  function shownIds(shown = session): Set<string> {
    return new Set(shown.slice(cycleStart).flatMap((card) => entryIdOf(card) ?? []));
  }

  /**
   * The next Entry in the Cycle order: one not shown in this session yet, else
   * one the reader swiped past too quickly to be Seen. Never the Entry of the
   * last card, which the reader is on while the app gets the next card ready:
   * when it is the only unseen Entry left, the Cycle ends after it. A
   * Correction takes its turn every `CORRECTION_EVERY`th card of the Cycle,
   * and either kind of Entry fills in for the other when it has none left.
   */
  function nextEntryId(): string | undefined {
    const { words: unseenWords, corrections: unseenCorrections } = cycle.unseen();
    const shown = shownIds();
    const last = entryIdOf(cards.at(-1));
    const inCycle = cycleCards();
    const sinceCorrection = [...inCycle].reverse().findIndex((card) => card.kind === 'correction');
    const cardsSinceCorrection = sinceCorrection === -1 ? inCycle.length : sinceCorrection;
    const correctionTurn = cardsSinceCorrection >= CORRECTION_EVERY - 1;
    function pick(fits: (id: string) => boolean): string | undefined {
      const word = unseenWords.find(fits);
      const correction = unseenCorrections.find(fits);
      return correctionTurn ? (correction ?? word) : (word ?? correction);
    }
    return pick((id) => !shown.has(id)) ?? pick((id) => id !== last);
  }

  // One request at a time, so two requests never pick the same Entry.
  let lastRequest: Promise<unknown> = Promise.resolve();
  function inTurn<T>(task: () => Promise<T>): Promise<T> {
    const request = lastRequest.then(task);
    lastRequest = request.catch(() => undefined);
    return request;
  }

  async function addNextCard(): Promise<FeedCard | undefined> {
    const last = cards.at(-1);
    // The last card shown is the current Cycle's end-of-Cycle card, not one of
    // an earlier Cycle whose next cards were all dropped.
    const atEnd = last?.kind === 'end-of-cycle' && session.indexOf(last) >= cycleStart;
    const { words: unseenWords, corrections: unseenCorrections } = cycle.unseen();
    // The end-of-Cycle card came too early when the reader left the last unseen
    // Entry before it was Seen: the next card takes its place.
    const tooEarly = atEnd && unseenWords.length + unseenCorrections.length > 0 ? last : undefined;
    // A new local day starts with its Word of the Day, also in a Feed left open over midnight.
    if (wordOfTheDay.chosen() === undefined) {
      const card = await addWordOfTheDay(tooEarly);
      if (card !== undefined) return card;
    }
    if (cycle.isEmpty()) return undefined;
    // The card after the end-of-Cycle card starts a new Cycle.
    if (atEnd && tooEarly === undefined) {
      const started = await cycle.start();
      await userState.write(started.changes);
      started.commit();
      cycleStart = session.length;
    }
    const id = nextEntryId();
    if (id === undefined) {
      const card: FeedCard = { kind: 'end-of-cycle' };
      changeSession([...without(tooEarly), card]);
      return card;
    }
    const entry = await entries.get(id);
    if (entry === undefined) return undefined;
    const card = await buildEntryCard(entries, entry);
    changeSession([...without(tooEarly), card]);
    return card;
  }

  async function insertLinkedCorrection(
    position: number,
    correctionId: string,
  ): Promise<number | undefined> {
    const card = cards[position];
    const linked = card?.kind === 'word' ? card.wordCard.linkedCorrections : [];
    if (card === undefined || !linked.some((link) => link.correctionId === correctionId))
      return undefined;
    // Tapped again: the Correction's card is already there.
    if (entryIdOf(cards[position + 1]) === correctionId) return position + 1;
    const correction = await entries.get(correctionId);
    if (correction?.kind !== 'correction') return undefined;
    const opened = await buildEntryCard(entries, correction);
    const place = session.indexOf(card);
    // The cards after it move one place on, the one on screen too.
    if (cycleStart > place) cycleStart += 1;
    if (onScreen !== undefined && onScreen.place > place)
      onScreen = { ...onScreen, place: onScreen.place + 1 };
    changeSession([...session.slice(0, place + 1), opened, ...session.slice(place + 1)]);
    return position + 1;
  }

  /** The card of a day's Word of the Day. */
  async function wordOfTheDayCard(choice: WordOfTheDayChoice): Promise<WordFeedCard | undefined> {
    const entry = await entries.get(choice.wordId);
    return entry?.kind === 'word' ? buildEntryCard(entries, entry, choice.date) : undefined;
  }

  /**
   * Adds the card of today's Word of the Day at the end, in place of the
   * `replaced` card if given, choosing it first if today has none yet.
   */
  async function addWordOfTheDay(replaced?: FeedCard): Promise<FeedCard | undefined> {
    const today = await wordOfTheDay.today({
      avoid: shownIds(session.filter((card) => card !== replaced)),
    });
    if (today === undefined) return undefined;
    const card = await wordOfTheDayCard(today);
    if (card === undefined) return undefined;
    const kept = without(replaced);
    if (today.startedCycle) cycleStart = kept.length;
    changeSession([...kept, card]);
    return card;
  }

  const next = () => inTurn(addNextCard);

  /** Whether the card on screen is the last one, so the card after it is not ready yet. */
  const nextCardMissing = () =>
    onScreen !== undefined && positionOf(onScreen.place) >= cards.length - 1;

  /**
   * Whether the ready card, the last one, which the reader hasn't reached, was
   * got ready on an earlier local day: today has no Word of the Day yet.
   */
  const readyCardStale = () =>
    onScreen !== undefined &&
    positionOf(onScreen.place) < cards.length - 1 &&
    wordOfTheDay.chosen() === undefined;

  /** Puts today's Word of the Day in place of a ready card got ready on an earlier local day. */
  async function replaceStaleReadyCard(): Promise<void> {
    if (readyCardStale()) await addWordOfTheDay(cards.at(-1));
  }

  // One card is got ready at a time; it goes on while the card on screen is the last.
  let gettingReady: Promise<void> | undefined;
  function keepNextCardReady(): Promise<void> {
    if (gettingReady === undefined && (nextCardMissing() || readyCardStale())) {
      gettingReady = (async () => {
        try {
          await inTurn(replaceStaleReadyCard);
          while (nextCardMissing()) {
            if ((await next()) === undefined) return;
          }
        } finally {
          gettingReady = undefined;
        }
      })();
    }
    return gettingReady ?? Promise.resolve();
  }

  /** The Entry of a card that left the screen, if it stayed there long enough to be Seen. */
  function seenOnLeaving(left: FeedCard | undefined, stayed: number): string | undefined {
    const entryId = entryIdOf(left);
    // A card of an earlier Cycle counts for that Cycle only.
    if (left === undefined || entryId === undefined || session.indexOf(left) < cycleStart)
      return undefined;
    return stayed < SEEN_DWELL_MS ? undefined : entryId;
  }

  /**
   * Keeps a change of the card on screen in one write: the Entry of the card
   * that `left` Seen if it stayed long enough, with its History entry, and
   * the reader's place on the Entry now on screen, if any.
   */
  async function keepScreenChange({
    left,
    stayed,
    entryId,
    now,
    date,
  }: {
    left: FeedCard | undefined;
    stayed: number;
    entryId: string | undefined;
    now: number;
    /** Today's key, as the reader's place keeps it. */
    date: string;
  }): Promise<void> {
    const seenId = seenOnLeaving(left, stayed);
    const seen = seenId === undefined ? undefined : cycle.markSeen(seenId);
    const changes = new Map([
      ...(seen?.changes ?? []),
      ...(entryId === undefined ? [] : feedPosition.change({ entryId, date })),
    ]);
    // An Entry that becomes Seen joins History in the same write (ADR 0018).
    if (seenId !== undefined && (seen?.changes.size ?? 0) > 0) {
      const wordOfTheDay = left?.kind === 'word' && left.wordOfTheDay !== undefined;
      await history.record({ entryId: seenId, seenAt: new Date(now), wordOfTheDay }, changes);
    } else if (changes.size > 0) await userState.write(changes);
    seen?.commit();
  }

  async function show(position: number | undefined): Promise<void> {
    const place = position === undefined ? undefined : placeOf(position);
    if (place === onScreen?.place) return keepNextCardReady();
    droppedFromScreen = undefined;
    const now = clock.now().getTime();
    const left = onScreen === undefined ? undefined : session[onScreen.place];
    const stayed = onScreen === undefined ? 0 : now - onScreen.since;
    onScreen = place === undefined ? undefined : { place, since: now };
    const entryId = place === undefined ? undefined : entryIdOf(session[place]);
    const date = todayKey(clock);
    // In turn with the requests that change the cards, so a new Cycle never
    // starts between the card leaving the screen and its Entry becoming Seen.
    const kept = inTurn(() => keepScreenChange({ left, stayed, entryId, now, date }));
    await Promise.all([kept, keepNextCardReady()]);
  }

  /**
   * The place of the card on screen once the `out` cards are dropped: the
   * card dropped from the screen when it is back, else the card on screen,
   * else the next card that stays.
   */
  function placeOnScreen(place: number, out: ReadonlySet<FeedCard>): number {
    if (droppedFromScreen !== undefined && !out.has(droppedFromScreen)) {
      const back = session.indexOf(droppedFromScreen);
      if (back !== -1) return back;
    }
    const card = session[place];
    if (card === undefined || !out.has(card)) return place;
    const next = session.findIndex((later, index) => index > place && !out.has(later));
    return next === -1 ? session.length : next;
  }

  /**
   * Drops every card whose Entry the Cycle no longer covers and puts back the
   * dropped ones it covers again, then keeps the next card ready.
   */
  async function followEligibility(): Promise<void> {
    await inTurn(async () => {
      const out = new Set(
        session.filter((card) => {
          const entryId = entryIdOf(card);
          return entryId !== undefined && !cycle.covers(entryId);
        }),
      );
      const was = onScreen;
      const place = was === undefined ? undefined : placeOnScreen(was.place, out);
      const left = was === undefined ? undefined : session[was.place];
      if (left !== undefined && out.has(left)) droppedFromScreen = left;
      else if (place !== undefined && session[place] === droppedFromScreen)
        droppedFromScreen = undefined;
      const moved = was !== undefined && place !== undefined && place !== was.place;
      const sameDropped = out.size === dropped.size && [...out].every((card) => dropped.has(card));
      if (!moved && sameDropped) return;
      const now = clock.now().getTime();
      if (moved) onScreen = { place, since: now };
      if (moved && place === session.length) {
        // No card after the one dropped from the screen stays: the next card
        // takes the screen in the same change, so the reader's place is kept
        // on it below and the subscribers never find the screen past the cards.
        setSession(session, out);
        let added: FeedCard | undefined;
        try {
          added = await addNextCard();
        } finally {
          if (added === undefined) tellSubscribers();
        }
      } else changeSession(session, out);
      if (moved)
        await keepScreenChange({
          left,
          stayed: now - was.since,
          entryId: entryIdOf(session[place]),
          now,
          date: todayKey(clock),
        });
    });
    await keepNextCardReady();
  }

  if (!(await restore())) await addWordOfTheDay();
  const startPosition = Math.max(cards.length - 1, 0);
  const feed: Feed = {
    get cards() {
      return cards;
    },
    startPosition,
    get position() {
      return onScreen === undefined ? undefined : positionOf(onScreen.place);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    show,
    next,
    openLinkedCorrection: (position, correctionId) =>
      inTurn(() => insertLinkedCorrection(position, correctionId)),
  };
  return { feed, followEligibility };
}
