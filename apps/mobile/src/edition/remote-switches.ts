import { openRemoteSwitches, systemRandom, type Edition } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { apiClient } from '../api';
import { logError } from '../diagnostics/log';
import { openOnce, useOpened, useSubscribed } from '../opening';
import { storedUserState } from '../user-state/stored-user-state';
import { edition } from './edition';
import { createSwitchesApi } from './switches-api';

/**
 * The remote Feature Switches (ADR 0040), opened once per app run over the
 * user state with the answer the device kept, before the Language Pack and
 * the composition, which open over the Edition they give. The lifecycle asks
 * the backend at launch and on each return to the foreground.
 */
export const remoteSwitchesOpening = openOnce(
  async () =>
    openRemoteSwitches({
      edition,
      api: createSwitchesApi({ client: apiClient, editionId: edition.id }),
      userState: await storedUserState.opened(),
      schedule: systemSchedule,
      random: systemRandom,
    }),
  {
    onError(error) {
      logError('Could not open the remote Feature Switches', error);
    },
  },
);

/**
 * The Edition as the app runs it, each Feature Switch at its effective value,
 * for a screen drawn under the gate of the Language Pack, which opens after
 * the remote switches. The screen draws again when an effective value changes.
 */
export function useEditionInEffect(): Edition {
  return useSubscribed(useOpened(remoteSwitchesOpening), ({ edition }) => edition);
}

/** Whether the App Intents are on in effect, by the remote Feature Switches the app knows (ADR 0057). */
export async function appIntentsOn(): Promise<boolean> {
  return (await remoteSwitchesOpening.opened()).edition.isFeatureEnabled('appIntents');
}
