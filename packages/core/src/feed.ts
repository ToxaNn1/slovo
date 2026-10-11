import type { Entry } from '@slovo/contracts';
import { z } from 'zod';

import { localDate } from './local-date';
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
const KEYS = { cycle: 'feed.cycle', seen: 'feed.seen', position: 'feed.position' } as const;

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

/** Reads the current Cycle, or starts the first one with a seed from the random port. */
async function currentCycle(userState: UserState, random: Random): Promise<Cycle> {
  const stored = await readRecord(userState, KEYS.cycle, CycleSchema);
  if (stored !== undefined) return stored;
  const cycle = { id: 1, seed: Math.floor(random.next() * 2 ** 32) };
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
 * on when they come back the same local day, and otherwise on the next unseen
 * card of the Cycle.
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
  const cycle = await currentCycle(userState, random);
  const order = shuffle(await content.listWordIds(), cycle.seed);
  const seen = new Set(await readRecord(userState, KEYS.seen, SeenSchema));
  const cards: FeedCard[] = [];
  /** When each card on screen now became visible, by position. */
  const visibleSince = new Map<number, number>();

  /** Opens on the card the reader was on, if it was today and its Entry is still live. */
  async function restore(): Promise<boolean> {
    const position = await readRecord(userState, KEYS.position, PositionSchema);
    if (position?.date !== localDate(clock)) return false;
    const entry = await content.getWord(position.entryId);
    if (entry === undefined || entry.retired) return false;
    cards.push({ kind: 'entry', entry });
    return true;
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

  // One request at a time, so two requests never pick the same Entry.
  let lastRequest: Promise<unknown> = Promise.resolve();
  function next(): Promise<FeedCard | undefined> {
    const request = lastRequest.then(addNextCard);
    lastRequest = request.catch(() => undefined);
    return request;
  }

  async function addNextCard(): Promise<FeedCard | undefined> {
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

  if (!(await restore())) await next();
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
