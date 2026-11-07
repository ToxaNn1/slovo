import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test/test-support';
import { useFavorite, useFavoriteList } from './favorites';

/** One Entry's Favorites calls and the Favorites list, over the test Language Pack. */
const renderFavorite = () =>
  renderOverComposition(() => ({ one: useFavorite('w_one'), list: useFavoriteList() }));

describe('the Favorites hooks', () => {
  it('add the Entry, resolving to it being in Favorites', async () => {
    const { hook } = await renderFavorite();
    expect(hook.result.current.one.inFavorites).toBe(false);

    let nowIn: boolean | undefined;
    await settled(async () => {
      nowIn = await hook.result.current.one.toggle();
    });

    expect(nowIn).toBe(true);
    expect(hook.result.current.one.inFavorites).toBe(true);
    expect(hook.result.current.list.map(({ entryId }) => entryId)).toEqual(['w_one']);
  });

  it('take the Entry out of Favorites', async () => {
    const { composition, hook } = await renderFavorite();
    await settled(() => composition.favorites.add('w_one'));
    expect(hook.result.current.one.inFavorites).toBe(true);

    await settled(() => {
      hook.result.current.one.remove();
    });

    expect(hook.result.current.one.inFavorites).toBe(false);
    expect(hook.result.current.list).toEqual([]);
  });
});
