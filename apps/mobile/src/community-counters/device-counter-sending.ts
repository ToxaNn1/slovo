import { openCounterSending, systemRandom, type TrackedUserState } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { backend } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import type { CounterSending, EditionSwitches } from '../shell-value';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';

/**
 * The sending of the Community Counters (ADR 0060), opened once per app run
 * apart from the composition, like their reads, over the same user state the
 * Knowledge Marks and Favorites write their unsent changes to. It reads the
 * Edition in effect each time, so a remote switch stops it.
 */
export function counterSendingOpening({
  userState,
  remoteSwitches,
}: {
  userState: Opening<TrackedUserState>;
  remoteSwitches: Opening<EditionSwitches>;
}): Opening<CounterSending> {
  return openOnce(
    async () => {
      const switches = await remoteSwitches.opened();
      return openCounterSending({
        edition: {
          id: edition.id,
          isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature),
        },
        backend,
        userState: await userState.opened(),
        clock: deviceClock,
        schedule: systemSchedule,
        random: systemRandom,
      });
    },
    {
      onError(error) {
        logError('Could not open the sending of the Community Counters', error);
      },
    },
  );
}
