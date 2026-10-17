import type { PackFiles, PackVersion } from '../ports';

/** A kept pack file: its version and its bytes. */
export type MemoryPackFile = PackVersion & { readonly bytes: Uint8Array };

/** Pack files for tests: what is kept is in view. */
export interface MemoryPackFiles extends PackFiles {
  /** The pack kept, if one is. */
  readonly kept: MemoryPackFile | undefined;
}

/** Pack files held in memory, for tests; a pack may be kept already, as from an earlier launch. */
export function createMemoryPackFiles(kept?: MemoryPackFile): MemoryPackFiles {
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
