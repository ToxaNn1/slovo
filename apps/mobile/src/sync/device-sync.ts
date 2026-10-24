import { openSync, systemRandom, type Account, type Sync } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';

import { accountOpening } from '../account/device-account';
import { apiClientOf } from '../api';
import { deviceClock } from '../device/device-clock';
import { edition } from '../edition/edition';
import { remoteSwitchesOpening } from '../edition/remote-switches';
import { logError } from '../log';
import { openOnce, type Opening } from '../opening';
import { storedUserState } from '../user-state/stored-user-state';
import { createSyncApi } from './sync-api';

async function openOver(accountOpened: Opening<Account>): Promise<Sync> {
  const switches = await remoteSwitchesOpening.opened();
  return openSync({
    userState: await storedUserState.opened(),
    api: createSyncApi({ clientOf: apiClientOf, editionId: edition.id }),
    account: await accountOpened.opened(),
    edition: { isFeatureEnabled: (feature) => switches.edition.isFeatureEnabled(feature) },
    clock: deviceClock,
    schedule: systemSchedule,
    random: systemRandom,
  });
}

/**
 * The Sync module (spec #378), opened once per app run apart from the
 * composition and the Account it follows (ADR 0036, 0037); nothing waits for
 * it. It reads the Edition in effect each time it acts, so a remote switch
 * stops it. Undefined when the Edition has no Account or no Sync.
 */
export const syncOpening: Opening<Sync> | undefined = openSyncApart(accountOpening);

function openSyncApart(account: Opening<Account> | undefined): Opening<Sync> | undefined {
  if (account === undefined || !edition.isFeatureEnabled('sync')) return undefined;
  return openOnce(() => openOver(account), {
    onError(error) {
      logError('Could not open Sync', error);
    },
  });
}
