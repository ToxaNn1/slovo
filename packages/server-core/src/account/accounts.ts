import { AccountEmailSchema, ACCOUNT_NAME, fill } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { AccountRecord, Authenticator, Clock, CodeCheck, Mailer, RateLimits } from '../ports';
import type { TooManyRequests } from '../rate-limit';
import { createSignInLimits } from './sign-in-limits';

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

declare const opened: unique symbol;

/**
 * A Session that is on, with its Account. Only `Accounts.session` opens one,
 * from the token the request carries, so an action on a Session acts on its
 * own Account, never on one a request names.
 */
export interface Session {
  readonly token: string;
  readonly account: AccountRecord;
  readonly [opened]: true;
}

/** The Account rules of the backend: Sign-in codes and Sessions. */
export interface Accounts {
  /**
   * Sends a new Sign-in code to the email in the language of the Edition. The
   * answer is the same whether or not the email has an Account. An Edition
   * that doesn't serve the Account is refused, and so is an email that is not
   * an email, or a request from the IP address `ip` or for the email over its
   * limit; nothing is sent then.
   */
  requestCode(
    email: string,
    editionId: string,
    ip: string,
  ): Promise<{ readonly ok: true } | InvalidEmail | NotServing | TooManyRequests>;
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
  /**
   * The Session the token carries, the one way to act on an Account; using a
   * Session extends it. Without a token, or with one that carries no Session
   * that is on, it is unauthorized.
   */
  session(
    token: string | undefined,
  ): Promise<{ readonly ok: true; readonly session: Session } | Unauthorized>;
  /** Ends the Session; the Account's other Sessions go on. */
  signOut(session: Session): Promise<void>;
  /** Ends every Session of the Session's Account, its own included. */
  signOutEverywhere(session: Session): Promise<void>;
  /**
   * Deletes the Session's Account at once and for good, with its Sessions,
   * sign-in methods, the records Sync keeps of it in every Edition and the
   * Sign-in codes waiting for its email. The email may then sign in to a
   * new, empty Account.
   */
  delete(session: Session): Promise<void>;
}

/** The email as the backend keeps it, by `AccountEmailSchema`; none when it is not an email. */
function normalised(email: string): string | undefined {
  return AccountEmailSchema.safeParse(email).data;
}

const invalidEmail: InvalidEmail = { ok: false, reason: 'invalid-email' };
const unauthorized: Unauthorized = { ok: false, reason: 'unauthorized' };

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
      const serving = await editions.serving(editionId, 'account');
      if (!serving.ok) return serving;
      const { edition } = serving;
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

    async session(token) {
      if (token === undefined) return unauthorized;
      const account = await authenticator.accountOf(token);
      if (account === undefined) return unauthorized;
      return { ok: true, session: { token, account } as Session };
    },

    signOut: ({ token }) => authenticator.revoke(token),

    signOutEverywhere: ({ account }) => authenticator.revokeAll(account.id),

    delete: ({ account }) => authenticator.delete(account),
  };
}
