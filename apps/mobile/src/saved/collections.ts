import type { Collection, CollectionEntry, Collections } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { collectionRows, type CollectionRowModel } from './collections-screen';

/** The Collections, newest first, kept up to date. */
export function useCollectionList(): readonly Collection[] {
  return useSubscribed(useComposition().collections, ({ list }) => list);
}

/** The rows of the Collections screen, newest first, kept up to date. */
export function useCollectionRows(): readonly CollectionRowModel[] {
  const list = useCollectionList();
  const { count } = useEdition();
  return useMemo(
    () => collectionRows({ collections: list, strings: editionStrings.collections, count }),
    [list, count],
  );
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
  const { collections } = useComposition();
  // Every filing changes the list, so the screen reads `isFiled` again on each.
  const list = useCollectionList();
  return {
    collections: list,
    isFiled: (collectionId) => collections.has(collectionId, entryId),
    setFiled(collectionId, filed) {
      void keep(
        'Collections',
        filed ? collections.add(collectionId, entryId) : collections.remove(collectionId, entryId),
        undefined,
      );
    },
    // A Collection that could not be kept rejects: the sheet keeps its name field open.
    create: (name) => collections.create(name, entryId),
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
  const { collections } = useComposition();
  // Kept from render to render, so the rows of the Collections screen re-render only when the list changes.
  return useMemo(
    () => ({
      // A name that could not be kept rejects: the field stays open with the name as typed.
      create: (name) => collections.create(name),
      rename: (collectionId, name) => collections.rename(collectionId, name),
      remove(collectionId) {
        void keep('Collections', collections.delete(collectionId), undefined);
      },
    }),
    [collections],
  );
}

/** One Collection and its Entries, newest first, kept up to date; no Collection and no Entries when it is gone. */
export function useCollectionEntries(collectionId: string): {
  collection: Collection | undefined;
  entries: readonly CollectionEntry[];
  /** Takes the Entry out of this Collection only; it stays everywhere else it is kept. */
  remove: (entryId: string) => void;
} {
  const { collections } = useComposition();
  const list = useCollectionList();
  const entries = useSubscribed(collections, (open) => open.entries(collectionId));
  return {
    collection: list.find((collection) => collection.id === collectionId),
    entries,
    remove(entryId) {
      void keep('Collections', collections.remove(collectionId, entryId), undefined);
    },
  };
}
