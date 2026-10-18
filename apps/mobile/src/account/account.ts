import type { Account, AccountState } from '@slovo/core';
import { useEdition } from '@slovo/ui';

import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useSubscribed, type Opening, type Source } from '../opening';
import { accountOpening } from './device-account';
import { accountProblemLine, accountSummary } from './account-texts';

/**
 * The opening of the Account while its switch is on in effect, so its row and
 * its screen go when it is turned off remotely; undefined then, and when the
 * Edition has no Account. The Session stays kept either way (ADR 0040).
 */
export function useAccountInEffect(): Opening<Account> | undefined {
  return useEditionInEffect().isFeatureEnabled('account') ? accountOpening : undefined;
}

/** The Account as it stands, or undefined while it opens or when it failed to. */
function useAccountStateOf(opening: Opening<Account>): AccountState | undefined {
  const opened = useSubscribed(opening, ({ state }) => state);
  const account = opened.status === 'ready' ? opened.value : undefined;
  // Until the Account is open, the opening stands in as the source, and there is no state.
  return useSubscribed<Source, AccountState | undefined>(account ?? opening, () => account?.state);
}

/** The value of the «SLOVO ID» row of Settings: «Увійти» or the email, nothing while it opens. */
export function useAccountSummary(opening: Opening<Account>): string | undefined {
  return accountSummary(useAccountStateOf(opening), editionStrings.account);
}

/** The Account of the SLOVO ID screen, drawn under its opening's gate, as it stands. */
export function useAccountState(account: Account): AccountState {
  return useSubscribed(account, ({ state }) => state);
}

/** The line under the field of the SLOVO ID screen for the last request's problem, if any. */
export function useAccountProblemLine(state: AccountState): string | undefined {
  const { count } = useEdition();
  return accountProblemLine({ state, strings: editionStrings.account, count });
}
