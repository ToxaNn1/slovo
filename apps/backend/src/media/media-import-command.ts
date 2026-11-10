// Puts an Edition folder's Recordings and Illustrations in the Media Store
// and writes their media rows, once (#1770):
// `pnpm import-media --edition <id> [--force]`. It runs from the owner's
// laptop with the R2 keys and the Deployment's DATABASE_URL, before the
// Recordings job's first backlog (docs/deploy.md). An Edition that already
// has media rows is left as it is and the command succeeds.
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { systemClock } from '@slovo/server-core';

import { MediaImportConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { createLogger } from '../logger';
import { createMediaImport } from './media-import';
import { r2MediaStore } from './media-store';

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { edition: { type: 'string' }, force: { type: 'boolean', default: false } },
  });
  const editionId = values.edition;
  if (editionId === undefined || positionals.length > 0) {
    console.error('Usage: pnpm import-media --edition <edition-id> [--force]');
    return 2;
  }
  const config = readConfig(MediaImportConfigSchema, process.env);
  const edition = readEditions(config.EDITIONS_DIR).find(({ config: { id } }) => id === editionId);
  if (edition === undefined) {
    console.error(`The backend does not find the Edition "${editionId}" in EDITIONS_DIR.`);
    return 1;
  }
  const database = createDatabase(config.DATABASE_URL, createLogger());
  try {
    const imported = await createMediaImport({
      database,
      clock: systemClock,
      store: r2MediaStore(config.r2, { clock: systemClock }),
    }).run(edition, join(config.EDITIONS_DIR, editionId), { force: values.force });
    if (!imported.ok) {
      switch (imported.reason) {
        case 'already-imported':
          console.error(
            `The media of "${editionId}" is already imported: nothing was written. Pass --force to import it again.`,
          );
          return 0;
        case 'not-imported':
          console.error(
            `The content of "${editionId}" is not imported yet: run \`pnpm content import --edition ${editionId}\` first.`,
          );
          return 1;
        case 'refused':
          for (const problem of imported.problems) console.error(problem);
          console.error(`The media of "${editionId}" is not imported: nothing was uploaded.`);
          return 1;
      }
    }
    console.log(`Imported the media of "${editionId}"`);
    console.log(`  recordings:      ${String(imported.recordings)}`);
    console.log(`  illustrations:   ${String(imported.illustrations)}`);
    console.log(`  stale, left out: ${String(imported.stale)}`);
    console.log(`  content version: ${String(imported.contentVersion)}`);
    return 0;
  } catch (error) {
    console.error(`import-media failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
