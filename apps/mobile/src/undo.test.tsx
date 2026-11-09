import { describe, expect, it } from '@jest/globals';

import { crafts, renderOverComposition, settled, wordIds } from './hook-test/test-support';
import { useUndo } from './undo';

describe('the undo of a toast', () => {
  it('takes a hide back in the composition open at the tap, after a reopen', async () => {
    const { composition, hook, reopen } = await renderOverComposition(useUndo);
    const entry = await composition.hide({ kind: 'entry', entryId: wordIds[1] });
    const category = await composition.hide({ kind: 'category', categoryId: crafts.id });
    if (entry === undefined || category === undefined) throw new Error('Nothing was hidden');
    const after = await reopen();
    // The reopened composition kept both hides, so the undo has something to take back.
    expect(after.hiddenEntries.list).toHaveLength(1);
    expect(after.mix.state.hiddenCategories).toHaveLength(1);

    await settled(() => {
      hook.result.current('the undo of the hide', entry.undo);
      hook.result.current('the undo of the hide', category.undo);
    });

    expect(after.hiddenEntries.list).toEqual([]);
    expect(after.mix.state.hiddenCategories).toEqual([]);
  });

  it('takes a restore back in the composition open at the tap: the Entry is hidden again at its old place', async () => {
    const { composition, hook, reopen } = await renderOverComposition(useUndo);
    for (const entryId of wordIds) await composition.hide({ kind: 'entry', entryId });
    const hiddenList = composition.hiddenEntries.list;
    const restored = await composition.unhide({ kind: 'entry', entryId: wordIds[1] });
    const undo = restored?.undo;
    if (undo === undefined) throw new Error('Nothing was restored');
    const after = await reopen();
    // The reopened composition kept the restore, so the undo has something to take back.
    expect(after.hiddenEntries.list).toHaveLength(wordIds.length - 1);

    await settled(() => {
      hook.result.current('the undo of bringing the Entry back', undo);
    });

    expect(after.hiddenEntries.list).toEqual(hiddenList);
  });

  it('takes a Knowledge Mark back in the composition open at the tap', async () => {
    const { hook, reopen } = await renderOverComposition(useUndo);
    const after = await reopen();
    await after.knowledge.set(wordIds[0], 'known');

    await settled(() => {
      hook.result.current('the Knowledge Mark', (open) => open.knowledge.undo());
    });

    expect(after.knowledge.state.shown.get(wordIds[0])).toBeUndefined();
  });
});
