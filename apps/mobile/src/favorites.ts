import type { Favorite, Favorites } from '@slovo/core';

import { useComposed, useModule } from './composition';
import { keep } from './keep';

const noFavorites: readonly Favorite[] = [];

/** Favorites of the session's Core composition, once it is open. */
function useFavorites(): Favorites | undefined {
  return useModule((composition) => composition.favorites);
}

/** The Entries in Favorites, newest first, kept up to date; none until Favorites open. */
export function useFavoriteList(): readonly Favorite[] {
  return useComposed(
    (composition) => composition.favorites,
    (favorites) => favorites.list,
    noFavorites,
  );
}

/** Whether the Entry is in Favorites, kept up to date, and the calls that change that. */
export function useFavorite(entryId: string): {
  inFavorites: boolean;
  /** Adds the Entry or takes it out; resolves to whether it is in Favorites now. */
  toggle: () => Promise<boolean>;
  remove: () => void;
} {
  const favorites = useFavorites();
  const inFavorites = useComposed(
    (composition) => composition.favorites,
    (open) => open.has(entryId),
    false,
  );
  return {
    inFavorites,
    toggle: () =>
      favorites === undefined
        ? Promise.resolve(false)
        : keep('Favorites', favorites.toggle(entryId), favorites.has(entryId)),
    remove: () => {
      if (favorites !== undefined) void keep('Favorites', favorites.remove(entryId), undefined);
    },
  };
}
