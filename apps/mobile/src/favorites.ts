import type { Favorite, Favorites } from '@slovo/core';
import { useCallback, useSyncExternalStore } from 'react';

import { useComposition } from './composition';

const noFavorites: readonly Favorite[] = [];

/** Favorites of the session's Core composition, once it is open. */
export function useFavorites(): Favorites | undefined {
  const composition = useComposition();
  return composition.status === 'ready' ? composition.composition.favorites : undefined;
}

/** Subscribes to Favorites, if they are open, for `useSyncExternalStore`. */
function useSubscribe(favorites: Favorites | undefined) {
  return useCallback(
    (listener: () => void) => favorites?.subscribe(listener) ?? (() => undefined),
    [favorites],
  );
}

/** The Entries in Favorites, newest first, kept up to date; none until Favorites open. */
export function useFavoriteList(): readonly Favorite[] {
  const favorites = useFavorites();
  return useSyncExternalStore(useSubscribe(favorites), () => favorites?.list ?? noFavorites);
}

/**
 * Waits for a change of Favorites. One that could not be kept is logged and
 * resolves to `unchanged`, as Favorites stay as they were.
 */
async function keep<T>(change: Promise<T>, unchanged: T): Promise<T> {
  try {
    return await change;
  } catch (error) {
    console.error('Could not keep the change of Favorites', error);
    return unchanged;
  }
}

/** Whether the Entry is in Favorites, kept up to date, and the calls that change that. */
export function useFavorite(entryId: string): {
  inFavorites: boolean;
  /** Adds the Entry or takes it out; resolves to whether it is in Favorites now. */
  toggle: () => Promise<boolean>;
  remove: () => void;
} {
  const favorites = useFavorites();
  const inFavorites = useSyncExternalStore(
    useSubscribe(favorites),
    () => favorites?.has(entryId) ?? false,
  );
  return {
    inFavorites,
    toggle: () =>
      favorites === undefined
        ? Promise.resolve(false)
        : keep(favorites.toggle(entryId), favorites.has(entryId)),
    remove: () => {
      if (favorites !== undefined) void keep(favorites.remove(entryId), undefined);
    },
  };
}
