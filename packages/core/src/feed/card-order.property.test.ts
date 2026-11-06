import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { MixKindWeight } from '@slovo/contracts';

import { nextEntryId, type CardOrder, type OrderedCard } from './card-order';
import { ENTRY_KINDS } from '../entries/entry-kinds';
import type { EntryIds } from '../entries/entries';
import { NORMAL_KIND_WEIGHTS, type MixKindWeights } from '../entries/mix';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261106, numRuns: 100 };

/** The kinds that take turns, by their letter, in the order they win a card both turns fall on. */
const TURNS = [
  { kind: 'C', mix: 'correction', every: ENTRY_KINDS.correction.feedTurn },
  { kind: 'I', mix: 'idiom', every: ENTRY_KINDS.idiom.feedTurn },
  { kind: 'R', mix: 'synonymRow', every: ENTRY_KINDS.synonymRow.feedTurn },
  { kind: 'T', mix: 'tip', every: ENTRY_KINDS.tip.feedTurn },
] as const;

type Kind = 'W' | (typeof TURNS)[number]['kind'];

/** A Cycle's size: how many Entries of each kind, by letter. */
type Sizes = Record<Kind, number>;

const CARD_KIND = {
  W: 'word',
  C: 'correction',
  I: 'idiom',
  R: 'synonymRow',
  T: 'tip',
} as const satisfies Record<Kind, OrderedCard['kind']>;

const letterOf = (id: string): Kind =>
  (({ c: 'C', i: 'I', r: 'R', t: 'T' }) as const)[id[0] ?? ''] ?? 'W';

