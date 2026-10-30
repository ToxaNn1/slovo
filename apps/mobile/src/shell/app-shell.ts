import { accountOpening } from '../account/device-account';
import { counterReadsOpening } from '../community-counters/device-counter-reads';
import { counterSendingOpening } from '../community-counters/device-counter-sending';
import { compositionOpening } from '../composition';
import { languagePackOpening } from '../content-update/language-pack';
import { remoteSwitchesOpening } from '../edition/remote-switches';
import { mistakeReportsOpening } from '../mistake-reports/device-mistake-reports';
import { settingsOpening } from '../settings/settings';
import { shareCardOnDevice } from '../share/device-share';
import { syncOpening } from '../sync/device-sync';
import { storedUserStateOpening } from '../user-state/stored-user-state';
import type { Shell } from '../shell-value';

/**
 * The Shell of the device: every opening over the one user state, in the
 * order they wait for each other. Nothing opens until something reads it.
 * The Account and Sync open apart from the composition (ADR 0037).
 */
export function createShell(): Shell {
  const userState = storedUserStateOpening();
  const remoteSwitches = remoteSwitchesOpening({ userState });
  const languagePack = languagePackOpening({ remoteSwitches, userState });
  const account = accountOpening({ userState });
  return {
    userState,
    settings: settingsOpening({ userState }),
    remoteSwitches,
    languagePack,
    composition: compositionOpening({ languagePack, remoteSwitches, userState }),
    account,
    sync: syncOpening({ userState, remoteSwitches, account }),
    mistakeReports: mistakeReportsOpening({ userState, remoteSwitches, languagePack }),
    counterReads: counterReadsOpening({ userState, remoteSwitches }),
    counterSending: counterSendingOpening({ userState, remoteSwitches }),
    shareCard: shareCardOnDevice,
  };
}

/**
 * The one Shell of the app run. The root layout hands it to every screen
 * (`ShellProvider`); the links from outside the app, which Expo Router
 * resolves outside React, read it here.
 */
export const appShell = createShell();
