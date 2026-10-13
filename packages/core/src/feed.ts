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
 * first; a card's position is its index there, so going back walks them.
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
}): Promise<Feed> {
  let cards: readonly FeedCard[] = [];
  const listeners = new Set<() => void>();
  /** The position of the current Cycle's first card: the cards before it belong to an earlier Cycle. */
  let cycleStart = 0;
  /** The card on screen now, and since when, if one is. */
  let onScreen: { readonly position: number; readonly since: number } | undefined;

  function changeCards(changed: readonly FeedCard[]): void {
    cards = changed;
    for (const listener of listeners) listener();
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
    if (opening?.wordCard.wordId === entry.id) changeCards([opening]);
    else
      changeCards([
        ...(opening === undefined ? [] : [opening]),
        await buildEntryCard(entries, entry),
      ]);
    return true;
  }

  /** The ids of the Entries shown in this session in the current Cycle. */
  function shownIds(shown = cards): Set<string> {
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
    const sinceCorrection = cards
      .slice(cycleStart)
      .reverse()
      .findIndex((card) => card.kind === 'correction');
    const cardsSinceCorrection =
      sinceCorrection === -1 ? cards.length - cycleStart : sinceCorrection;
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
    const atEnd = cards.at(-1)?.kind === 'end-of-cycle';
    const { words: unseenWords, corrections: unseenCorrections } = cycle.unseen();
    // The end-of-Cycle card came too early when the reader left the last unseen
    // Entry before it was Seen: the next card takes its place.
    const kept =
      atEnd && unseenWords.length + unseenCorrections.length > 0 ? cards.slice(0, -1) : cards;
    // A new local day starts with its Word of the Day, also in a Feed left open over midnight.
    if (wordOfTheDay.chosen() === undefined) {
      const card = await addWordOfTheDay(kept);
      if (card !== undefined) return card;
    }
    if (cycle.isEmpty()) return undefined;
    // The card after the end-of-Cycle card starts a new Cycle.
    if (atEnd && kept === cards) {
      const started = await cycle.start();
      await userState.write(started.changes);
      started.commit();
      cycleStart = cards.length;
    }
    const id = nextEntryId();
    if (id === undefined) {
      const card: FeedCard = { kind: 'end-of-cycle' };
      changeCards([...kept, card]);
      return card;
    }
    const entry = await entries.get(id);
    if (entry === undefined) return undefined;
    const card = await buildEntryCard(entries, entry);
    changeCards([...kept, card]);
    return card;
  }

  async function insertLinkedCorrection(
    position: number,
    correctionId: string,
  ): Promise<number | undefined> {
    const card = cards[position];
    const linked = card?.kind === 'word' ? card.wordCard.linkedCorrections : [];
    if (!linked.some((link) => link.correctionId === correctionId)) return undefined;
    // Tapped again: the Correction's card is already there.
    if (entryIdOf(cards[position + 1]) === correctionId) return position + 1;
    const correction = await entries.get(correctionId);
    if (correction?.kind !== 'correction') return undefined;
    const opened = await buildEntryCard(entries, correction);
    // The cards after it move one position on, the one on screen too.
    if (cycleStart > position) cycleStart += 1;
    if (onScreen !== undefined && onScreen.position > position)
      onScreen = { ...onScreen, position: onScreen.position + 1 };
    changeCards([...cards.slice(0, position + 1), opened, ...cards.slice(position + 1)]);
    return position + 1;
  }

  /** The card of a day's Word of the Day. */
  async function wordOfTheDayCard(choice: WordOfTheDayChoice): Promise<WordFeedCard | undefined> {
    const entry = await entries.get(choice.wordId);
    return entry?.kind === 'word' ? buildEntryCard(entries, entry, choice.date) : undefined;
  }

  /**
   * Adds the card of today's Word of the Day after the `kept` cards, choosing
   * it first if today has none yet.
   */
  async function addWordOfTheDay(kept = cards): Promise<FeedCard | undefined> {
    const today = await wordOfTheDay.today({ avoid: shownIds(kept) });
    if (today === undefined) return undefined;
    if (today.startedCycle) cycleStart = kept.length;
    const card = await wordOfTheDayCard(today);
    if (card === undefined) return undefined;
    changeCards([...kept, card]);
    return card;
  }

  const next = () => inTurn(addNextCard);

  /** Whether the card on screen is the last one, so the card after it is not ready yet. */
  const nextCardMissing = () => onScreen !== undefined && onScreen.position >= cards.length - 1;

  /**
   * Whether the ready card, the last one, which the reader hasn't reached, was
   * got ready on an earlier local day: today has no Word of the Day yet.
   */
  const readyCardStale = () =>
    onScreen !== undefined &&
    onScreen.position < cards.length - 1 &&
    wordOfTheDay.chosen() === undefined;

  /** Puts today's Word of the Day in place of a ready card got ready on an earlier local day. */
  async function replaceStaleReadyCard(): Promise<void> {
    if (readyCardStale()) await addWordOfTheDay(cards.slice(0, -1));
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
    if (left === undefined || entryId === undefined || cards.indexOf(left) < cycleStart)
      return undefined;
    return stayed < SEEN_DWELL_MS ? undefined : entryId;
  }

  async function show(position: number | undefined): Promise<void> {
    if (position === onScreen?.position) return keepNextCardReady();
    const now = clock.now().getTime();
    const left = onScreen === undefined ? undefined : cards[onScreen.position];
    const stayed = onScreen === undefined ? 0 : now - onScreen.since;
    onScreen = position === undefined ? undefined : { position, since: now };
    const entryId = position === undefined ? undefined : entryIdOf(cards[position]);
    const date = todayKey(clock);
    // In turn with the requests that change the cards, so a new Cycle never
    // starts between the card leaving the screen and its Entry becoming Seen.
    const kept = inTurn(async () => {
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
    });
    await Promise.all([kept, keepNextCardReady()]);
  }

  if (!(await restore())) await addWordOfTheDay();
  const startPosition = Math.max(cards.length - 1, 0);
  return {
    get cards() {
      return cards;
    },
    startPosition,
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
}
