import type { Entry, Word } from '@slovo/contracts';
import { z } from 'zod';

import { localDate, parseLocalDate, type LocalDate } from './local-date';
import type { Clock, ContentReadPort, Random } from './ports';
import type { UserState } from './user-state';
import { buildWordCard, type WordCardModel } from './word-card';

/** How long a card must stay on screen before its Entry counts as Seen. */
export const SEEN_DWELL_MS = 1500;

/**
 * One card of the Feed: an Entry, or the end-of-Cycle card that tells the
 * reader every live Entry is Seen and the next card starts a new Cycle.
 */
export type FeedCard =
  | {
      readonly kind: 'entry';
      readonly entry: Entry;
      /** What the card shows, built by the Core. The Feed offers Words only for now. */
      readonly wordCard: WordCardModel;
      /** On the card of the Word of the Day: the local day it is the Word of. */
      readonly wordOfTheDay?: LocalDate;
    }
  | { readonly kind: 'end-of-cycle' };

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
 */
export async function openFeed({
  content,
  userState,
  clock,
  random,
}: {
  content: ContentReadPort;
  userState: UserState;
  clock: Clock;
  random: Random;
}): Promise<Feed> {
  let cycle = await currentCycle(userState, random);
  let order = shuffle(await content.listWordIds(), cycle.seed);
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
    const entry = await content.getWord(position.entryId);
    if (entry === undefined || entry.retired) return false;
    cards.push(await cardOf(entry));
    return true;
  }

  /** The card of an Entry, marked if it is the Word of the Day. */
  async function cardOf(entry: Word): Promise<FeedCard> {
    const wordCard = await buildWordCard({ word: entry, content });
    return wordOfTheDay?.entryId === entry.id && wordOfTheDay.date === localDate(clock)
      ? { kind: 'entry', entry, wordCard, wordOfTheDay: parseLocalDate(wordOfTheDay.date) }
      : { kind: 'entry', entry, wordCard };
  }

  /** The ids of the Entries shown in this session in the current Cycle. */
  function shownIds(): Set<string> {
    return new Set(
      cards.slice(cycleStart).flatMap((card) => (card.kind === 'entry' ? [card.entry.id] : [])),
    );
  }

  /**
   * Starts a new Cycle, in which nothing is Seen, with a new shuffle from a
   * new seed. Returns the changes that keep it in the user state.
   */
  async function startCycle(): Promise<Map<string, string | undefined>> {
    cycle = { id: cycle.id + 1, seed: drawSeed(random) };
    order = shuffle(await content.listWordIds(), cycle.seed);
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
   * when it is the only unseen Entry left, the Cycle ends after it.
   */
  function nextEntryId(): string | undefined {
    const unseen = order.filter((id) => !seen.has(id));
    const shown = shownIds();
    const lastCard = cards.at(-1);
    const last = lastCard?.kind === 'entry' ? lastCard.entry.id : undefined;
    return unseen.find((id) => !shown.has(id)) ?? unseen.find((id) => id !== last);
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
  function next(): Promise<FeedCard | undefined> {
    const request = lastRequest.then(addNextCard);
    lastRequest = request.catch(() => undefined);
    return request;
  }

  async function addNextCard(): Promise<FeedCard | undefined> {
    // A new local day starts with its Word of the Day, also in a Feed left open over midnight.
    if (wordOfTheDay?.date !== localDate(clock)) {
      const card = await addWordOfTheDay();
      if (card !== undefined) return card;
    }
    if (order.length === 0) return undefined;
    // The card after the end-of-Cycle card starts a new Cycle.
    if (cards.at(-1)?.kind === 'end-of-cycle') await userState.write(await startCycle());
    const id = nextEntryId();
    if (id === undefined) {
      const card: FeedCard = { kind: 'end-of-cycle' };
      cards.push(card);
      return card;
    }
    const entry = await content.getWord(id);
    if (entry === undefined) return undefined;
    const card: FeedCard = {
      kind: 'entry',
      entry,
      wordCard: await buildWordCard({ word: entry, content }),
    };
    cards.push(card);
    return card;
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
      kind: 'entry',
      entry,
      wordCard: await buildWordCard({ word: entry, content }),
      wordOfTheDay: parseLocalDate(wordOfTheDay.date),
    };
    cards.push(card);
    return card;
  }

  if (!(await restore())) await addWordOfTheDay();
  return {
    cards,
    next,
    async cardVisible(position) {
      const card = cards[position];
      if (card?.kind !== 'entry') return;
      visibleSince.set(position, clock.now().getTime());
      const lastPosition = { entryId: card.entry.id, date: localDate(clock) };
      await userState.write(new Map([[KEYS.position, JSON.stringify(lastPosition)]]));
    },
    async cardHidden(position) {
      const since = visibleSince.get(position);
      visibleSince.delete(position);
      const card = cards[position];
      // A card of an earlier Cycle counts for that Cycle only.
      if (since === undefined || card?.kind !== 'entry' || position < cycleStart) return;
      if (clock.now().getTime() - since >= SEEN_DWELL_MS) await markSeen(card.entry.id);
    },
  };
}
