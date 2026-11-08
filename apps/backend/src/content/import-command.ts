// Imports an Edition's content folder into the content tables, once (ADR 0090):
// `pnpm content import --edition <id> [--override]`. Exits 0 once imported,
// 3 when the Edition's content is already imported, 1 on any other failure.
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { formatBuildError } from '@slovo/language-pack';
import { systemClock } from '@slovo/server-core';

import { PublishConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createEditions } from '../edition/editions';
import { readEditions } from '../edition/edition-folders';
import { createLogger } from '../logger';
import { createContentStore } from './content-store';

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { edition: { type: 'string' }, override: { type: 'boolean', default: false } },
  });
  const editionId = values.edition;
  if (editionId === undefined || positionals.length > 0) {
    console.error('Usage: pnpm content import --edition <edition-id> [--override]');
    return 2;
  }
  const { DATABASE_URL, EDITIONS_DIR } = readConfig(PublishConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const editions = createEditions({
      database,
      clock: systemClock,
      editions: readEditions(EDITIONS_DIR),
    });
    const store = createContentStore({ database, clock: systemClock, editions });
    const imported = await store.importEdition(editionId, join(EDITIONS_DIR, editionId), {
      override: values.override,
    });
    if (!imported.ok) {
      if (imported.reason === 'refused') {
        for (const refusal of imported.refusals) {
          const rule = refusal.rule === undefined ? '' : `[${refusal.rule}] `;
          console.error(`${rule}${formatBuildError(refusal)}`);
        }
        console.error(`The content of "${editionId}" is not imported: nothing was written.`);
      } else if (imported.reason === 'already-imported') {
        console.error(
          `The content of "${editionId}" is already imported. Pass --override to import it again over the database.`,
        );
        return 3;
      } else {
        console.error(`The backend does not find the Edition "${editionId}" in EDITIONS_DIR.`);
      }
      return 1;
    }
    const { counts, contentVersion } = imported;
    console.log(`Imported the content of "${editionId}"`);
    console.log(`  words:               ${String(counts.words)}`);
    console.log(`  idioms:              ${String(counts.idioms)}`);
    console.log(`  corrections:         ${String(counts.corrections)}`);
    console.log(`  tips:                ${String(counts.tips)}`);
    console.log(`  synonym rows:        ${String(counts.synonymRows)}`);
    console.log(`  curated collections: ${String(counts.curatedCollections)}`);
    console.log(`  crossword days:      ${String(counts.crosswordDays)}`);
    console.log(`  content version:     ${String(contentVersion)}`);
    return 0;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
