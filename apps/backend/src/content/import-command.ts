// Imports an Edition's content folder into the content tables, once (ADR 0090):
// `pnpm content import --edition <id> [--snapshot <file>] [--override]`.
// With --snapshot it imports a content snapshot saved to a file instead, as
// CI, Maestro and `pnpm dev` seed an empty database. An Edition already
// imported is left as it is and the command succeeds, so it can run again.
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { ContentSnapshot } from '@slovo/contracts/api';
import { formatBuildError, readSnapshotFile } from '@slovo/language-pack';
import { systemClock } from '@slovo/server-core';

import { ownerAlertsOf } from '../alerts/owner-chat';
import { PublishConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createEditions } from '../edition/editions';
import { readEditions } from '../edition/edition-folders';
import { createLogger } from '../logger';
import { createContentStore } from './content-store';

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      edition: { type: 'string' },
      snapshot: { type: 'string' },
      override: { type: 'boolean', default: false },
    },
  });
  const editionId = values.edition;
  if (editionId === undefined || positionals.length > 0) {
    console.error(
      'Usage: pnpm content import --edition <edition-id> [--snapshot <file>] [--override]',
    );
    return 2;
  }
  let snapshot: ContentSnapshot | undefined;
  if (values.snapshot !== undefined) {
    // Named from where pnpm runs, not from this package.
    const file = resolve(process.env['INIT_CWD'] ?? process.cwd(), values.snapshot);
    try {
      snapshot = readSnapshotFile(file);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`The snapshot ${file} does not read: ${reason}`);
      return 1;
    }
  }
  const { DATABASE_URL, EDITIONS_DIR, ...telegram } = readConfig(PublishConfigSchema, process.env);
  const logger = createLogger();
  const database = createDatabase(DATABASE_URL, logger);
  try {
    const editions = createEditions({
      database,
      clock: systemClock,
      editions: readEditions(EDITIONS_DIR),
      alerts: ownerAlertsOf(database, telegram, logger),
    });
    const store = createContentStore({ database, clock: systemClock, editions });
    const editionDir = join(EDITIONS_DIR, editionId);
    const options = { override: values.override };
    const imported =
      snapshot === undefined
        ? await store.importEdition(editionId, editionDir, options)
        : await store.importSnapshot(editionId, editionDir, snapshot, options);
    if (!imported.ok && imported.reason === 'already-imported') {
      console.error(
        `The content of "${editionId}" is already imported: nothing was written. Pass --override to import it again over the database.`,
      );
      return 0;
    }
    if (!imported.ok) {
      if (imported.reason === 'refused') {
        for (const refusal of imported.refusals) {
          const rule = refusal.rule === undefined ? '' : `[${refusal.rule}] `;
          console.error(`${rule}${formatBuildError(refusal)}`);
        }
        console.error(`The content of "${editionId}" is not imported: nothing was written.`);
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
