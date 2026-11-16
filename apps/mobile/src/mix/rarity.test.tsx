import { describe, expect, it } from '@jest/globals';
import { RARITIES, type Rarity } from '@slovo/contracts';

import { renderOverComposition, settled } from '../hook-test/test-support';
import { useRarityRange } from './rarity-range';
import { useApplyRarityTest } from './rarity-test';

/** The Rarity Range and the Rarity Test hooks over a composition of the test Language Pack. */
const renderRarity = () =>
  renderOverComposition(() => ({ ...useRarityRange(), apply: useApplyRarityTest() }));

describe('the Rarity hooks', () => {
  it('set the Rarity Range and show it', async () => {
    const { hook } = await renderRarity();
    const next = hook.result.current.range.to === 4 ? { from: 2, to: 3 } : { from: 2, to: 4 };

    await settled(() => {
      void hook.result.current.setRange(next);
    });

    expect(hook.result.current.range).toEqual(next);
  });

  it("apply the Rarity Test's answers and resolve to the top of the Rarity Range they set, from 1", async () => {
    const { hook } = await renderRarity();
    const target: Rarity = hook.result.current.range.to === 3 ? 2 : 3;
    let set: unknown;

    await settled(async () => {
      set = await hook.result.current.apply([
        ...RARITIES.filter((rarity) => rarity < target).map((rarity) => ({ rarity, known: true })),
        { rarity: target, known: false },
      ]);
    });

    expect(set).toEqual({ top: target, known: target - 1, total: target });
    expect(hook.result.current.range).toEqual({ from: 1, to: target });
  });
});
