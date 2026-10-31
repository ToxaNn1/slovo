import fc from 'fast-check';
import { describe, it } from 'vitest';

import { createMemoryUserStatePort, openComposition, openUserState, type Feed } from '../index';
import { ENTRY_KINDS } from '../entries/entry-kinds';
import { createMemoryContentPort } from '../testing';
import {
  correction,
  fakeClock,
  idiom,
  randomOf,
  synonymRow,
  testEdition,
  tip,
  word,
} from '../test-support';

/** The Feed turns of the kinds, from the kind table: every how many cards each takes one. */
const CORRECTION_EVERY = ENTRY_KINDS.correction.feedTurn;
const IDIOM_EVERY = ENTRY_KINDS.idiom.feedTurn;
const SYNONYM_ROW_EVERY = ENTRY_KINDS.synonymRow.feedTurn;
const TIP_EVERY = ENTRY_KINDS.tip.feedTurn;

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261027, numRuns: 100 };

/** An Edition with every kind of Entry on, whose one Category, the test Words' own, is in its default Mix. */
const edition = testEdition({
  isFeatureEnabled: (feature) => ['corrections', 'idioms', 'synonymRows', 'tips'].includes(feature),
});

/** The kinds that take turns, by their letter, in the order they win a card both turns fall on. */
const TURNS = [
  { kind: 'C', every: CORRECTION_EVERY },
  { kind: 'I', every: IDIOM_EVERY },
  { kind: 'R', every: SYNONYM_ROW_EVERY },
  { kind: 'T', every: TIP_EVERY },
] as const;

type Kind = 'W' | (typeof TURNS)[number]['kind'];

/** A Cycle's size: how many Entries of each kind, by letter. */
type Sizes = Record<Kind, number>;

const many = <Entry>(count: number, prefix: string, make: (id: string) => Entry) =>
  Array.from({ length: count }, (_, index) => make(`${prefix}${String(index)}`));

/** The Feed of a fresh app run over a Cycle of these sizes. */
async function feedOf(sizes: Sizes): Promise<Feed> {
  const content = createMemoryContentPort({
    words: many(sizes.W, 'w_', (id) => word(id)),
    corrections: many(sizes.C, 'c_', (id) => correction(id)),
    idioms: many(sizes.I, 'i_', (id) => idiom(id)),
    synonymRows: many(sizes.R, 'r_', (id) => synonymRow(id)),
    tips: many(sizes.T, 't_', (id) => tip(id)),
  });
  const composition = await openComposition({
    content,
    edition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: fakeClock().clock,
    random: randomOf(0.25),
  });
  return composition.feed;
}

/** The kinds of the Cycle's cards, a letter each, from the first card to the end of the Cycle. */
async function kindsOfCycle(feed: Feed): Promise<string> {
  const ids = feed.cards.flatMap((card) => card.entryId ?? []);
  for (;;) {
    const id = (await feed.next())?.entryId;
    if (id === undefined || ids.includes(id)) break;
    ids.push(id);
  }
  return ids.map((id) => ({ c: 'C', i: 'I', r: 'R', t: 'T' })[id[0] ?? ''] ?? 'W').join('');
}

/**
 * The kinds of the Cycle's cards as `CONTEXT.md` (Feed) words the rule:
 * every 5th card is a Correction's turn while the Cycle has unseen
 * Corrections, every 7th an Idiom's, every 9th a Synonym Row's and every
 * 11th a Tip's, each counted from its kind's last card; when turns fall on
 * one card the order is Correction, Idiom, Synonym Row, Tip, and each loser
 * takes the next card. Any card no turn takes is a Word while Words are
 * left, and any other kind fills in once they are not.
 */
function kindsByTheRule(sizes: Sizes): string {
  const left = { ...sizes };
  const lastCard: Partial<Record<Kind, number>> = {};
  const total = Object.values(sizes).reduce((sum, count) => sum + count, 0);
  let kinds = '';
  for (let card = 1; card <= total; card += 1) {
    const turn = TURNS.find(
      ({ kind, every }) => left[kind] > 0 && card - (lastCard[kind] ?? 0) >= every,
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

describe('the Feed, for every Cycle size', () => {
  it("gives every 5th, 7th, 9th and 11th card to its kind's turn, as the glossary words it", async () => {
    await fc.assert(
      fc.asyncProperty(sizes, async (cycle) => {
        return (await kindsOfCycle(await feedOf(cycle))) === kindsByTheRule(cycle);
      }),
      runs,
    );
  });
});
