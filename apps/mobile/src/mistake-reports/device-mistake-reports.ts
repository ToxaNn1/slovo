import { openMistakeReports, systemRandom } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';
import Constants from 'expo-constants';

import { anonymousApiClientOf } from '../api';
import { languagePackOpening } from '../content-update/language-pack';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import { remoteSwitchesOpening } from '../edition/remote-switches';
import { logError } from '../diagnostics/log';
import { openOnce } from '../opening';
import { storedUserState } from '../user-state/stored-user-state';
import { createReportsApi } from './reports-api';

/**
 * Mistake Reports (ADR 0056), opened once per app run apart from the
 * composition, like Sync; nothing waits for them. Each report carries the
 * app version the build declares and the content version of the Language
 * Pack the app run opened. They read the Edition in effect each time they
 * act, so a remote switch stops them.
 */
export const mistakeReportsOpening = openOnce(
  async () => {
    const switches = await remoteSwitchesOpening.opened();
    return openMistakeReports({
      userState: await storedUserState.opened(),
      api: createReportsApi({ clientOf: anonymousApiClientOf }),
      edition: {
        id: edition.id,
        isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature),
      },
      appVersion: Constants.expoConfig?.version ?? '',
      contentVersion: (await languagePackOpening.opened()).version.contentVersion,
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
