import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test-support';
import { useRarityCeiling } from './rarity-ceiling';
import { useApplyRarityTest } from './rarity-test';

/** The Rarity Ceiling and the Rarity Test hooks over a composition of the test Language Pack. */
const renderRarity = () =>
  renderOverComposition(() => ({ ...useRarityCeiling(), apply: useApplyRarityTest() }));

describe('the Rarity hooks', () => {
  it('set the Rarity Ceiling and show it', async () => {
    const { hook } = await renderRarity();
    const before = hook.result.current.ceiling;
    const next = before === 2 ? 4 : 2;

    await settled(() => {
      hook.result.current.setCeiling(next);
    });

    expect(hook.result.current.ceiling).toBe(next);
  });

  it("apply the Rarity Test's answers and resolve to the Rarity Ceiling they set", async () => {
    const { hook } = await renderRarity();
    let set: unknown;

    await settled(async () => {
      set = await hook.result.current.apply([
        { rarity: 1, known: true },
        { rarity: 2, known: true },
        { rarity: 3, known: false },
      ]);
    });

    expect(set).toBe(hook.result.current.ceiling);
    expect(set).not.toBeUndefined();
  });
});
