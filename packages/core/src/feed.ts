import type { Correction, Entry, Word } from '@slovo/contracts';
import { z } from 'zod';

import { buildCorrectionCard, type CorrectionCardModel } from './correction-card';
import { openCycle } from './cycle';
import type { Edition } from './edition';
import { localDate, type LocalDate } from './local-date';
import type { Clock, ContentReadPort, Random } from './ports';
import { readRecord, type UserState } from './user-state';
import { buildWordCard, type WordCardModel } from './word-card';
import { openWordOfTheDay } from './word-of-the-day';

/** How long a card must stay on screen before its Entry counts as Seen. */
export const SEEN_DWELL_MS = 1500;

/** One card in this many is a Correction's, while the Cycle has unseen Corrections. */
export const CORRECTION_EVERY = 5;

/** The card of a Word. */
export interface WordFeedCard {
  readonly kind: 'word';
  readonly entry: Word;
  /** What the card shows, built by the Core. */
  readonly wordCard: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of. */
  readonly wordOfTheDay?: LocalDate;
}

/** The card of a Correction. */
export interface CorrectionFeedCard {
  readonly kind: 'correction';
  readonly entry: Correction;
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
function entryIdOf(card: FeedCard | undefined): string | undefined {
  return card === undefined || card.kind === 'end-of-cycle' ? undefined : card.entry.id;
}

/**
 * The Feed of one app session. Its cards are the ones shown so far, oldest
 * first; a card's position is its index there, so going back walks them.
 */
export interface Feed {
  readonly cards: readonly FeedCard[];
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
  /** Reports that the card at `position` is on screen now. */
  cardVisible(position: number): Promise<void>;
  /**
   * Reports that the card at `position` left the screen. Its Entry becomes
   * Seen if the card stayed on screen for at least `SEEN_DWELL_MS` and belongs
   * to the current Cycle.
   */
  cardHidden(position: number): Promise<void>;
}

/** The user-state record of the card the reader was on last. */
const POSITION_KEY = 'feed.position';

/** The card the reader was on last, and the local date they were on it. */
const PositionSchema = z.object({ entryId: z.string(), date: z.string() });

/**
 * Opens the Feed for a new app session. It opens on the card the reader was
 * on when they come back the same local day, and otherwise on the Word of the
 * Day, which also opens a new local day in a Feed left open over midnight.
 *
 * After the Cycle's last unseen Entry comes the end-of-Cycle card, and the
 * card after that starts a new Cycle: nothing Seen, a new shuffle from a new
 * seed. A new local day that finds every Word Seen starts the new Cycle
 * itself, with its Word of the Day and no end-of-Cycle card, because the
 * Word of the Day always opens the day.
 *
 * When the Edition turns the Corrections Feature Switch on, every
 * `CORRECTION_EVERY`th card is a Correction's while the Cycle has unseen
 * Corrections. Corrections are shuffled and Seen like Words, and the Cycle
 * ends only once every live Word and Correction is Seen. The Word of the Day
 * is always a Word.
 */
export async function openFeed({
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
}): Promise<Feed> {
  const withCorrections = edition.isFeatureEnabled('corrections');
  // The Cycle covers the live Words, and the live Corrections when the Edition turns them on.
  const cycle = await openCycle({
    entries: {
      listWordIds: () => content.listWordIds(),
      listCorrectionIds: () =>
        withCorrections ? content.listCorrectionIds() : Promise.resolve([]),
    },
    userState,
    random,
  });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });
  const cards: FeedCard[] = [];
  /** The position of the current Cycle's first card: the cards before it belong to an earlier Cycle. */
  let cycleStart = 0;
  /** When each card on screen now became visible, by position. */
  const visibleSince = new Map<number, number>();

  /** Opens on the card the reader was on, if it was today and its Entry is still live. */
  async function restore(): Promise<boolean> {
    const position = await readRecord(userState, POSITION_KEY, PositionSchema);
    if (position?.date !== localDate(clock)) return false;
    const entry = await entryById(position.entryId);
    if (entry === undefined || entry.retired) return false;
    const card = await entryCard(entry);
    const today = wordOfTheDay.chosen();
    cards.push(
      card.kind === 'word' && today?.wordId === entry.id
        ? { ...card, wordOfTheDay: today.date }
        : card,
    );
    return true;
  }

  /** Any Entry by id: a Word, or a Correction when the Edition turns them on. */
  async function entryById(id: string): Promise<Entry | undefined> {
    const entry = await content.getWord(id);
    if (entry !== undefined || !withCorrections) return entry;
    return content.getCorrection(id);
  }

  /** The card of an Entry. */
  async function entryCard(entry: Entry): Promise<EntryFeedCard> {
    if (entry.kind === 'correction') {
      return { kind: 'correction', entry, correctionCard: buildCorrectionCard(entry) };
    }
    return { kind: 'word', entry, wordCard: await wordCardOf(entry) };
  }

  /** The Word card of a Word, linking no Correction when the Edition turns them off. */
  async function wordCardOf(word: Word): Promise<WordCardModel> {
    const card = await buildWordCard({ word, content });
    return withCorrections ? card : { ...card, linkedCorrections: [] };
  }

  /** The ids of the Entries shown in this session in the current Cycle. */
  function shownIds(): Set<string> {
    return new Set(cards.slice(cycleStart).flatMap((card) => entryIdOf(card) ?? []));
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
    // A new local day starts with its Word of the Day, also in a Feed left open over midnight.
    if (wordOfTheDay.chosen() === undefined) {
      const card = await addWordOfTheDay();
      if (card !== undefined) return card;
    }
    const { words, corrections } = cycle.order();
    if (words.length === 0 && corrections.length === 0) return undefined;
    // The card after the end-of-Cycle card starts a new Cycle.
    if (cards.at(-1)?.kind === 'end-of-cycle') {
      cycleStart = cards.length;
      await userState.write(await cycle.start());
    }
    const id = nextEntryId();
    if (id === undefined) {
      const card: FeedCard = { kind: 'end-of-cycle' };
      cards.push(card);
      return card;
    }
    const entry = await entryById(id);
    if (entry === undefined) return undefined;
    const card = await entryCard(entry);
    cards.push(card);
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
    const correction = await content.getCorrection(correctionId);
    if (correction === undefined) return undefined;
    cards.splice(position + 1, 0, await entryCard(correction));
    // The cards after it move one position on, and so do their dwell times.
    if (cycleStart > position) cycleStart += 1;
    const shifted = [...visibleSince].map(([at, since]): [number, number] => [
      at > position ? at + 1 : at,
      since,
    ]);
    visibleSince.clear();
    for (const [at, since] of shifted) visibleSince.set(at, since);
    return position + 1;
  }

  /** Adds the card of today's Word of the Day, choosing it first if today has none yet. */
  async function addWordOfTheDay(): Promise<FeedCard | undefined> {
    const today = await wordOfTheDay.today({ avoid: shownIds() });
    if (today === undefined) return undefined;
    if (today.startedCycle) cycleStart = cards.length;
    const entry = await content.getWord(today.wordId);
    if (entry === undefined) return undefined;
    const card: FeedCard = {
      kind: 'word',
      entry,
      wordCard: await wordCardOf(entry),
      wordOfTheDay: today.date,
    };
    cards.push(card);
    return card;
  }

  if (!(await restore())) await addWordOfTheDay();
  return {
    cards,
    next: () => inTurn(addNextCard),
    openLinkedCorrection: (position, correctionId) =>
      inTurn(() => insertLinkedCorrection(position, correctionId)),
    async cardVisible(position) {
      const entryId = entryIdOf(cards[position]);
      if (entryId === undefined) return;
      visibleSince.set(position, clock.now().getTime());
      const lastPosition = { entryId, date: localDate(clock) };
      await userState.write(new Map([[POSITION_KEY, JSON.stringify(lastPosition)]]));
    },
    async cardHidden(position) {
      const since = visibleSince.get(position);
      visibleSince.delete(position);
      const entryId = entryIdOf(cards[position]);
      // A card of an earlier Cycle counts for that Cycle only.
      if (since === undefined || entryId === undefined || position < cycleStart) return;
      if (clock.now().getTime() - since < SEEN_DWELL_MS) return;
      const changes = cycle.markSeen(entryId);
      if (changes.size > 0) await userState.write(changes);
    },
  };
}
