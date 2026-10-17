import type { Favorite } from '@slovo/core';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/** The Entries in Favorites, newest first, kept up to date. */
export function useFavoriteList(): readonly Favorite[] {
  return useSubscribed(useComposition().favorites, ({ list }) => list);
}

/** Whether the Entry is in Favorites, kept up to date, and the calls that change that. */
export function useFavorite(entryId: string): {
  inFavorites: boolean;
  /** Adds the Entry or takes it out; resolves to whether it is in Favorites now. */
  toggle: () => Promise<boolean>;
  remove: () => void;
} {
  const { favorites } = useComposition();
  const inFavorites = useSubscribed(favorites, (open) => open.has(entryId));
  return {
    inFavorites,
    toggle: () => keep('Favorites', favorites.toggle(entryId), favorites.has(entryId)),
    remove: () => {
      void keep('Favorites', favorites.remove(entryId), undefined);
    },
  };
}
