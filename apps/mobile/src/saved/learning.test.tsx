import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test/test-support';
import { useLearningList } from './learning';

describe('the learning list hook', () => {
  it('takes in an Entry the reader marks unknown', async () => {
    const { composition, hook } = await renderOverComposition(() => useLearningList());
    expect(hook.result.current).toEqual([]);

    await settled(() => composition.knowledge.set('w_one', 'unknown'));

    expect(hook.result.current.map(({ entryId }) => entryId)).toEqual(['w_one']);
  });
});
