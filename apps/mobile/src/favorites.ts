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

/** Whether the Entry is in Favorites, kept up to date, and the call that adds or removes it. */
export function useFavorite(entryId: string): { inFavorites: boolean; toggle: () => void } {
  const favorites = useFavorites();
  const inFavorites = useSyncExternalStore(
    useSubscribe(favorites),
    () => favorites?.has(entryId) ?? false,
  );
  return {
    inFavorites,
    toggle() {
      favorites?.toggle(entryId).catch((error: unknown) => {
        console.error('Could not keep the change of Favorites', error);
      });
    },
  };
}

/** Takes the Entry out of Favorites. */
export function removeFavorite(favorites: Favorites | undefined, entryId: string): void {
  favorites?.remove(entryId).catch((error: unknown) => {
    console.error('Could not keep the change of Favorites', error);
  });
}
