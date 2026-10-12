import type { Entry } from '@slovo/contracts';
import { z } from 'zod';

import { localDate, parseLocalDate, type LocalDate } from './local-date';
import type { Clock, ContentReadPort, Random } from './ports';
import type { UserState } from './user-state';

/** How long a card must stay on screen before its Entry counts as Seen. */
export const SEEN_DWELL_MS = 1500;

/**
 * One card of the Feed. Every card shows an Entry for now; other kinds of
 * card join this union.
 */
export interface FeedCard {
  readonly kind: 'entry';
  readonly entry: Entry;
  /** On the card of the Word of the Day: the local day it is the Word of. */
  readonly wordOfTheDay?: LocalDate;
}

/**
 * The Feed of one app session. Its cards are the ones shown so far, oldest
 * first; a card's position is its index there, so going back walks them.
 */
export interface Feed {
  readonly cards: readonly FeedCard[];
  /**
   * Adds the next card to the session and returns it, or nothing when the
   * Cycle has no unseen Entry left.
   */
  next(): Promise<FeedCard | undefined>;
  /** Reports that the card at `position` is on screen now. */
  cardVisible(position: number): Promise<void>;
  /**
   * Reports that the card at `position` left the screen. Its Entry becomes
   * Seen if the card stayed on screen for at least `SEEN_DWELL_MS`.
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
  /** When each card on screen now became visible, by position. */
  const visibleSince = new Map<number, number>();

  /** Opens on the card the reader was on, if it was today and its Entry is still live. */
  async function restore(): Promise<boolean> {
    const position = await readRecord(userState, KEYS.position, PositionSchema);
    if (position?.date !== localDate(clock)) return false;
    const entry = await content.getWord(position.entryId);
    if (entry === undefined || entry.retired) return false;
    cards.push(cardOf(entry));
    return true;
  }

  /** The card of an Entry, marked if it is the Word of the Day. */
  function cardOf(entry: Entry): FeedCard {
    return wordOfTheDay?.entryId === entry.id && wordOfTheDay.date === localDate(clock)
      ? { kind: 'entry', entry, wordOfTheDay: parseLocalDate(wordOfTheDay.date) }
      : { kind: 'entry', entry };
  }

  /**
   * The next Entry in the Cycle order: one not shown in this session yet, else
   * one the reader swiped past too quickly to be Seen.
   */
  function nextEntryId(): string | undefined {
    const unseen = order.filter((id) => !seen.has(id));
    const shown = new Set(cards.map((card) => card.entry.id));
    const last = cards.at(-1)?.entry.id;
    return unseen.find((id) => !shown.has(id)) ?? unseen.find((id) => id !== last) ?? unseen[0];
  }

  /**
   * The next unseen Word in the Cycle order for a new Word of the Day: one
   * other than the day before's, so every day starts with a new Word, and one
   * not shown in this session yet, where the Cycle has such Words left.
   */
  function nextWordOfTheDayId(dayBefore: string | undefined): string | undefined {
    const unseen = order.filter((id) => !seen.has(id));
    const fresh = unseen.filter((id) => id !== dayBefore);
    const shown = new Set(cards.map((card) => card.entry.id));
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
    const id = nextEntryId();
    if (id === undefined) return undefined;
    const entry = await content.getWord(id);
    if (entry === undefined) return undefined;
    const card: FeedCard = { kind: 'entry', entry };
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
      const changes = new Map<string, string | undefined>();
      let id = nextWordOfTheDayId(dayBefore);
      if (id === undefined && order.length > 0) {
        // Every Word is Seen, so the day starts a new Cycle.
        cycle = { id: cycle.id + 1, seed: drawSeed(random) };
        order = shuffle(await content.listWordIds(), cycle.seed);
        seen.clear();
        changes.set(KEYS.cycle, JSON.stringify(cycle)).set(KEYS.seen, undefined);
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
      if (card === undefined) return;
      visibleSince.set(position, clock.now().getTime());
      const lastPosition = { entryId: card.entry.id, date: localDate(clock) };
      await userState.write(new Map([[KEYS.position, JSON.stringify(lastPosition)]]));
    },
    async cardHidden(position) {
      const since = visibleSince.get(position);
      visibleSince.delete(position);
      const card = cards[position];
      if (since === undefined || card === undefined) return;
      if (clock.now().getTime() - since >= SEEN_DWELL_MS) await markSeen(card.entry.id);
    },
  };
}
