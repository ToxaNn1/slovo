// `pnpm recordings`: records the Words of every Edition that miss a Recording
// on the database DATABASE_URL names, puts the files in the Media Store,
// deletes the files of rows retired 30 days ago, prints the counts and exits.
// The Railway Cron service «recordings» runs it hourly from
// recordings.Dockerfile, which holds the voice model (docs/deploy.md).
import { fileURLToPath } from 'node:url';

import { systemClock } from '@slovo/server-core';

import { readConfig, RecordingsConfigSchema } from '../config';
import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { createLogger } from '../logger';
import { memoryMediaStore, r2MediaStore } from '../media/media-store';
import { scriptGenerator } from './generator';
import { createRecordings } from './recordings';

const GENERATE_SCRIPT = fileURLToPath(new URL('../../recordings/generate.py', import.meta.url));

async function main(): Promise<number> {
  const config = readConfig(RecordingsConfigSchema, process.env);
  const database = createDatabase(config.DATABASE_URL, createLogger());
  try {
    const counts = await createRecordings({
      database,
      clock: systemClock,
      store:
        config.r2 === undefined
          ? memoryMediaStore()
          : r2MediaStore(config.r2, { clock: systemClock }),
      generator: scriptGenerator({
        command: [config.RECORDINGS_PYTHON, '-I', GENERATE_SCRIPT],
        modelDir: config.RECORDINGS_MODEL_DIR,
      }),
      editions: readEditions(config.EDITIONS_DIR),
    }).run();
    console.log(
      `recordings: ${String(counts.recorded)} Words recorded, ${String(counts.failed)} failed, ` +
        `${String(counts.deleted)} retired files deleted`,
    );
    return 0;
  } catch (error) {
    console.error(`recordings failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
