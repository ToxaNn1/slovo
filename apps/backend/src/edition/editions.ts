import { createEditionRegistry, type Clock, type Edition } from '@slovo/server-core';

import type { Database } from '../database/database';
import { createRemoteSwitchStore } from './remote-switch-store';

/**
 * The server Core's Edition registry over the Editions read from their
 * folders and the remote switches kept in the database: the one the app,
 * the publish command and the switch commands build.
 */
export function createEditions({
  database,
  clock,
  editions,
}: {
  database: Database;
  clock: Clock;
  editions: readonly Edition[];
}) {
  return createEditionRegistry({ editions, switchStore: createRemoteSwitchStore(database), clock });
}
