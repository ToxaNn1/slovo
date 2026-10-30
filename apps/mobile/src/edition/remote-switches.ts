import { openRemoteSwitches, systemRandom, type Edition, type TrackedUserState } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { apiClient } from '../api';
import { logError } from '../diagnostics/log';
import { openOnce, useOpened, useSubscribed, type Opening } from '../opening';
import { useShell, type EditionSwitches } from '../shell-value';
import { edition } from './edition';
import { createSwitchesApi } from './switches-api';

/**
 * The remote Feature Switches (ADR 0040), opened once per app run over the
 * user state with the answer the device kept, before the Language Pack and
 * the composition, which open over the Edition they give. The lifecycle asks
 * the backend at launch and on each return to the foreground.
 */
export function remoteSwitchesOpening({
  userState,
}: {
  userState: Opening<TrackedUserState>;
}): Opening<EditionSwitches> {
  return openOnce(
    async () =>
      openRemoteSwitches({
        edition,
        api: createSwitchesApi({ client: apiClient, editionId: edition.id }),
        userState: await userState.opened(),
        schedule: systemSchedule,
        random: systemRandom,
      }),
    {
      onError(error) {
        logError('Could not open the remote Feature Switches', error);
      },
    },
  );
}

/**
 * The Edition as the app runs it, each Feature Switch at its effective value,
 * for a screen drawn under the gate of the Language Pack, which opens after
 * the remote switches. The screen draws again when an effective value changes.
 */
export function useEditionInEffect(): Edition {
  return useSubscribed(useOpened(useShell().remoteSwitches), ({ edition }) => edition);
}
