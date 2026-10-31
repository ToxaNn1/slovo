import { AccountEmailSchema, ACCOUNT_NAME, fill } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type {
  AccountRecord,
  AppleVerifier,
  Authenticator,
  Clock,
  CodeCheck,
  GoogleVerifier,
  Mailer,
  RateLimits,
  SignedIn,
} from '../ports';
import type { TooManyRequests } from '../rate-limit';
import { createSignInLimits } from './sign-in-limits';

/** What an email that is not an email gets. */
interface InvalidEmail {
  readonly ok: false;
  readonly reason: 'invalid-email';
}

/** Why a Google identity token signs nobody in. */
interface GoogleRefused {
  readonly ok: false;
  readonly reason: 'invalid-token' | 'foreign-audience' | 'unverified-email';
}

/** Why an Apple identity token signs nobody in. */
interface AppleRefused {
  readonly ok: false;
  readonly reason: 'invalid-token' | 'foreign-audience';
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
  /** Names the Session, as its token does, but signs nothing in. */
  readonly id: string;
  readonly token: string;
  readonly account: AccountRecord;
  readonly [opened]: true;
}

/** The Account rules of the backend: the Sign-in methods and Sessions. */
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
   * creates the Account. A check from the IP address `ip` or for the email
   * over its limit is refused.
   */
  verifyCode(
    email: string,
    code: string,
    ip: string,
  ): Promise<CodeCheck | InvalidEmail | TooManyRequests>;
  /**
   * Signs in with a Google identity token (ADR 0047): the token must check
   * against Google's keys, be for SLOVO and carry an email Google verified.
   * The email's Account is the one any Sign-in method reaches; the first
   * sign-in of an email creates it. An Edition that doesn't serve Google
   * sign-in, or a backend with no Google client id, refuses as switched off,
   * and so does a request from the IP address `ip` over its limit.
   */
  signInWithGoogle(
    idToken: string,
    editionId: string,
    ip: string,
  ): Promise<({ readonly ok: true } & SignedIn) | GoogleRefused | NotServing | TooManyRequests>;
  /**
   * Signs in with an Apple identity token (ADR 0047): the token must check
   * against Apple's keys and be for the Edition's app, by its bundle id. Its
   * email claim, a private relay address included, names the Account any
   * Sign-in method reaches; the first sign-in of an email creates it. An
   * Edition that doesn't serve Sign in with Apple refuses as switched off,
   * and so does a request from the IP address `ip` over its limit.
   */
  signInWithApple(
    idToken: string,
    editionId: string,
    ip: string,
  ): Promise<({ readonly ok: true } & SignedIn) | AppleRefused | NotServing | TooManyRequests>;
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
const invalidToken = { ok: false, reason: 'invalid-token' } as const;
const switchedOff: NotServing = { ok: false, reason: 'switched-off' };
const unauthorized: Unauthorized = { ok: false, reason: 'unauthorized' };

export function createAccounts({
  editions,
  authenticator,
  google,
  apple,
  mailer,
  rateLimits,
  clock,
}: {
  editions: EditionRegistry;
  authenticator: Authenticator;
  google: GoogleVerifier;
  apple: AppleVerifier;
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
      return (await limits.codeCheck(email, ip)) ?? authenticator.checkCode(email, code);
    },

    async signInWithGoogle(idToken, editionId, ip) {
      const serving = await editions.serving(editionId, 'googleSignIn');
      if (!serving.ok) return serving;
      const overLimit = await limits.googleSignIn(ip);
      if (overLimit !== undefined) return overLimit;

      const check = await google.verify(idToken);
      if (!check.ok) return check.reason === 'not-configured' ? switchedOff : check;
      const { identity } = check;
      if (!identity.emailVerified) return { ok: false, reason: 'unverified-email' };
      // Google gives emails, so one that is not an email is no token of Google's.
      const email = normalised(identity.email);
      if (email === undefined) return invalidToken;
      const signedIn = await authenticator.signInWithGoogle({ ...identity, email });
      return { ok: true, ...signedIn };
    },

    async signInWithApple(idToken, editionId, ip) {
      const serving = await editions.serving(editionId, 'signInWithApple');
      if (!serving.ok) return serving;
      const overLimit = await limits.appleSignIn(ip);
      if (overLimit !== undefined) return overLimit;

      // The Edition's bundle id is SLOVO's client id at Apple (ADR 0047).
      const check = await apple.verify(idToken, serving.edition.config.bundleId);
      if (!check.ok) return check;
      // Apple gives emails, so one that is not an email is no token of Apple's.
      const email = normalised(check.identity.email);
      if (email === undefined) return invalidToken;
      const signedIn = await authenticator.signInWithApple({ ...check.identity, email });
      return { ok: true, ...signedIn };
    },

    async session(token) {
      if (token === undefined) return unauthorized;
      const found = await authenticator.sessionOf(token);
      if (found === undefined) return unauthorized;
      return { ok: true, session: { ...found, token } as Session };
    },

    signOut: ({ token }) => authenticator.revoke(token),

    signOutEverywhere: ({ account }) => authenticator.revokeAll(account.id),

    delete: ({ account }) => authenticator.delete(account),
  };
}
