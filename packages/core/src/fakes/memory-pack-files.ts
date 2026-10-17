import type { PackFiles, PackVersion } from '../ports';

/** Pack files for tests: what is kept is in view. */
export interface MemoryPackFiles extends PackFiles {
  /** The pack kept, with its bytes, if one is. */
  readonly kept: (PackVersion & { readonly bytes: Uint8Array }) | undefined;
}

/** Pack files held in memory, for tests; a pack may be kept already, as from an earlier launch. */
export function createMemoryPackFiles(
  kept?: PackVersion & { readonly bytes: Uint8Array },
): MemoryPackFiles {
  let current = kept;
  return {
    get kept() {
      return current;
    },
    keep({ contentVersion, packFormat }, bytes) {
      current = { contentVersion, packFormat, bytes };
      return Promise.resolve();
    },
    read() {
      if (current === undefined) return Promise.resolve(undefined);
      const { contentVersion, packFormat } = current;
      return Promise.resolve({ contentVersion, packFormat });
    },
    forget() {
      current = undefined;
      return Promise.resolve();
    },
  };
}
