import { describe, expect, it } from '@jest/globals';

import { nature, renderOverComposition, settled } from '../hook-test/test-support';
import { useHiddenScreenModel, useHiddenShow } from './hidden';
import { useMixState } from './mix';

/** The Hidden screen's one list, its «Показати» and the Mix it changes, over the test Language Pack. */
const renderHidden = () =>
  renderOverComposition(() => ({
    rows: useHiddenScreenModel().rows,
    show: useHiddenShow(),
    mix: useMixState(),
  }));

describe('«Показати» on the Hidden screen', () => {
  it('puts a hidden Category back in the Mix', async () => {
    const { composition, hook } = await renderHidden();
    await settled(() => composition.hide({ kind: 'category', categoryId: nature.id }));
    expect(hook.result.current.mix.categoryIds).not.toContain(nature.id);
    const [row] = hook.result.current.rows;
    if (row === undefined) throw new Error('The Category is not listed');

    await settled(() => {
      hook.result.current.show(row);
    });

    expect(hook.result.current.mix.categoryIds).toContain(nature.id);
    expect(hook.result.current.rows).toEqual([]);
  });

  it('puts a hidden kind of Entry back in the Mix', async () => {
    const { composition, hook } = await renderHidden();
    await settled(() => composition.hide({ kind: 'whole-kind', entryKind: 'idiom' }));
    expect(hook.result.current.mix.kinds.idiom).toBe(false);
    const [row] = hook.result.current.rows;
    if (row === undefined) throw new Error('The kind is not listed');

    await settled(() => {
      hook.result.current.show(row);
    });

    expect(hook.result.current.mix.kinds.idiom).toBe(true);
  });
});
