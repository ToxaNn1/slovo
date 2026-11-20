import { reloadAppAsync } from 'expo';
import { openDatabaseAsync } from 'expo-sqlite';

import { deviceClock, shiftDeviceClock } from '../device/device-clock';
import { logError, logWarning } from '../diagnostics/log';
import { activeEditionId } from '../edition/edition';
import { appShell } from './app-shell';
import { userStateDatabaseName } from '../user-state/stored-user-state';
import {
  dayShiftOf,
  loadTestState,
  reopenedByTestState,
  testStateNames,
  testStateOf,
  type TestProfileName,
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
 * Loads a test profile of «Тестовий профіль» and reloads the app, for a guest
 * alone: a signed-in reader's Sync would send the profile to the Account, so
 * it refuses while signed in and loads nothing.
 */
export async function loadTestProfile(name: TestProfileName): Promise<void> {
  await appShell.composition.opened();
  const account = await appShell.account?.opened();
  if (account?.state.status === 'signed-in') {
    throw new Error('A test profile is for a guest alone: sign out first.');
  }
  await load(name);
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
 * Shifts the device clock to the link's `?day=`, from the system time, or
 * takes any shift back when the link has none (#1859). Runs on the link the
 * app reopens with too, so the shift outlasts the reload.
 */
function shiftToDayOf(link: string): void {
  shiftDeviceClock(0);
  const shift = dayShiftOf(link, deviceClock);
  if (shift === 'unknown') {
    logWarning('No such day', 'Days: ?day=<weekday>, such as monday, or ?day=<YYYY-MM-DD>');
  } else if (shift !== undefined) {
    shiftDeviceClock(shift.shift);
  }
}

/**
 * Handles a test state link: shifts the day to its `?day=`, then loads the
 * state and reloads the app, or warns with the names on offer. Gives the path to open meanwhile, the Feed, or
 * nothing for a link that is no test state link.
 */
export function openTestStateLink(link: { path: string; initial: boolean }): string | undefined {
  const named = testStateOf(link.path);
  if (named === undefined) return undefined;
  shiftToDayOf(link.path);
  if (named === 'unknown') {
    logWarning('No such test state', `Test states: ${testStateNames.join(', ')}`);
    return '/';
  }
  open(named.name, link.initial).catch((error: unknown) => {
    logError(`Could not load the test state ${named.name}`, error);
  });
  return '/';
}
