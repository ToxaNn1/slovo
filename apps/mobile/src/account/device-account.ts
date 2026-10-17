import { openAccount, systemRandom, type Account } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { apiClient, apiClientOf } from '../api';
import { deviceClock } from '../device/device-clock';
import { nativeModules } from '../device/device-native-modules';
import { edition } from '../edition/edition';
import { openOnce, type Opening } from '../opening';
import { createAccountApi } from './account-api';
import { createSessionStore } from './session-store';

/**
 * `expo-secure-store`, or undefined while the installed binary lacks it (a dev
 * client built before the 0.7 batch). It is required here and nowhere else:
 * a static import would stop the app at start.
 */
const keychain = nativeModules.load(
  'keychain',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-secure-store') as typeof import('expo-secure-store'),
);

/**
 * The reader's Account («SLOVO ID»), opened once per app run apart from the
 * composition (ADR 0036, 0037), or undefined when the Edition's `account`
 * switch is off. Its Session is in the Keychain, or in memory while the
 * binary lacks it. When the Keychain can't be read, the opening fails with a
 * retry, so a Session kept there is never shadowed by one in memory.
 */
export const accountOpening: Opening<Account> | undefined = edition.isFeatureEnabled('account')
  ? openOnce(
      () =>
        openAccount({
          api: createAccountApi({
            client: apiClient,
            clientOf: apiClientOf,
            editionId: edition.id,
          }),
          sessions: createSessionStore(keychain),
          clock: deviceClock,
          schedule: systemSchedule,
          random: systemRandom,
        }),
      {
        onError(error) {
          console.error('Could not read the Session', error);
        },
      },
    )
  : undefined;
