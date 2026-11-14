import type { EditionStrings, Plural } from '@slovo/contracts';
import type { AccountState } from '@slovo/core';

type AccountStrings = EditionStrings['account'];

/** What the Account row of Settings says: its line and the value beside its chevron. */
export interface AccountRowSummary {
  readonly subtitle: string | undefined;
  readonly value: string | undefined;
}

/**
 * The Account row of Settings (board 11, screen 83): «Без входу» while signed
 * out; «Слова синхронізуються» and the email once signed in; nothing while
 * the Account opens.
 */
export function accountSummary(
  state: AccountState | undefined,
  strings: EditionStrings['settings']['rowSubtitles'],
): AccountRowSummary {
  if (state === undefined) return { subtitle: undefined, value: undefined };
  return state.status === 'signed-in'
    ? { subtitle: strings.signedIn, value: state.email }
    : { subtitle: strings.signedOut, value: undefined };
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
  if (state.problem === undefined) return undefined;
  if (state.problem !== 'wrong-code') return strings.problems[state.problem];
  // A wrong code always comes with its tries left (ADR 0037).
  return count(strings.problems['wrong-code'], state.triesLeft ?? 0);
}
