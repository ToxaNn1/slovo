import { openCounterReads } from '@slovo/core';

import { anonymousApiClientOf } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import { remoteSwitchesOpening } from '../edition/remote-switches';
import { logError } from '../diagnostics/log';
import { openOnce } from '../opening';
import { storedUserState } from '../user-state/stored-user-state';
import { createCountersApi } from './counters-api';

/**
 * The reads of the Community Counters (ADR 0060), opened once per app run
 * apart from the composition, over the same user state the Knowledge Marks
 * and Favorites write their unsent changes to. They read the Edition in
 * effect each time, so a remote switch takes the line away.
 */
export const counterReadsOpening = openOnce(
  async () => {
    const switches = await remoteSwitchesOpening.opened();
    return openCounterReads({
      edition: { isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature) },
      api: createCountersApi({ clientOf: anonymousApiClientOf, editionId: edition.id }),
      userState: await storedUserState.opened(),
      clock: deviceClock,
    });
  },
  {
    onError(error) {
      logError('Could not open the Community Counters', error);
    },
  },
);
