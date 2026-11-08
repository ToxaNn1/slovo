import {
  openCounterReads,
  openCounterSending,
  openMistakeReports,
  openRemoteSwitches,
  openSync,
  readInstallId,
  systemRandom,
  type Edition,
} from '@slovo/core';
import { systemSchedule } from '@slovo/ui';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

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

/** Opens `open` over what `base` opened, on its first read, once per app run; a failure is logged as `failure`. */
function over<S, T>(
  base: Opening<S>,
  failure: string,
  open: (opened: S) => Promise<T> | T,
): Opening<T> {
  return openOnce(async () => open(await base.opened()), {
    onError(error) {
      logError(failure, error);
    },
  });
}

/**
 * The Shell of the device for one Edition: every opening over that
 * Edition's user state, in the order they wait for each other. Nothing opens
 * until something reads it. The remote Feature Switches open over the
 * answer the device kept (ADR 0040); every other opening opens over the one
 * set of device ports, which waits for the user state alone. Their Edition
 * in effect takes the remote switches once they are open, and the Edition's
 * own until then or when they fail, so a slow or failed answer holds nothing
 * back. The Account and Sync open apart from the composition (ADR 0037);
 * Sync, Mistake Reports and the Community Counters apart from it too, and
 * nothing waits for them.
 */
export function createShell(
  editionId: string,
  sources: DeviceSources = deviceSources(editionId),
): Shell {
  const { userState } = sources;
  const remoteSwitches = over(
    userState,
    'Could not open the remote Feature Switches',
    async (opened) => {
      const installId = await readInstallId({ userState: opened, random: sources.random });
      return openRemoteSwitches({
        ...sources,
        edition,
        states: edition.featureSwitches,
        // The reader the Rules target, read afresh each time the verdicts are worked out.
        facts: () => ({
          appVersion: Constants.expoConfig?.version ?? '',
          platform: Platform.OS === 'android' ? 'android' : 'ios',
          region: getLocales().at(0)?.regionCode ?? undefined,
          signedIn:
            account?.state.status === 'ready' && account.state.value.state.status === 'signed-in',
          installId,
        }),
        userState: opened,
      });
    },
  );
  // One Edition whose every read of a switch takes the remote ones as they stand.
  const editionInEffect: Edition = {
    ...edition,
    isFeatureEnabled(feature) {
      const switches = remoteSwitches.state;
      return (switches.status === 'ready' ? switches.value.edition : edition).isFeatureEnabled(
        feature,
      );
    },
  };
  const ports = openOnce<DevicePorts>(
    async () => ({ ...sources, userState: await userState.opened(), edition: editionInEffect }),
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
