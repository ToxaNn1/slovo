import { describe, expect, it } from '@jest/globals';
import { RARITIES, type Rarity } from '@slovo/contracts';

import { renderOverComposition, settled } from '../hook-test/test-support';
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
    const target: Rarity = hook.result.current.ceiling === 3 ? 2 : 3;
    let set: unknown;

    await settled(async () => {
      set = await hook.result.current.apply([
        ...RARITIES
          .filter((rarity) => rarity < target)
          .map((rarity) => ({ rarity, known: true })),
        { rarity: target, known: false },
      ]);
    });

    expect(set).toBe(target);
    expect(hook.result.current.ceiling).toBe(target);
  });
});
