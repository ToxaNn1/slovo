import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { openLanguagePack } from '@slovo/language-pack';
import {
  createContentPacks,
  createEditionRegistry,
  type Clock,
  type ContentPacks,
  type Edition,
} from '@slovo/server-core';

import type { Database } from '../database/database';
import { createRemoteSwitchStore } from '../edition/remote-switch-store';
import { createContentPackStore } from './content-pack-store';

/**
 * Publishes a built Language Pack file (`pnpm build:pack`) of the Edition by
 * the server Core's rules (ADR 0032): the bytes, the metadata read from them,
 * their size and SHA-256 go into one row.
 */
export async function publishPack({
  database,
  clock,
  editions,
  editionId,
  file,
}: {
  database: Database;
  clock: Clock;
  /** The Editions as their folders hold them now. */
  editions: readonly Edition[];
  editionId: string;
  file: string;
}): ReturnType<ContentPacks['publish']> {
  const bytes = readFileSync(file);
  const pack = openLanguagePack(file);
  let metadata;
  try {
    metadata = await pack.metadata();
  } finally {
    pack.close();
  }
  const contentPacks = createContentPacks({
    editions: createEditionRegistry({
      editions,
      remoteSwitches: createRemoteSwitchStore(database),
      clock,
    }),
    store: createContentPackStore(database),
    clock,
  });
  return contentPacks.publish(editionId, {
    metadata,
    fileSha256: createHash('sha256').update(bytes).digest('hex'),
    bytes,
  });
}
