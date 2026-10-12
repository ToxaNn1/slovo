import type { Correction, Entry, Word } from '@slovo/contracts';
import { z } from 'zod';

import { buildCorrectionCard, type CorrectionCardModel } from './correction-card';
import type { Edition } from './edition';
import { localDate, parseLocalDate, type LocalDate } from './local-date';
import type { Clock, ContentReadPort, Random } from './ports';
import type { UserState } from './user-state';
import { buildWordCard, type WordCardModel } from './word-card';

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

/** The user-state records of the Feed. */
const KEYS = {
  cycle: 'feed.cycle',
  seen: 'feed.seen',
  position: 'feed.position',
  wordOfTheDay: 'feed.wordOfTheDay',
} as const;

/** The current Cycle: its number and the seed of its shuffle. */
const CycleSchema = z.object({
  id: z.number().int().positive(),
  seed: z.number().int().nonnegative(),
});

type Cycle = z.infer<typeof CycleSchema>;

/** The ids of the Entries Seen in the current Cycle. */
const SeenSchema = z.array(z.string());

/** The card the reader was on last, and the local date they were on it. */
const PositionSchema = z.object({ entryId: z.string(), date: z.string() });

/** The Word of the Day and the local date it belongs to. */
const WordOfTheDaySchema = z.object({ entryId: z.string(), date: z.string() });

/** A record of the user state, if it holds a value of the schema. */
async function readRecord<T>(
  userState: UserState,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  const record = await userState.get(key);
  if (record === undefined) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(record));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** A seed for the shuffle of a new Cycle. */
function drawSeed(random: Random): number {
  return Math.floor(random.next() * 2 ** 32);
}

/** Reads the current Cycle, or starts the first one with a seed from the random port. */
async function currentCycle(userState: UserState, random: Random): Promise<Cycle> {
  const stored = await readRecord(userState, KEYS.cycle, CycleSchema);
  if (stored !== undefined) return stored;
  const cycle = { id: 1, seed: drawSeed(random) };
  await userState.write(new Map([[KEYS.cycle, JSON.stringify(cycle)]]));
  return cycle;
}

/**
 * The ids in an order that depends only on the seed (drawn one by one with
 * the mulberry32 generator), so a Cycle keeps its order across restarts.
 */
function shuffle(ids: readonly string[], seed: number): string[] {
  let state = seed >>> 0;
  function nextNumber(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  }
  const pool = [...ids];
  const order: string[] = [];
  while (pool.length > 0) order.push(...pool.splice(Math.floor(nextNumber() * pool.length), 1));
  return order;
}

