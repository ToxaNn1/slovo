import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test/test-support';
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
    const created = await hook.result.current.changes.create('Мої');
    await settled(() => undefined);
    const [collection] = hook.result.current.list;
    if (collection === undefined) throw new Error('No Collection was made.');
    expect(created).toEqual({ ok: true, collection });

    await settled(() => {
      hook.result.current.entry.setFiled(collection.id, true);
    });
    expect(hook.result.current.entry.isFiled(collection.id)).toBe(true);

    await settled(() => {
      hook.result.current.entry.setFiled(collection.id, false);
    });
    expect(hook.result.current.entry.isFiled(collection.id)).toBe(false);
  });

  it('make a Collection and refuse a name another Collection has', async () => {
    const { hook } = await renderCollections();
    const created = await hook.result.current.changes.create('Мої');
    await settled(() => undefined);

    expect(created).toMatchObject({ ok: true, collection: { name: 'Мої' } });
    expect(await hook.result.current.changes.create('мої')).toEqual({
      ok: false,
      refusal: 'Колекція з такою назвою вже є.',
    });
    expect(await hook.result.current.changes.create('  ')).toEqual({
      ok: false,
      refusal: 'Дай колекції назву.',
    });
  });

  it('rename a Collection, tell a name kept as it is, and refuse a name too long', async () => {
    const { hook } = await renderCollections();
    await settled(() => hook.result.current.changes.create('Мої'));
    const [collection] = hook.result.current.list;
    if (collection === undefined) throw new Error('No Collection was made.');

    expect(await hook.result.current.changes.rename(collection.id, 'я'.repeat(41))).toEqual({
      ok: false,
      refusal: 'Назва задовга: не більше 40 символів.',
    });
    expect(await hook.result.current.changes.rename(collection.id, ' Мої ')).toEqual({
      ok: true,
      renamed: false,
    });
    expect(await hook.result.current.changes.rename(collection.id, 'Для есе')).toEqual({
      ok: true,
      renamed: true,
    });
    await settled(() => undefined);

    expect(hook.result.current.list.map(({ name }) => name)).toEqual(['Для есе']);
  });

  it('delete a Collection', async () => {
    const { hook } = await renderCollections();
    await settled(() => hook.result.current.changes.create('Мої'));
    const [collection] = hook.result.current.list;
    if (collection === undefined) throw new Error('No Collection was made.');

    await settled(() => hook.result.current.changes.remove(collection.id));

    expect(hook.result.current.list).toEqual([]);
  });
});
