import {
  openCounterReads,
  openCounterSending,
  openMistakeReports,
  openRemoteSwitches,
  openSync,
  systemRandom,
} from '@slovo/core';
import { systemSchedule } from '@slovo/ui';
import Constants from 'expo-constants';

import { openDeviceAccount } from '../account/device-account';
import { backend } from '../api';
import { compositionOpening } from '../composition';
import { languagePackOpening } from '../content-update/language-pack';
import { deviceClock } from '../device/device-clock';
import { logError } from '../diagnostics/log';
import { activeEditionId, edition } from '../edition/edition';
import { openOnce, type Opening } from '../opening';
import { settingsOpening } from '../settings/settings';
import { shareCardOnDevice } from '../share/device-share';
import { storedUserStateOpening } from '../user-state/stored-user-state';
import type { DevicePorts, DeviceSources, Shell } from '../shell-value';

/** The device's own sources for an Edition: its backend, clock, schedule, randomness and stored user state. */
function deviceSources(editionId: string): DeviceSources {
  return {
    backend,
    clock: deviceClock,
    schedule: systemSchedule,
    random: systemRandom,
    userState: storedUserStateOpening(editionId),
  };
}

/** Opens `open` over the device ports on its first read, once per app run; a failure is logged as `failure`. */
function over<T>(
  ports: Opening<DevicePorts>,
  failure: string,
  open: (ports: DevicePorts) => Promise<T> | T,
): Opening<T> {
  return openOnce(async () => open(await ports.opened()), {
    onError(error) {
      logError(failure, error);
    },
  });
}

/**
 * The Shell of the device for one Edition: every opening over that
 * Edition's user state, in the order they wait for each other. Nothing opens
 * until something reads it. The remote Feature Switches open first, over the
 * answer the device kept (ADR 0040); every other opening opens over the one
 * set of device ports, the Edition in effect among them, so a remote switch
 * reaches each. The Account and Sync open apart from the composition (ADR
 * 0037); Sync, Mistake Reports and the Community Counters apart from it too,
 * and nothing waits for them.
 */
export function createShell(
  editionId: string,
  sources: DeviceSources = deviceSources(editionId),
): Shell {
  const { userState } = sources;
  const remoteSwitches = openOnce(
    async () => openRemoteSwitches({ ...sources, edition, userState: await userState.opened() }),
    {
      onError(error) {
        logError('Could not open the remote Feature Switches', error);
      },
    },
  );
  const ports = openOnce<DevicePorts>(
    async () => {
      const [opened, switches] = await Promise.all([userState.opened(), remoteSwitches.opened()]);
      return {
        ...sources,
        userState: opened,
        get edition() {
          return switches.edition;
        },
      };
    },
    // The opening that failed under it has logged why.
    { onError: () => undefined },
  );
  const languagePack = languagePackOpening({ remoteSwitches, userState });
  const account = edition.isFeatureEnabled('account')
    ? over(ports, 'Could not read the Session', openDeviceAccount)
    : undefined;
  return {
    userState,
    settings: settingsOpening({ userState }),
    remoteSwitches,
    languagePack,
    composition: compositionOpening({ languagePack, ports, account }),
    account,
    sync:
      account === undefined || !edition.isFeatureEnabled('sync')
        ? undefined
        : over(ports, 'Could not open Sync', async (opened) =>
            openSync({ ...opened, account: await account.opened() }),
          ),
    // Each report carries the app version the build declares and the content version of the Language Pack.
    mistakeReports: over(ports, 'Could not open Mistake Reports', async (opened) =>
      openMistakeReports({
        ...opened,
        appVersion: Constants.expoConfig?.version ?? '',
        contentVersion: (await languagePack.opened()).version.contentVersion,
      }),
    ),
    counterReads: over(ports, 'Could not open the Community Counters', openCounterReads),
    counterSending: over(
      ports,
      'Could not open the sending of the Community Counters',
      openCounterSending,
    ),
    shareCard: shareCardOnDevice,
  };
}

/**
 * The one Shell of the app run, for the Edition chosen at launch (ADR 0065). The root layout hands it to every screen
 * (`ShellProvider`); the links from outside the app, which Expo Router
 * resolves outside React, read it here.
 */
export const appShell = createShell(activeEditionId);
