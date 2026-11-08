import type { ContentStore } from '@slovo/core';
import { applyPatch, patchStateOf, type PackWriteDatabase } from '@slovo/language-pack/reader';

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
 */
export async function openPackContentStore(db: PackWriteDatabase): Promise<ContentStore> {
  let state = await stateOf(db);
  return {
    contentVersion: () => state.contentVersion,
    etag: () => state.etag,
    async apply(patch, etag) {
      await applyPatch(db, patch, etag);
      state = await stateOf(db);
    },
  };
}
