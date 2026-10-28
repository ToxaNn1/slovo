import { openCounterSending, systemRandom } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { anonymousApiClientOf } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import { remoteSwitchesOpening } from '../edition/remote-switches';
import { logError } from '../diagnostics/log';
import { openOnce } from '../opening';
import { storedUserState } from '../user-state/stored-user-state';
import { createCountersApi } from './counters-api';

/**
 * The sending of the Community Counters (ADR 0060), opened once per app run
 * apart from the composition, like their reads, over the same user state the
 * Knowledge Marks and Favorites write their unsent changes to. It reads the
 * Edition in effect each time, so a remote switch stops it.
 */
export const counterSendingOpening = openOnce(
  async () => {
    const switches = await remoteSwitchesOpening.opened();
    return openCounterSending({
      edition: { isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature) },
      api: createCountersApi({ clientOf: anonymousApiClientOf, editionId: edition.id }),
      userState: await storedUserState.opened(),
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
