import type { Account, AccountState } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { editionStrings } from '../edition/edition';
import { useSubscribed, type Opening, type Source } from '../opening';
import { accountProblemLine, accountSummary } from './account-texts';

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
  return useMemo(
    () => accountProblemLine({ state, strings: editionStrings.account, count }),
    [state, count],
  );
}
