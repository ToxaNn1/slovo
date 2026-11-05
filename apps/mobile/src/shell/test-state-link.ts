import { reloadAppAsync } from 'expo';
import { openDatabaseAsync } from 'expo-sqlite';

import { deviceClock } from '../device/device-clock';
import { logError, logWarning } from '../diagnostics/log';
import { activeEditionId } from '../edition/edition';
import { appShell } from './app-shell';
import { userStateDatabaseName } from '../user-state/stored-user-state';
import {
  loadTestState,
  testStateNames,
  testStateOf,
  type TestStateName,
} from '../user-state/test-states';
import { openSqliteUserState } from '../user-state/user-state-sqlite';

// Development tooling only (spec #1551): `+native-intent.tsx` imports this
// module inside a `__DEV__` branch, so a production bundle holds none of it.

/** Replaces the active Edition's stored user state with the named one and reloads the app. */
async function load(name: TestStateName): Promise<void> {
  const { reader } = await appShell.languagePack.opened();
  const { edition } = await appShell.remoteSwitches.opened();
  const port = await openSqliteUserState(
    await openDatabaseAsync(userStateDatabaseName(activeEditionId)),
  );
  await loadTestState(name, port, {
    clock: deviceClock,
    edition,
    content: reader,
    crossword: reader,
  });
  await reloadAppAsync(`test state ${name}`);
}

/**
 * Handles a test state link: loads the state and reloads the app, or warns
 * with the names on offer. Gives the path to open meanwhile, the Feed, or
 * nothing for a link that is no test state link.
 */
export function openTestStateLink(path: string): string | undefined {
  const named = testStateOf(path);
  if (named === undefined) return undefined;
  if (named === 'unknown') {
    logWarning('No such test state', `Test states: ${testStateNames.join(', ')}`);
    return '/';
  }
  load(named.name).catch((error: unknown) => {
    logError(`Could not load the test state ${named.name}`, error);
  });
  return '/';
}
