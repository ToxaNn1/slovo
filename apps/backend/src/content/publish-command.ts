// `pnpm publish:pack <edition-id>`: publishes the Edition's built Language
// Pack (`pnpm build:pack <edition-id>`) to the database DATABASE_URL names,
// so `content.latest` announces it (ADR 0032).
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { EditionFolderError, openEdition } from '@slovo/language-pack/edition';
import { systemClock, type PublishRefusal } from '@slovo/server-core';

import { PublishConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { createLogger } from '../logger';
import { publishPack } from './publish-pack';

/** What the owner reads when the pack is refused, and what to do about it. */
const REFUSALS: Record<PublishRefusal, string> = {
  'unknown-edition': 'the backend does not find its Edition in EDITIONS_DIR.',
  'not-recorded':
    "its content checksum is not the one the Edition's content/manifest.json records. Rebuild it with pnpm build:pack.",
  'version-not-higher':
    'a higher content version is already published. Record the content (pnpm build:pack --record) and rebuild it.',
  'already-published':
    'its content version is already published, and a published version never changes.',
};

async function main(): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const [editionId] = positionals;
  if (editionId === undefined || positionals.length > 1) {
    console.error('Usage: pnpm publish:pack <edition-id>');
    return 2;
  }
  const { DATABASE_URL, EDITIONS_DIR } = readConfig(PublishConfigSchema, process.env);

  let file: string;
  try {
    file = openEdition(EDITIONS_DIR, editionId).path('languagePack');
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return 2;
  }
  if (!existsSync(file)) {
    console.error(
      `No Language Pack of "${editionId}" at ${file}: build it with pnpm build:pack ${editionId}`,
    );
    return 1;
  }
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const published = await publishPack({
      database,
      clock: systemClock,
      editions: readEditions(EDITIONS_DIR),
      file,
    });
    if (!published.ok) {
      console.error(`Language Pack of "${editionId}" not published: ${REFUSALS[published.reason]}`);
      return 1;
    }
    const { pack } = published;
    console.log(`Published the Language Pack of "${editionId}"`);
    console.log(`  content version: ${String(pack.contentVersion)}`);
    console.log(`  pack format:     ${String(pack.packFormat)}`);
    console.log(`  size:            ${String(pack.size)} bytes`);
    console.log(`  file SHA-256:    ${pack.fileSha256}`);
    return 0;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
