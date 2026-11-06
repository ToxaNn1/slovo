import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test-support';
import { useCollectionChanges, useCollectionList, useEntryCollections } from './collections';

/** The Collections hooks for one Entry, over the test Language Pack. */
const renderCollections = () =>
  renderOverComposition(() => ({
    list: useCollectionList(),
    entry: useEntryCollections('w_one'),
    changes: useCollectionChanges(),
  }));

describe('the Collections hooks', () => {
  it('file the Entry in a Collection and take it out', async () => {
    const { hook } = await renderCollections();
    expect(await hook.result.current.changes.create('Мої')).toBeUndefined();
    await settled(() => undefined);
    const [collection] = hook.result.current.list;
    if (collection === undefined) throw new Error('No Collection was made.');

    await settled(() => {
      hook.result.current.entry.setFiled(collection.id, true);
    });
    expect(hook.result.current.entry.isFiled(collection.id)).toBe(true);

    await settled(() => {
      hook.result.current.entry.setFiled(collection.id, false);
    });
    expect(hook.result.current.entry.isFiled(collection.id)).toBe(false);
  });

  it('delete a Collection', async () => {
    const { hook } = await renderCollections();
    await settled(() => hook.result.current.changes.create('Мої'));
    const [collection] = hook.result.current.list;
    if (collection === undefined) throw new Error('No Collection was made.');

    await settled(() => {
      hook.result.current.changes.remove(collection.id);
    });

    expect(hook.result.current.list).toEqual([]);
  });
});
