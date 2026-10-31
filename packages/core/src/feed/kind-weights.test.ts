import { describe, expect, it } from 'vitest';

import type { FeatureSwitch } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type Feed,
} from '../index';
import { createMemoryContentPort } from '../testing';
import {
  correction,
  fakeClock,
  idiom,
  seededRandom,
  synonymRow,
  testEdition,
  tip,
  word,
} from '../test-support';

/** Enough Entries of every kind that none runs out over the cards walked. */
const many = <T>(count: number, prefix: string, make: (id: string) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(`${prefix}${String(index)}`));

const content = createMemoryContentPort({
  words: many(80, 'w_', (id) => word(id)),
  corrections: many(30, 'c_', (id) => correction(id)),
  idioms: many(30, 'i_', (id) => idiom(id)),
  synonymRows: many(30, 'r_', (id) => synonymRow(id)),
  tips: many(30, 't_', (id) => tip(id)),
});

/** The Feature Switches on: every kind of Entry, and the Mix kind weights unless `weights` is false. */
const editionWith = (weights: boolean) =>
  testEdition({
    isFeatureEnabled: (feature: FeatureSwitch) =>
      ['corrections', 'idioms', 'synonymRows', 'tips'].includes(feature) ||
      (feature === 'mixKindWeights' && weights),
  });

/** One app run over the records, so the user state survives between runs, with a seeded random source. */
async function runApp(records = new Map<string, string>(), weights = true): Promise<Composition> {
  return openComposition({
    content,
    edition: editionWith(weights),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock('2026-10-31T09:00:00+02:00').clock,
    random: seededRandom(1376),
  });
}

/** The kinds of the first `count` cards: W, C (Correction), I (Idiom), R (Synonym Row) or T (Tip). */
async function kindsOf(feed: Feed, count: number): Promise<string> {
  while (feed.cards.length < count) await feed.next();
  const letter = { word: 'W', correction: 'C', idiom: 'I', synonymRow: 'R', tip: 'T' } as const;
  return feed.cards
    .slice(0, count)
    .map((card) =>
      card.kind === 'notice' || card.kind === 'end-of-cycle' ? '' : letter[card.kind],
    )
    .join('');
}

/** How many of the letters are `kind`. */
const countOf = (kinds: string, kind: string) => kinds.split(kind).length - 1;

describe('the Mix kind weights', () => {
  it('start at «Звичайно» for every kind, so the Feed keeps its turns of 0.9', async () => {
    const app = await runApp();

    expect(app.mix.state.kindWeights).toEqual({
      correction: 'normal',
      idiom: 'normal',
      synonymRow: 'normal',
      tip: 'normal',
    });
    expect(await kindsOf(app.feed, 12)).toBe('WWWWCWIWRCTW');
  });

  it('give a Correction every 3rd card at «Більше» and every 10th at «Менше»', async () => {
    const more = await runApp();
    await more.mix.setKindWeight('correction', 'more');
    await more.mix.setKind('idiom', false);
    await more.mix.setKind('synonymRow', false);
    await more.mix.setKind('tip', false);
    expect(await kindsOf(more.feed, 9)).toBe('WWCWWCWWC');

    const less = await runApp();
    await less.mix.setKindWeight('correction', 'less');
    await less.mix.setKind('idiom', false);
    await less.mix.setKind('synonymRow', false);
    await less.mix.setKind('tip', false);
    expect(await kindsOf(less.feed, 20)).toBe('WWWWWWWWWCWWWWWWWWWC');
  });

  it('shape the proportions of every kind over a seeded Feed, Words filling the rest', async () => {
    const normal = await kindsOf((await runApp()).feed, 120);
    const shaped = await runApp();
    await shaped.mix.setKindWeight('correction', 'less');
    await shaped.mix.setKindWeight('idiom', 'more');
    await shaped.mix.setKindWeight('synonymRow', 'less');
    await shaped.mix.setKindWeight('tip', 'more');
    const kinds = await kindsOf(shaped.feed, 120);

    expect(countOf(kinds, 'C')).toBeLessThan(countOf(normal, 'C'));
    expect(countOf(kinds, 'I')).toBeGreaterThan(countOf(normal, 'I'));
    expect(countOf(kinds, 'R')).toBeLessThan(countOf(normal, 'R'));
    expect(countOf(kinds, 'T')).toBeGreaterThan(countOf(normal, 'T'));
    expect(countOf(kinds, 'W')).toBeGreaterThan(0);
  });

  it('are kept across app runs', async () => {
    const records = new Map<string, string>();
    await (await runApp(records)).mix.setKindWeight('tip', 'more');

    expect((await runApp(records)).mix.state.kindWeights.tip).toBe('more');
  });

  it('leave «Вимкнено» apart: a kind out of the Mix stays out at «Більше»', async () => {
    const app = await runApp();
    await app.mix.setKindWeight('correction', 'more');
    await app.mix.setKind('correction', false);

    expect(countOf(await kindsOf(app.feed, 40), 'C')).toBe(0);
    expect(app.mix.state.kindWeights.correction).toBe('more');
  });

  it('change nothing in the Feed while the Edition turns their Feature Switch off', async () => {
    const records = new Map<string, string>();
    const on = await runApp(records);
    await on.mix.setKindWeight('correction', 'more');
    await on.mix.setKindWeight('idiom', 'less');

    const off = await runApp(records, false);

    expect(await kindsOf(off.feed, 12)).toBe('WWWWCWIWRCTW');
  });
});
