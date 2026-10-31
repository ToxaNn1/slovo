import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Entry } from '@slovo/contracts';
import { openLanguagePack, PACK_FORMAT } from '@slovo/language-pack';
import type { ContentPackStore } from '@slovo/server-core';

/** Where the backend keeps the published packs it reads, one file per SHA-256. */
const PACKS_DIR = join(tmpdir(), 'slovo-packs');

/**
 * The Entries of the Edition's latest published Language Pack. SQLite reads a
 * pack from a file, so the pack's bytes go to a file named by their SHA-256
 * the first time they are read, and every later read opens that file.
 */
export function createPackEntries(store: ContentPackStore) {
  return {
    /** The Entries of the ids the pack has, in no set order; none while no pack is published. */
    async entries(editionId: string, ids: readonly string[]): Promise<readonly Entry[]> {
      const latest = await store.latest(editionId, PACK_FORMAT);
      if (latest === undefined) return [];
      const file = join(PACKS_DIR, `${latest.fileSha256}.db`);
      if (!existsSync(file)) {
        const published = await store.file(editionId, latest.contentVersion);
        if (published === undefined) return [];
        mkdirSync(PACKS_DIR, { recursive: true });
        // Written whole before it takes its name, so no read meets half a pack.
        const partial = `${file}.${String(process.pid)}.partial`;
        writeFileSync(partial, published.bytes);
        renameSync(partial, file);
      }
      const pack = openLanguagePack(file);
      try {
        return await pack.getEntries(ids);
      } finally {
        pack.close();
      }
    },
  };
}
