// `pnpm collection-links delete <id>`: deletes the Collection Link of the id
// from the database DATABASE_URL names, so the owner can take down an abusive
// name (ADR 0058). No API route deletes links.
import { MigrateConfigSchema, readConfig } from '../config';
import { createDatabase } from '../database/database';
import { createLogger } from '../logger';
import { deleteCollectionLink } from './collection-link-delete';

const USAGE = 'Usage: pnpm collection-links delete <link-id>';

async function main(): Promise<number> {
  const [command, id, ...rest] = process.argv.slice(2);
  if (command !== 'delete' || id === undefined || rest.length > 0) {
    console.error(USAGE);
    return 2;
  }
  const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
  const database = createDatabase(DATABASE_URL, createLogger());
  try {
    const { exitCode, line } = await deleteCollectionLink(database, id);
    (exitCode === 0 ? console.log : console.error)(line);
    return exitCode;
  } finally {
    await database.close();
  }
}

process.exitCode = await main();
