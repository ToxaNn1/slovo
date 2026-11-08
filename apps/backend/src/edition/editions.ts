import { createEditionRegistry, type Alerts, type Clock, type Edition } from '@slovo/server-core';

import { createAdminStore } from '../admin/admin-store';
import type { Database } from '../database/database';
import { createSwitchRuleStore } from './switch-rule-store';

/**
 * The server Core's Edition registry over the Editions read from their
 * folders and the Rules kept in the database, logging each write of them to
 * the Action log: the one the app, the publish command and the switches
 * command build.
 */
export function createEditions({
  database,
  clock,
  editions,
  alerts,
}: {
  database: Database;
  clock: Clock;
  editions: readonly Edition[];
  alerts: Alerts;
}) {
  const adminStore = createAdminStore(database);
  return createEditionRegistry({
    editions,
    switchStore: createSwitchRuleStore(database),
    clock,
    log: (entry) => adminStore.appendAction({ ...entry, at: clock.now() }),
    alerts,
  });
}
