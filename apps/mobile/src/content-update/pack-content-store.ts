import type { ContentStore, WordMedia } from '@slovo/core';

import {
  applyPatch,
  mediaOf,
  patchStateOf,
  type PackWriteDatabase,
} from '@slovo/language-pack/reader';

/** A Patch the content store applies. */
type Patch = Parameters<ContentStore['apply']>[0];

/** The Patch-related state of the pack, read in a transaction of its own. */
async function stateOf(db: PackWriteDatabase) {
  let state: Awaited<ReturnType<typeof patchStateOf>> | undefined;
  await db.transaction(async (tx) => {
    state = await patchStateOf(tx);
  });
  if (state === undefined) throw new Error('The pack read no metadata');
  return state;
}

/**
 * The content store over a writable Language Pack: it applies a Patch in one
 * transaction (`applyPatch`) and keeps the pack's content version and ETag at
 * hand, read again after each Patch, as the Core reads them synchronously.
 * Each applied Patch goes on to `patchApplied`, which evicts the media files
 * of the rows it retired (ADR 0099).
 */
export async function openPackContentStore(
  db: PackWriteDatabase,
  patchApplied: (store: ContentStore, patch: Patch) => Promise<void>,
): Promise<ContentStore> {
  let state = await stateOf(db);
  const store: ContentStore = {
    contentVersion: () => state.contentVersion,
    etag: () => state.etag,
    async apply(patch, etag) {
      await applyPatch(db, patch, etag);
      state = await stateOf(db);
      await patchApplied(store, patch);
    },
    async mediaOf(wordId) {
      let media: WordMedia | undefined;
      await db.transaction(async (tx) => {
        media = await mediaOf(tx, wordId);
      });
      if (media === undefined) throw new Error('The pack read no media');
      return media;
    },
  };
  return store;
}