const ids = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index)}`);

const none: EntryIds = { words: [], corrections: [], idioms: [], synonymRows: [], tips: [] };

/** The Entries of a fresh Cycle of these sizes, all unseen, in the Cycle order. */
const cycleOf = (sizes: Sizes): EntryIds => ({
  words: ids(sizes.W, 'w_'),
  corrections: ids(sizes.C, 'c_'),
  idioms: ids(sizes.I, 'i_'),
  synonymRows: ids(sizes.R, 'r_'),
  tips: ids(sizes.T, 't_'),
});

/** The session's cards so far, all shown and all in the one Cycle. */
function sessionOf(cards: readonly OrderedCard[]): CardOrder['session'] {
  return {
    cards,
    all: cards,
    cycleCards: () => cards,
    shownIds: () => new Set(cards.flatMap((card) => card.entryId ?? [])),
  };
}

/**
 * The Entries of the cards the order gives, one after another, each Seen as
 * it is shown, until it gives none or `count` cards; the `between` cards go
 * in after each card, as a Feed Notice or Quick Question would.
 */
function order(
  input: Omit<CardOrder, 'session' | 'unseen'> & {
    readonly unseen: EntryIds;
    readonly count?: number;
    readonly between?: (card: number) => readonly OrderedCard[];
  },
): string[] {
  const cards: OrderedCard[] = [];
  const shown: string[] = [];
  let unseen = input.unseen;
  for (let card = 1; card <= (input.count ?? Infinity); card += 1) {
    const id = nextEntryId({ ...input, session: sessionOf(cards), unseen });
    if (id === undefined) break;
    shown.push(id);
    cards.push({ kind: CARD_KIND[letterOf(id)], entryId: id }, ...(input.between?.(card) ?? []));
    const seen = (list: readonly string[]) => list.filter((other) => other !== id);
    unseen = {
      words: seen(unseen.words),
      corrections: seen(unseen.corrections),
      idioms: seen(unseen.idioms),
      synonymRows: seen(unseen.synonymRows),
      tips: seen(unseen.tips),
    };
  }
  return shown;
}

/** How a Mix kind weight spaces a kind's turn of `every` cards, as ADR 0051 words it. */
const spaced = (weight: MixKindWeight, every: number) =>
  ({ less: every * 2, normal: every, more: Math.ceil(every / 2) })[weight];

/**
 * The kinds of the Cycle's cards as `CONTEXT.md` (Feed) words the rule:
 * every 5th card is a Correction's turn while the Cycle has unseen
 * Corrections, every 7th an Idiom's, every 9th a Synonym Row's and every
 * 11th a Tip's, each counted from its kind's last card and spaced by the
 * kind's Mix kind weight; when turns fall on one card the order is
 * Correction, Idiom, Synonym Row, Tip, and each loser takes the next card.
 * Any card no turn takes is a Word while Words are left, and any other kind
 * fills in once they are not.
 */
function kindsByTheRule(sizes: Sizes, weights: MixKindWeights): string {
  const left = { ...sizes };
  const lastCard: Partial<Record<Kind, number>> = {};
  const total = Object.values(sizes).reduce((sum, count) => sum + count, 0);
  let kinds = '';
  for (let card = 1; card <= total; card += 1) {
    const turn = TURNS.find(
      ({ kind, mix, every }) =>
        left[kind] > 0 && card - (lastCard[kind] ?? 0) >= spaced(weights[mix], every),
    )?.kind;
    const kind: Kind =
      turn ?? (left.W > 0 ? 'W' : (TURNS.find(({ kind }) => left[kind] > 0)?.kind ?? 'W'));
    left[kind] -= 1;
    lastCard[kind] = card;
    kinds += kind;
  }
  return kinds;
}

const sizes: fc.Arbitrary<Sizes> = fc.record({
  W: fc.integer({ min: 1, max: 60 }),
  C: fc.integer({ min: 0, max: 12 }),
  I: fc.integer({ min: 0, max: 10 }),
  R: fc.integer({ min: 0, max: 8 }),
  T: fc.integer({ min: 0, max: 8 }),
});

const weight = fc.constantFrom<MixKindWeight>('less', 'normal', 'more');
const weights: fc.Arbitrary<MixKindWeights> = fc.record({
  correction: weight,
  idiom: weight,
  synonymRow: weight,
  tip: weight,
});

/** A card that counts in no turn and no Review slot. */
const notice: OrderedCard = { kind: 'notice' };
const quickQuestion: OrderedCard = { kind: 'quick-question' };

describe("the Feed's card order, for every Cycle size", () => {
  it("gives every 5th, 7th, 9th and 11th card to its kind's turn, as the glossary words it", () => {
    fc.assert(
      fc.property(sizes, (cycle) => {
        const shown = order({
          unseen: cycleOf(cycle),
          due: none,
          weights: NORMAL_KIND_WEIGHTS,
          inBand: undefined,
        });
        expect(shown.map(letterOf).join('')).toBe(kindsByTheRule(cycle, NORMAL_KIND_WEIGHTS));
      }),
      runs,
    );
  });

  it("spaces each kind's turn by its Mix kind weight: twice as far for less, twice as close for more", () => {
    fc.assert(
      fc.property(sizes, weights, (cycle, kindWeights) => {
        const shown = order({
          unseen: cycleOf(cycle),
          due: none,
          weights: kindWeights,
          inBand: undefined,
        });
        expect(shown.map(letterOf).join('')).toBe(kindsByTheRule(cycle, kindWeights));
      }),
      runs,
    );
  });

  it('counts no Feed Notice and no Quick Question in the turns', () => {
    fc.assert(
      fc.property(sizes, fc.array(fc.boolean(), { maxLength: 100 }), (cycle, after) => {
        const shown = order({
          unseen: cycleOf(cycle),
          due: none,
          weights: NORMAL_KIND_WEIGHTS,
          inBand: undefined,
          between: (card) => (after[card] === true ? [notice, quickQuestion] : []),
        });
        expect(shown.map(letterOf).join('')).toBe(kindsByTheRule(cycle, NORMAL_KIND_WEIGHTS));
      }),
      runs,
    );
  });

  it('shows every Entry of the Cycle once, then gives none', () => {
    fc.assert(
      fc.property(sizes, weights, (cycle, kindWeights) => {
        const unseen = cycleOf(cycle);
        const shown = order({ unseen, due: none, weights: kindWeights, inBand: undefined });
        expect([...shown].sort()).toEqual(Object.values(unseen).flat().sort());
      }),
      runs,
    );
  });
});

describe("the Feed's card order, for every Review", () => {
  const reviews = fc.record({
    fresh: fc.integer({ min: 1, max: 40 }),
    due: fc.integer({ min: 1, max: 6 }),
    between: fc.array(fc.boolean(), { maxLength: 40 }),
  });

  it('gives every 3rd card to a Word due for Review, the one shown longest ago, never the last card', () => {
    fc.assert(
      fc.property(reviews, ({ fresh, due, between }) => {
        const dueIds = ids(due, 'w_due_');
        const shown = order({
          unseen: { ...none, words: ids(fresh, 'w_new_') },
          due: { ...none, words: dueIds },
          weights: NORMAL_KIND_WEIGHTS,
          inBand: undefined,
          between: (card) => (between[card] === true ? [notice] : []),
        });
        // Each Review slot, every 3rd card, goes to the due Words in turn; the rest to new Words.
        const fresher = ids(fresh, 'w_new_');
        const expected: string[] = [];
        for (let card = 1; ; card += 1) {
          const next = card % 3 === 0 ? dueIds[(card / 3 - 1) % due] : fresher.shift();
          if (next === undefined) break;
          expected.push(next);
        }
        expect(shown).toEqual(expected);
      }),
      runs,
    );
  });

  it("gives a kind's turn to an Entry of the kind due for Review before a new one", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (dueCount) => {
        const corrections = ids(dueCount + 3, 'c_');
        const shown = order({
          unseen: { ...none, words: ids(30, 'w_'), corrections: corrections.slice(dueCount) },
          due: { ...none, corrections: corrections.slice(0, dueCount) },
          weights: NORMAL_KIND_WEIGHTS,
          inBand: undefined,
          count: 12,
        });
        // The Correction's turns, the 5th and 10th cards, go to the due ones first.
        expect([shown[4], shown[9]]).toEqual([corrections[0], corrections[1 % dueCount]]);
      }),
      runs,
    );
  });
});

describe("the Feed's card order, in a Mood's rarity band", () => {
  it('shows the Words of the band first, in the Cycle order, then the rest', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }), (inBand) => {
        const words = ids(inBand.length, 'w_');
        const band = new Set(words.filter((_, index) => inBand[index]));
        const shown = order({
          unseen: { ...none, words },
          due: none,
          weights: NORMAL_KIND_WEIGHTS,
          inBand: (id) => band.has(id),
        });
        expect(shown).toEqual([
          ...words.filter((id) => band.has(id)),
          ...words.filter((id) => !band.has(id)),
        ]);
      }),
      runs,
    );
  });
});
