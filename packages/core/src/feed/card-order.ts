import type { MixKindWeight } from '@slovo/contracts';

import type { EntryIds } from '../entries/entries';
import { ENTRY_KINDS, MIX_KINDS } from '../entries/entry-kinds';
import type { MixKindWeights } from '../entries/mix';
import type { FeedCard } from './feed-card';

/**
 * The kinds that take turns, from the kind table, in the order they take a
 * card their turns fall on together: each with its Entries' list and how
 * often its turn comes (every 5th card a Correction's, every 7th an Idiom's,
 * every 9th a Synonym Row's, every 11th a Tip's), while the Cycle has unseen
 * Entries of it. When a turn falls on an earlier kind's, that kind takes the
 * card and the loser the next (ADR 0046, 0051). These are the turns at
 * «Звичайно»; `SPACING` turns them by the kind's Mix kind weight.
 */
const TURNS = MIX_KINDS.map((kind) => ({
  kind,
  ids: ENTRY_KINDS[kind].name,
  every: ENTRY_KINDS[kind].feedTurn,
}));

/**
 * How a Mix kind weight spaces a kind's turn of `every` cards: «Менше» twice
 * as far apart, «Більше» twice as close, rounded up, so a Correction comes
 * every 10th or every 3rd card; Words fill the rest (ADR 0051).
 */
const SPACING: Readonly<Record<MixKindWeight, (every: number) => number>> = {
  less: (every) => every * 2,
  normal: (every) => every,
  more: (every) => Math.ceil(every / 2),
};

/**
 * One card in this many is a Word's due for Review, while any is due and it
 * isn't another kind's turn. An Entry of another kind due for Review takes
 * its kind's turn itself.
 */
const REVIEW_EVERY = 3;

/** What the card order reads of a card: its kind and its Entry, if any. */
export type OrderedCard = Pick<FeedCard, 'kind' | 'entryId'>;

/**
 * Whether the card is no Feed Notice and no Quick Question, so it counts in
 * the turns and the Review slots (ADR 0054).
 */
export const takesTurns = (card: OrderedCard): boolean =>
  card.kind !== 'notice' && card.kind !== 'quick-question';

/** Everything the next card's Entry follows. */
export interface CardOrder {
  /** The session's cards so far, as the Feed keeps them. */
  readonly session: {
    /** The cards shown, oldest first. */
    readonly cards: readonly OrderedCard[];
    /** Every card of the session, also the dropped ones. */
    readonly all: readonly OrderedCard[];
    /** The cards shown in the current Cycle. */
    readonly cycleCards: readonly OrderedCard[];
    /** The ids of the Entries shown in the current Cycle, also the dropped ones. */
    readonly shownIds: ReadonlySet<string>;
  };
  /** The Cycle's unseen Entries of each kind, in the Cycle order. */
  readonly unseen: EntryIds;
  /** The Entries due for Review that the Cycle covers, in its order. */
  readonly due: EntryIds;
  /** The Mix kind weights in effect, today's Mood applied. */
  readonly weights: MixKindWeights;
  /** Whether a Word is in today's Mood rarity band, or nothing without one (ADR 0076). */
  readonly wordInBand: ((wordId: string) => boolean) | undefined;
}

/**
 * The next card's Entry in the Cycle order, or nothing when the Cycle ends:
 * one not shown in this session yet, else one the reader swiped past too
 * quickly to be Seen. Never the Entry of the last card, which the reader is
 * on while the app gets the next card ready: when it is the only unseen
 * Entry left, the Cycle ends after it. Each kind of `TURNS` takes its turn
 * every `feedTurn`th card of the Cycle, spaced by its Mix kind weight and
 * counted from its kind's last card; when turns fall on one card they take
 * it in the order of `TURNS` and each loser the next (ADR 0046, 0051). Any
 * kind fills in for another when it has none left. Words of the Mood's
 * rarity band go before the rest (ADR 0076). A kind's turn goes to an Entry
 * of the kind due for Review before a new one, and every `REVIEW_EVERY`th
 * card of the session that is no other kind's turn goes to a Word due for
 * Review, if any (ADR 0043).
 */
export function nextEntryId({
  session,
  unseen,
  due,
  weights,
  wordInBand,
}: CardOrder): string | undefined {
  const ordered = wordInBand === undefined ? unseen : bandFirst(unseen, wordInBand);
  const shown = session.shownIds;
  const last = session.cards.findLast(takesTurns)?.entryId;
  const inCycle = session.cycleCards.filter(takesTurns);
  /** Whether the next card is the turn of the kind that comes every `every`th card. */
  function turnOf(kind: FeedCard['kind'], every: number): boolean {
    // The cards since the kind's last card, or all of them before its first.
    const since = inCycle.length - 1 - inCycle.findLastIndex((card) => card.kind === kind);
    return since >= every - 1;
  }
  const turns = TURNS.filter(({ kind, every }) => turnOf(kind, SPACING[weights[kind]](every)));
  // The kinds in the order the next card goes to them: the turns first, then Words.
  const kinds: readonly (keyof EntryIds)[] = [
    ...turns.map(({ ids }) => ids),
    'words',
    ...TURNS.map(({ ids }) => ids),
  ];
  function pick(fits: (id: string) => boolean): string | undefined {
    for (const kind of kinds) {
      const id = ordered[kind].find(fits);
      if (id !== undefined) return id;
    }
    return undefined;
  }
  const id = pick((id) => !shown.has(id)) ?? pick((id) => id !== last);
  for (const { ids } of turns) {
    const dueOfKind = reviewEntryId(due[ids], session.cards);
    if (dueOfKind !== undefined) return dueOfKind;
    if (id !== undefined && ordered[ids].includes(id)) return id;
  }
  // Counting every card of the session, also the dropped ones, so a hide never moves the slots.
  const reviewSlot = (session.all.filter(takesTurns).length + 1) % REVIEW_EVERY === 0;
  return (reviewSlot ? reviewEntryId(due.words, session.cards) : undefined) ?? id;
}

/**
 * The due Entry a Review slot goes to: of the Entries `due`, in the Cycle
 * order, the one not shown in this session or shown longest ago. Never the
 * Entry of the last card. A due Entry so comes back slot after slot until
 * the reader answers it, Seen or not.
 */
function reviewEntryId(due: readonly string[], cards: readonly OrderedCard[]): string | undefined {
  const last = cards.findLast(takesTurns)?.entryId;
  const candidates = due.filter((id) => id !== last);
  // Nothing due is the common case: reading the whole session for it would
  // make every card cost as much as all the cards before it.
  if (candidates.length === 0) return undefined;
  // Each Entry's last place in the session.
  const shownAt = new Map(cards.map((card, place) => [card.entryId, place]));
  return candidates.sort((a, b) => (shownAt.get(a) ?? -1) - (shownAt.get(b) ?? -1))[0];
}

/**
 * The unseen Entries with the Mood's rarity band applied: the Words of the
 * band first, in the Cycle order, then the rest, so the Cycle still ends.
 * The other kinds stay as they are.
 */
function bandFirst(unseen: EntryIds, wordInBand: (wordId: string) => boolean): EntryIds {
  return {
    ...unseen,
    words: [...unseen.words.filter(wordInBand), ...unseen.words.filter((id) => !wordInBand(id))],
  };
}
