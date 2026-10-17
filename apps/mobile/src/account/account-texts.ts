import type { EditionStrings, Plural } from '@slovo/contracts';
import type { AccountState } from '@slovo/core';

type AccountStrings = EditionStrings['account'];

/**
 * The value of the «SLOVO ID» row of Settings: «Увійти», or the email once
 * signed in; nothing while the Account opens.
 */
export function accountSummary(
  state: AccountState | undefined,
  strings: AccountStrings,
): string | undefined {
  if (state === undefined) return undefined;
  return state.status === 'signed-in' ? state.email : strings.signedOut;
}

/** The line under the field of the SLOVO ID screen for the last request's problem, if any. */
export function accountProblemLine({
  state,
  strings,
  count,
}: {
  state: AccountState;
  strings: AccountStrings;
  count: (forms: Plural, count: number) => string;
}): string | undefined {
  const { problem } = state;
  if (problem === undefined) return undefined;
  if (problem !== 'wrong-code') return strings.problems[problem];
  // A wrong code always comes with its tries left (ADR 0037).
  const triesLeft = state.status === 'code-sent' ? (state.triesLeft ?? 0) : 0;
  return count(strings.problems['wrong-code'], triesLeft);
}
