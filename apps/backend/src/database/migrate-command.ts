// `pnpm db:migrate`: runs the migrations on the database DATABASE_URL names.
// The server never migrates at start.
import { MigrateConfigSchema, readConfig } from '../config';
import { createLogger } from '../logger';
import { migrateDatabase } from './migrate';

const { DATABASE_URL } = readConfig(MigrateConfigSchema, process.env);
const logger = createLogger();
await migrateDatabase(DATABASE_URL, logger);
logger.info('migrated');
