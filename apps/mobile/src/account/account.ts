import type { Account, AccountState, Edition } from '@slovo/core';
import { useEdition } from '@slovo/ui';

import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useSubscribed, type Opening, type Source } from '../opening';
import { useShell } from '../shell-value';
import { googleClientId, hasAppleSignIn } from './device-account';
import { accountProblemLine, accountSummary } from './account-texts';

/**
 * The opening of the Account while its switch is on in effect, so its row and
 * its screen go when it is turned off remotely; undefined then, and when the
 * Edition has no Account. The Session stays kept either way (ADR 0040).
 */
export function useAccountInEffect(): Opening<Account> | undefined {
  const { account } = useShell();
  return useEditionInEffect().isFeatureEnabled('account') ? account : undefined;
}

/**
 * What the SLOVO ID screen offers the Google and the Apple sign-in by: the
 * Edition's switches in effect and what the build has (ADR 0047).
 */
export interface AccountScreenSignIn {
  /** The Edition as the app runs it, its `googleSignIn` and `signInWithApple` switches at their effective values. */
  readonly edition: Edition;
  /** The build's Google client id, if it has one; «Увійти через Google» shows only with one. */
  readonly googleClientId: string | undefined;
  /** Whether the binary has Expo's Apple authentication module; «Увійти через Apple» shows only with it, on iOS. */
  readonly appleModule: boolean;
}

/** What the SLOVO ID screen offers the Google and the Apple sign-in by on this device. */
export function useAccountScreenSignIn(): AccountScreenSignIn {
  return { edition: useEditionInEffect(), googleClientId, appleModule: hasAppleSignIn };
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
