import {
  openSync,
  systemRandom,
  type Account,
  type Sync,
  type TrackedUserState,
} from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { apiClientOf } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import type { EditionSwitches } from '../shell-value';
import { logError } from '../diagnostics/log';
import { openOnce, type Opening } from '../opening';
import { createSyncApi } from './sync-api';

/**
 * The Sync module (spec #378), opened once per app run apart from the
 * composition and the Account it follows (ADR 0036, 0037); nothing waits for
 * it. It reads the Edition in effect each time it acts, so a remote switch
 * stops it. Undefined when the Edition has no Account or no Sync.
 */
export function syncOpening({
  userState,
  remoteSwitches,
  account,
}: {
  userState: Opening<TrackedUserState>;
  remoteSwitches: Opening<EditionSwitches>;
  account: Opening<Account> | undefined;
}): Opening<Sync> | undefined {
  if (account === undefined || !edition.isFeatureEnabled('sync')) return undefined;
  return openOnce(
    async () => {
      const switches = await remoteSwitches.opened();
      return openSync({
        userState: await userState.opened(),
        api: createSyncApi({ clientOf: apiClientOf, editionId: edition.id }),
        account: await account.opened(),
        edition: { isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature) },
        clock: deviceClock,
        schedule: systemSchedule,
        random: systemRandom,
      });
    },
    {
      onError(error) {
        logError('Could not open Sync', error);
      },
    },
  );
}
