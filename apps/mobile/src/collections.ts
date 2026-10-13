import type { Collection, Collections } from '@slovo/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useComposition } from './composition';

const noCollections: readonly Collection[] = [];

/** Collections of the session's Core composition, once it is open. */
function useCollections(): Collections | undefined {
  const composition = useComposition();
  return composition.status === 'ready' ? composition.composition.collections : undefined;
}

/** Subscribes to Collections, if they are open, for `useSyncExternalStore`. */
function useSubscribe(collections: Collections | undefined) {
  return useCallback(
    (listener: () => void) => collections?.subscribe(listener) ?? (() => undefined),
    [collections],
  );
}

/** The Collections, newest first, kept up to date; none until they open. */
export function useCollectionList(): readonly Collection[] {
  const collections = useCollections();
  return useSyncExternalStore(useSubscribe(collections), () => collections?.list ?? noCollections);
}

/**
 * Waits for a change of Collections. One that could not be kept is logged and
 * resolves to `unchanged`, as Collections stay as they were.
 */
async function keep<T>(change: Promise<T>, unchanged: T): Promise<T> {
  try {
    return await change;
  } catch (error) {
    console.error('Could not keep the change of Collections', error);
    return unchanged;
  }
}

/** The Collections of the sheet for one Entry: the list, where the Entry is filed, and the calls that change that. */
export function useEntryCollections(entryId: string): {
  collections: readonly Collection[];
  isFiled: (collectionId: string) => boolean;
  /** Files the Entry in the Collection, or takes it out. */
  setFiled: (collectionId: string, filed: boolean) => void;
  /** Makes a Collection with the Entry in it; resolves to the Collection, or why its name is refused. */
  create: (name: string) => ReturnType<Collections['create']>;
} {
  const collections = useCollections();
  // Every filing changes the list, so the screen reads `isFiled` again on each.
  const list = useCollectionList();
  return {
    collections: list,
    isFiled: (collectionId) => collections?.has(collectionId, entryId) ?? false,
    setFiled(collectionId, filed) {
      if (collections === undefined) return;
      void keep(
        filed ? collections.add(collectionId, entryId) : collections.remove(collectionId, entryId),
        undefined,
      );
    },
    // A Collection that could not be kept rejects: the sheet keeps its name field open.
    create: (name) =>
      collections === undefined
        ? Promise.reject(new Error('Collections are not open yet.'))
        : collections.create(name, entryId),
  };
}

/** What the Entry's row leads with, once it is known; read when `enabled`. */
export function useEntryTitle(entryId: string, enabled: boolean): string {
  const composition = useComposition();
  const [title, setTitle] = useState('');
  const open = composition.status === 'ready' ? composition.composition : undefined;
  useEffect(() => {
    if (!enabled || open === undefined) return;
    let active = true;
    open.entryRow(entryId).then(
      (row) => {
        if (active) setTitle(row?.title ?? '');
      },
      (error: unknown) => {
        console.error('Could not read the Entry', error);
      },
    );
    return () => {
      active = false;
    };
  }, [open, entryId, enabled]);
  return title;
}