/**
 * Opens the Feed for a new app session. It opens on the card the reader was
 * on when they come back the same local day, and otherwise on the Word of the
 * Day: one Word unseen in the Cycle, chosen once per local day in the clock's
 * time zone and kept in the user state with its date.
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
  /** The live Corrections in the Cycle order, or none when the Edition turns them off. */
  async function correctionOrderOf(seed: number): Promise<string[]> {
    return withCorrections ? shuffle(await content.listCorrectionIds(), seed) : [];
  }

  let cycle = await currentCycle(userState, random);
  let order = shuffle(await content.listWordIds(), cycle.seed);
  let correctionOrder = await correctionOrderOf(cycle.seed);
  const seen = new Set(await readRecord(userState, KEYS.seen, SeenSchema));
  let wordOfTheDay = await readRecord(userState, KEYS.wordOfTheDay, WordOfTheDaySchema);
  const cards: FeedCard[] = [];
  /** The position of the current Cycle's first card: the cards before it belong to an earlier Cycle. */
  let cycleStart = 0;
  /** When each card on screen now became visible, by position. */
  const visibleSince = new Map<number, number>();

  /** Opens on the card the reader was on, if it was today and its Entry is still live. */
  async function restore(): Promise<boolean> {
    const position = await readRecord(userState, KEYS.position, PositionSchema);
    if (position?.date !== localDate(clock)) return false;
    const entry = await entryById(position.entryId);
    if (entry === undefined || entry.retired) return false;
    const card = await entryCard(entry);
    cards.push(
      card.kind === 'word' &&
        wordOfTheDay?.entryId === entry.id &&
        wordOfTheDay.date === localDate(clock)
        ? { ...card, wordOfTheDay: parseLocalDate(wordOfTheDay.date) }
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
   * Starts a new Cycle, in which nothing is Seen, with a new shuffle from a
   * new seed. Returns the changes that keep it in the user state.
   */
  async function startCycle(): Promise<Map<string, string | undefined>> {
    cycle = { id: cycle.id + 1, seed: drawSeed(random) };
    order = shuffle(await content.listWordIds(), cycle.seed);
    correctionOrder = await correctionOrderOf(cycle.seed);
    seen.clear();
    cycleStart = cards.length;
    return new Map([
      [KEYS.cycle, JSON.stringify(cycle)],
      [KEYS.seen, undefined],
    ]);
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
    const unseenWords = order.filter((id) => !seen.has(id));
    const unseenCorrections = correctionOrder.filter((id) => !seen.has(id));
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

  /**
   * The next unseen Word in the Cycle order for a new Word of the Day: one
   * other than the day before's, so every day starts with a new Word, and one
   * not shown in this session yet, where the Cycle has such Words left.
   */
  function nextWordOfTheDayId(dayBefore: string | undefined): string | undefined {
    const unseen = order.filter((id) => !seen.has(id));
    const fresh = unseen.filter((id) => id !== dayBefore);
    const shown = shownIds();
    return fresh.find((id) => !shown.has(id)) ?? fresh[0] ?? unseen[0];
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
    if (wordOfTheDay?.date !== localDate(clock)) {
      const card = await addWordOfTheDay();
      if (card !== undefined) return card;
    }
    if (order.length === 0 && correctionOrder.length === 0) return undefined;
    // The card after the end-of-Cycle card starts a new Cycle.
    if (cards.at(-1)?.kind === 'end-of-cycle') await userState.write(await startCycle());
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

  async function markSeen(entryId: string): Promise<void> {
    if (seen.has(entryId)) return;
    seen.add(entryId);
    await userState.write(new Map([[KEYS.seen, JSON.stringify([...seen])]]));
  }

  /** Adds the card of today's Word of the Day, choosing it first if today has none yet. */
  async function addWordOfTheDay(): Promise<FeedCard | undefined> {
    const today = localDate(clock);
    // A Word of the Day retired since is chosen again, so no Retired Word shows.
    if (wordOfTheDay?.date !== today || !order.includes(wordOfTheDay.entryId)) {
      const dayBefore = wordOfTheDay?.entryId;
      let changes = new Map<string, string | undefined>();
      let id = nextWordOfTheDayId(dayBefore);
      if (id === undefined && order.length > 0) {
        // Every Word is Seen, so the day starts a new Cycle.
        changes = await startCycle();
        id = nextWordOfTheDayId(dayBefore);
      }
      if (id === undefined) return undefined;
      wordOfTheDay = { entryId: id, date: today };
      changes.set(KEYS.wordOfTheDay, JSON.stringify(wordOfTheDay));
      await userState.write(changes);
    }
    const entry = await content.getWord(wordOfTheDay.entryId);
    if (entry === undefined) return undefined;
    const card: FeedCard = {
      kind: 'word',
      entry,
      wordCard: await wordCardOf(entry),
      wordOfTheDay: parseLocalDate(wordOfTheDay.date),
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
      await userState.write(new Map([[KEYS.position, JSON.stringify(lastPosition)]]));
    },
    async cardHidden(position) {
      const since = visibleSince.get(position);
      visibleSince.delete(position);
      const entryId = entryIdOf(cards[position]);
      // A card of an earlier Cycle counts for that Cycle only.
      if (since === undefined || entryId === undefined || position < cycleStart) return;
      if (clock.now().getTime() - since >= SEEN_DWELL_MS) await markSeen(entryId);
    },
  };
}
