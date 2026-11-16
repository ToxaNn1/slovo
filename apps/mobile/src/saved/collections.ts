import type {
  Collection,
  CollectionEntry,
  Collections,
  DeletedCollection,
  RenameResult,
} from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { refusalText } from './collection-refusal';
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
      );
    },
    // A refused name resolves to its refusal, never rejects: the sheet keeps its name field open.
    create: (name) => collections.create(name, entryId),
  };
}

/**
 * A rename in the Edition's words: kept, `renamed` false when the name was
 * already the Collection's own or the Collection is gone, or why it is refused.
 */
export type RenamedCollection =
  | { readonly ok: true; readonly renamed: boolean }
  | { readonly ok: false; readonly refusal: string };

async function renamedOf(result: Promise<RenameResult | undefined>): Promise<RenamedCollection> {
  const kept = await result;
  if (kept === undefined) return { ok: true, renamed: false };
  if (kept.ok) return { ok: true, renamed: kept.renamed };
  return { ok: false, refusal: refusalText(editionStrings.collections.sheet.refusal, kept.reason) };
}

/** A new Collection once it is kept, or why its name is refused, in the Edition's words. */
export type CreatedCollection =
  | { readonly ok: true; readonly collection: Collection }
  | { readonly ok: false; readonly refusal: string };

/** The calls of the Collections screen that change a Collection. */
export function useCollectionChanges(): {
  /** Makes an empty Collection; resolves to it once it is kept, or to why its name is refused. */
  create: (name: string) => Promise<CreatedCollection>;
  /** Renames a Collection; resolves to whether the name changed once it is kept, or to why it is refused. */
  rename: (collectionId: string, name: string) => Promise<RenamedCollection>;
  /**
   * Deletes a Collection with its Entry records; the Entries stay wherever
   * else they are kept. Resolves to its undo once it is kept, or to nothing.
   */
  remove: (collectionId: string) => Promise<DeletedCollection | undefined>;
} {
  const { collections } = useComposition();
  // Kept from render to render, so the rows of the Collections screen re-render only when the list changes.
  return useMemo(
    () => ({
      // A refused name resolves to its refusal, never rejects: the field stays open with the name as typed.
      async create(name) {
        const kept = await collections.create(name);
        return kept.ok
          ? kept
          : {
              ok: false,
              refusal: refusalText(editionStrings.collections.sheet.refusal, kept.reason),
            };
      },
      rename: (collectionId, name) => renamedOf(collections.rename(collectionId, name)),
      remove: (collectionId) => keep('Collections', collections.delete(collectionId)),
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
      void keep('Collections', collections.remove(collectionId, entryId));
    },
  };
}
