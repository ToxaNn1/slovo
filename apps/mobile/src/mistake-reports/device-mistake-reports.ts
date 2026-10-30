import {
  openMistakeReports,
  systemRandom,
  type MistakeReports,
  type TrackedUserState,
} from '@slovo/core';
import type { PackReader } from '@slovo/language-pack/reader';
import { systemSchedule } from '@slovo/ui';
import Constants from 'expo-constants';

import { anonymousApiClientOf } from '../api';
import type { LaunchPack } from '../content-update/launch-pack';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import type { EditionSwitches } from '../shell-value';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';
import { createReportsApi } from './reports-api';

/**
 * Mistake Reports (ADR 0056), opened once per app run apart from the
 * composition, like Sync; nothing waits for them. Each report carries the
 * app version the build declares and the content version of the Language
 * Pack the app run opened. They read the Edition in effect each time they
 * act, so a remote switch stops them.
 */
export function mistakeReportsOpening({
  userState,
  remoteSwitches,
  languagePack,
}: {
  userState: Opening<TrackedUserState>;
  remoteSwitches: Opening<EditionSwitches>;
  languagePack: Opening<LaunchPack<PackReader>>;
}): Opening<MistakeReports> {
  return openOnce(
    async () => {
      const switches = await remoteSwitches.opened();
      return openMistakeReports({
        userState: await userState.opened(),
        api: createReportsApi({ clientOf: anonymousApiClientOf }),
        edition: {
          id: edition.id,
          isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature),
        },
        appVersion: Constants.expoConfig?.version ?? '',
        contentVersion: (await languagePack.opened()).version.contentVersion,
        clock: deviceClock,
        schedule: systemSchedule,
        random: systemRandom,
      });
    },
    {
      onError(error) {
        logError('Could not open Mistake Reports', error);
      },
    },
  );
}
