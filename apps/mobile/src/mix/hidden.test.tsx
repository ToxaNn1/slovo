import { describe, expect, it } from '@jest/globals';

import { nature, renderOverComposition, settled } from '../hook-test/test-support';
import { useHiddenChanges } from './hidden';
import { useMixState } from './mix';

/** The Hidden screen's calls and the Mix they change, over the test Language Pack. */
const renderHidden = () =>
  renderOverComposition(() => ({ changes: useHiddenChanges(), mix: useMixState() }));

describe('the Hidden screen calls', () => {
  it('put a hidden Category back in the Mix', async () => {
    const { composition, hook } = await renderHidden();
    await settled(() => composition.hide({ kind: 'category', categoryId: nature.id }));
    expect(hook.result.current.mix.categoryIds).not.toContain(nature.id);

    await settled(() => {
      hook.result.current.changes.turnCategoryOn(nature.id, 'word');
    });

    expect(hook.result.current.mix.categoryIds).toContain(nature.id);
  });

  it('put a hidden kind of Entry back in the Mix', async () => {
    const { composition, hook } = await renderHidden();
    await settled(() => composition.hide({ kind: 'whole-kind', entryKind: 'idiom' }));
    expect(hook.result.current.mix.kinds.idiom).toBe(false);

    await settled(() => {
      hook.result.current.changes.turnKindOn('idiom');
    });

    expect(hook.result.current.mix.kinds.idiom).toBe(true);
  });
});
