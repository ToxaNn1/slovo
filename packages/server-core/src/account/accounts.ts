import { ACCOUNT_NAME, fill } from '@slovo/contracts';
import { z } from 'zod';

import type { EditionRegistry } from '../edition/edition-registry';
import type { AccountRecord, Authenticator, Clock, CodeCheck, Mailer, RateLimits } from '../ports';
import { createSignInLimits, type TooManyRequests } from './sign-in-limits';

/** What an email that is not an email gets. */
interface InvalidEmail {
  readonly ok: false;
  readonly reason: 'invalid-email';
}

/** What a token that carries no Session that is on gets. */
interface Unauthorized {
  readonly ok: false;
  readonly reason: 'unauthorized';
}

/** What an action of a Session gets: done, or no Session to act. */
type Ended = { readonly ok: true } | Unauthorized;

/**
 * The Account rules of the backend: Sign-in codes and Sessions. A Session
 * acts only on its own Account: the rules take a token and find the Account
 * from it, never from what a request names.
 */
export interface Accounts {
  /**
   * Sends a new Sign-in code to the email in the language of the Edition. The
   * answer is the same whether or not the email has an Account. An Edition the
   * backend didn't find, or one with the Account switched off, is refused, and
   * so is an email that is not an email, or a request from the IP address `ip`
   * or for the email over its limit; nothing is sent then.
   */
  requestCode(
    email: string,
    editionId: string,
    ip: string,
  ): Promise<
    | { readonly ok: true }
    | InvalidEmail
    | { readonly ok: false; readonly reason: 'unknown-edition' | 'account-off' }
    | TooManyRequests
  >;
  /**
   * Signs in with the code last sent to the email; the first right code
   * creates the Account. A check from the IP address `ip` over its limit is
   * refused.
   */
  verifyCode(
    email: string,
    code: string,
    ip: string,
  ): Promise<CodeCheck | InvalidEmail | TooManyRequests>;
  /** The Account of the Session the token carries, if the Session is on. */
  accountOf(token: string): Promise<AccountRecord | undefined>;
  /** Ends the Session the token carries; the Account's other Sessions go on. */
  signOut(token: string): Promise<Ended>;
  /** Ends every Session of the token's Account, its own included. */
  signOutEverywhere(token: string): Promise<Ended>;
  /**
   * Deletes the token's Account at once and for good, with its Sessions,
   * sign-in methods and the Sign-in codes waiting for its email. The email
   * may then sign in to a new, empty Account.
   */
  delete(token: string): Promise<Ended>;
}

/**
 * The email as the backend keeps it: trimmed and lower-cased, so that
 * «Anna@Mail.com » and «anna@mail.com» are one Account. None when it is not an
 * email.
 */
function normalised(email: string): string | undefined {
  const trimmed = email.trim().toLowerCase();
  return z.email().safeParse(trimmed).success ? trimmed : undefined;
}

const invalidEmail: InvalidEmail = { ok: false, reason: 'invalid-email' };
const unauthorized: Unauthorized = { ok: false, reason: 'unauthorized' };
const done = { ok: true } as const;

export function createAccounts({
  editions,
  authenticator,
  mailer,
  rateLimits,
  clock,
}: {
  editions: EditionRegistry;
  authenticator: Authenticator;
  mailer: Mailer;
  rateLimits: RateLimits;
  clock: Clock;
}): Accounts {
  const limits = createSignInLimits({ rateLimits, clock });
  return {
    async requestCode(typedEmail, editionId, ip) {
      const email = normalised(typedEmail);
      if (email === undefined) return invalidEmail;
      const edition = editions.find(editionId);
      if (edition === undefined) return { ok: false, reason: 'unknown-edition' };
      if (!edition.config.featureSwitches.account) return { ok: false, reason: 'account-off' };
      const overLimit = await limits.codeRequest(email, ip);
      if (overLimit !== undefined) return overLimit;

      const code = await authenticator.createCode(email);
      const values = { code, name: ACCOUNT_NAME };
      await mailer.send({
        to: email,
        senderName: edition.config.displayName,
        subject: fill(edition.strings.email.subject, values),
        text: fill(edition.strings.email.body, values),
      });
      return { ok: true };
    },

    async verifyCode(typedEmail, code, ip) {
      const email = normalised(typedEmail);
      if (email === undefined) return invalidEmail;
      return (await limits.codeCheck(ip)) ?? authenticator.checkCode(email, code);
    },

    accountOf: (token) => authenticator.accountOf(token),

    async signOut(token) {
      return (await authenticator.revoke(token)) ? done : unauthorized;
    },

    async signOutEverywhere(token) {
      const account = await authenticator.accountOf(token);
      if (account === undefined) return unauthorized;
      await authenticator.revokeAll(account.id);
      return done;
    },

    // From 0.8 the Account's synced data in every Edition goes here too (spec #333).
    async delete(token) {
      const account = await authenticator.accountOf(token);
      if (account === undefined) return unauthorized;
      await authenticator.delete(account);
      return done;
    },
  };
}
