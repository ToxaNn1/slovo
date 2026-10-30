import { openCounterReads, type CounterReads, type TrackedUserState } from '@slovo/core';

import { backend } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import type { EditionSwitches } from '../shell-value';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';

/**
 * The reads of the Community Counters (ADR 0060), opened once per app run
 * apart from the composition, over the same user state the Knowledge Marks
 * and Favorites write their unsent changes to. They read the Edition in
 * effect each time, so a remote switch takes the line away.
 */
export function counterReadsOpening({
  userState,
  remoteSwitches,
}: {
  userState: Opening<TrackedUserState>;
  remoteSwitches: Opening<EditionSwitches>;
}): Opening<CounterReads> {
  return openOnce(
    async () => {
      const switches = await remoteSwitches.opened();
      return openCounterReads({
        edition: {
          id: edition.id,
          isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature),
        },
        backend,
        userState: await userState.opened(),
        clock: deviceClock,
      });
    },
    {
      onError(error) {
        logError('Could not open the Community Counters', error);
      },
    },
  );
}
