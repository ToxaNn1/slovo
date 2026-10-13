import type { Collection, CollectionEntry, Collections } from '@slovo/core';
import { useCallback, useSyncExternalStore } from 'react';

import { useComposition } from './composition';

const noCollections: readonly Collection[] = [];
const noEntries: readonly CollectionEntry[] = [];

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

/** The calls of the Collections screen that change a Collection. */
export function useCollectionChanges(): {
  /** Makes an empty Collection; resolves to the Collection, or why its name is refused. */
  create: (name: string) => ReturnType<Collections['create']>;
  /** Renames a Collection; resolves to the Collection, or why the name is refused. */
  rename: (collectionId: string, name: string) => ReturnType<Collections['rename']>;
  /** Deletes a Collection with its Entry records; the Entries stay wherever else they are kept. */
  remove: (collectionId: string) => void;
} {
  const collections = useCollections();
  const rejectNotOpen = () => Promise.reject(new Error('Collections are not open yet.'));
  // A name that could not be kept rejects: the field stays open with the name as typed.
  return {
    create: (name) => collections?.create(name) ?? rejectNotOpen(),
    rename: (collectionId, name) => collections?.rename(collectionId, name) ?? rejectNotOpen(),
    remove(collectionId) {
      if (collections === undefined) return;
      void keep(collections.delete(collectionId), undefined);
    },
  };
}

/** One Collection and its Entries, newest first, kept up to date; no Collection and no Entries until Collections open or when it is gone. */
export function useCollectionEntries(collectionId: string): {
  collection: Collection | undefined;
  entries: readonly CollectionEntry[];
  /** Takes the Entry out of this Collection only; it stays everywhere else it is kept. */
  remove: (entryId: string) => void;
} {
  const collections = useCollections();
  const list = useCollectionList();
  const entries = useSyncExternalStore(
    useSubscribe(collections),
    () => collections?.entries(collectionId) ?? noEntries,
  );
  return {
    collection: list.find((collection) => collection.id === collectionId),
    entries,
    remove(entryId) {
      if (collections === undefined) return;
      void keep(collections.remove(collectionId, entryId), undefined);
    },
  };
}
