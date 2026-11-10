import type { Patch } from '@slovo/contracts/api';

import type { ContentStore } from '../ports';

/** A content store in memory: the Patches it applied, in order, and whether the next one fails. */
export interface MemoryContentStore extends ContentStore {
  readonly applied: readonly Patch[];
  /** Makes each later `apply` reject, as a pack that fails half-way does, until turned off. */
  failApplying(on: boolean): void;
}

/** A content store at a content version, which checks a Patch as the device's pack does. */
export function createMemoryContentStore({
  editionId = 'uk',
  contentVersion = 1,
  etag,
}: { editionId?: string; contentVersion?: number; etag?: string } = {}): MemoryContentStore {
  let version = contentVersion;
  let lastEtag = etag;
  let failing = false;
  const applied: Patch[] = [];
  return {
    applied,
    contentVersion: () => version,
    etag: () => lastEtag,
    failApplying(on) {
      failing = on;
    },
    apply(patch, patchEtag) {
      if (failing) return Promise.reject(new Error('The pack failed half-way'));
      if (patch.editionId !== editionId || patch.since !== version) {
        return Promise.reject(new Error('The Patch is not for this pack'));
      }
      applied.push(patch);
      version = patch.contentVersion;
      lastEtag = patchEtag;
      return Promise.resolve();
    },
  };
}
