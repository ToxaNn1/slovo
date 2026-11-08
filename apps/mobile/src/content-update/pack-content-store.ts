import type { ContentStore } from '@slovo/core';
import {
  applyPatch,
  patchStateOf,
  type PackTransaction,
  type PackWriteDatabase,
} from '@slovo/language-pack/reader';

/**
 * The content store over a writable Language Pack: it applies a Patch in one
 * transaction (`applyPatch`) and keeps the pack's content version and ETag at
 * hand, read again after each Patch, as the Core reads them synchronously.
 */
export async function openPackContentStore(
  db: PackWriteDatabase & Pick<PackTransaction, 'getAllAsync'>,
): Promise<ContentStore> {
  let state = await patchStateOf(db);
  return {
    contentVersion: () => state.contentVersion,
    etag: () => state.etag,
    async apply(patch, etag) {
      await applyPatch(db, patch, etag);
      state = await patchStateOf(db);
    },
  };
}
