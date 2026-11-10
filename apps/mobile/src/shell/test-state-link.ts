import { reloadAppAsync } from 'expo';
import { openDatabaseAsync } from 'expo-sqlite';

import { deviceClock } from '../device/device-clock';
import { logError, logWarning } from '../diagnostics/log';
import { activeEditionId } from '../edition/edition';
import { appShell } from './app-shell';
import { userStateDatabaseName } from '../user-state/stored-user-state';
import {
  loadTestState,
  reopenedByTestState,
  testStateNames,
  testStateOf,
  type TestStateName,
} from '../user-state/test-states';
import { openSqliteUserState } from '../user-state/user-state-sqlite';

// Development tooling only (spec #1551): `+native-intent.tsx` imports this
// module inside a `__DEV__` branch, so a production bundle holds none of it.

/**
 * The active Edition's stored user state, on a connection of its own that
 * waits while the app's connection writes, rather than failing.
 */
async function storedUserState() {
  const db = await openDatabaseAsync(userStateDatabaseName(activeEditionId));
  await db.execAsync('PRAGMA busy_timeout = 5000');
  return openSqliteUserState(db);
}

/** Replaces the active Edition's stored user state with the named one and reloads the app. */
async function load(name: TestStateName): Promise<void> {
  const { reader } = await appShell.languagePack.opened();
  const { edition } = await appShell.remoteSwitches.opened();
  await loadTestState(name, await storedUserState(), {
    clock: deviceClock,
    edition,
    content: reader,
  });
  await reloadAppAsync(`test state ${name}`);
}

/**
 * Loads the named state, unless the link is the one the app reopens with
 * after the reload a load asked for: that one has loaded already.
 */
async function open(name: TestStateName, initial: boolean): Promise<void> {
  // The app's own connection writes as it opens; this one waits for it.
  await appShell.composition.opened();
  if (initial && (await reopenedByTestState(await storedUserState()))) return;
  await load(name);
}

/**
 * Handles a test state link: loads the state and reloads the app, or warns
 * with the names on offer. Gives the path to open meanwhile, the Feed, or
 * nothing for a link that is no test state link.
 */
export function openTestStateLink(link: { path: string; initial: boolean }): string | undefined {
  const named = testStateOf(link.path);
  if (named === undefined) return undefined;
  if (named === 'unknown') {
    logWarning('No such test state', `Test states: ${testStateNames.join(', ')}`);
    return '/';
  }
  open(named.name, link.initial).catch((error: unknown) => {
    logError(`Could not load the test state ${named.name}`, error);
  });
  return '/';
}
