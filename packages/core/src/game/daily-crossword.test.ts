import { describe, expect, it } from 'vitest';

import { openComposition } from '../composition';
import type { FeatureSwitch, Word } from '../index';
import { createMemoryContentPort, testEdition } from '../testing';
import { fakeClock, seededRandom } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { vocabulary } from './crossing-crossword.test-support';

async function app(on: readonly FeatureSwitch[], words: readonly Word[] = vocabulary) {
  return openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
      words,
    }),
    edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: fakeClock('2026-11-04T09:00:00Z').clock,
    random: seededRandom(7),
  });
}

const kindOf = async (on: readonly FeatureSwitch[], words?: readonly Word[]) =>
  (await (await app(on, words)).openDailyCrossword()).kind;

describe('the Daily Crossword the composition opens', () => {
  it('is the crossing one while it is on, the traced one on as well', async () => {
    const composition = await app([
      'game',
      'dailyCrossword',
      'crossingCrossword',
      'tracedCrossword',
    ]);
    const opening = await composition.openDailyCrossword();
    if (opening.kind !== 'crossing')
      throw new Error(`Expected the crossing one, got ${opening.kind}`);
    const ids = vocabulary.map(({ id }) => id);
    for (const { word: placed } of opening.crossword.puzzle.words) expect(ids).toContain(placed.id);
  });

  it('is none on a day no pattern fills, never the traced one', async () => {
    expect(
      await kindOf(['game', 'dailyCrossword', 'crossingCrossword', 'tracedCrossword'], []),
    ).toBe('none');
  });

  it('is the traced one while the crossing one is off', async () => {
    const composition = await app(['game', 'dailyCrossword', 'tracedCrossword']);
    const opening = await composition.openDailyCrossword();
    if (opening.kind !== 'traced') throw new Error(`Expected the traced one, got ${opening.kind}`);
    expect(opening.crossword.puzzle.words.length).toBeGreaterThan(0);
  });

  it('is none while the traced one cannot fill its grid and the crossing one is off', async () => {
    expect(await kindOf(['game', 'dailyCrossword', 'tracedCrossword'], [])).toBe('none');
  });

  it('is none with both crosswords off', async () => {
    expect(await kindOf(['game', 'dailyCrossword'])).toBe('none');
  });

  it('is none while the Daily Crossword is off', async () => {
    expect(await kindOf(['game', 'crossingCrossword', 'tracedCrossword'])).toBe('none');
  });
});
