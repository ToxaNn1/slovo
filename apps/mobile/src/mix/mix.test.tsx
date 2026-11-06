import { describe, expect, it } from '@jest/globals';

import { crafts, nature, renderOverComposition, settled } from '../hook-test-support';
import { useMixChanges, useMixState } from './mix';

/** The Mix hooks over a composition of the test Language Pack. */
const renderMix = () =>
  renderOverComposition(() => ({ state: useMixState(), changes: useMixChanges() }));

describe('the Mix hooks', () => {
  it('take a Category out of the Mix and put every one back', async () => {
    const { hook } = await renderMix();
    expect(hook.result.current.state.categoryIds).toEqual([nature.id, crafts.id]);

    await settled(() => {
      hook.result.current.changes.toggleCategory(nature.id, false);
    });
    expect(hook.result.current.state.categoryIds).toEqual([crafts.id]);

    await settled(() => {
      hook.result.current.changes.turnAllOn();
    });
    expect(hook.result.current.state.categoryIds).toEqual([nature.id, crafts.id]);
  });

  it('keep a kind of Entry, its weight and how often a Quick Question comes', async () => {
    const { hook } = await renderMix();

    await settled(() => {
      hook.result.current.changes.setKind('idiom', false);
      hook.result.current.changes.setKindWeight('correction', 'more');
      hook.result.current.changes.setQuickQuestionEvery(6);
    });

    expect(hook.result.current.state.kinds.idiom).toBe(false);
    expect(hook.result.current.state.kindWeights.correction).toBe('more');
    expect(hook.result.current.state.quickQuestionEvery).toBe(6);
  });
});
