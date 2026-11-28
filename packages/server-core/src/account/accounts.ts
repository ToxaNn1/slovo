import { AccountEmailSchema, fill } from '@slovo/contracts';
import { ACCOUNTS_PAGE_SIZE } from '@slovo/contracts/admin-api';

import type { ActionEntry } from '../admin/admin-access';
import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type {
  AccountRecord,
  AccountsPage,
  AppleRevocation,
  AppleRevoker,
  RecordedSignInMethod,
  AppleVerifier,
  Authenticator,
  Clock,
  CodeCheck,
  GoogleVerifier,
  Mailer,
  RateLimits,
  ReaderAccount,
  RecordChange,
  SignedIn,
  UserRecords,
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
   * over its limit is refused, and so is a code whose Edition no longer
   * serves the Account, as after a Kill of it.
   */
  verifyCode(
    email: string,
    code: string,
    ip: string,
  ): Promise<CodeCheck | InvalidEmail | NotServing | TooManyRequests>;
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
  /** The Google and Apple sign-in methods recorded for the Session's Account. */
  signInMethodsOf(session: Session): Promise<readonly RecordedSignInMethod[]>;
  /** Ends the Session; the Account's other Sessions go on. */
  signOut(session: Session): Promise<void>;
  /** Ends every Session of the Session's Account, its own included. */
  signOutEverywhere(session: Session): Promise<void>;
  /**
   * Deletes the Session's Account at once and for good, with its Sessions,
   * sign-in methods, the records Sync keeps of it in every Edition and the
   * Sign-in codes waiting for its email. The email may then sign in to a
   * new, empty Account. With Apple's fresh authorization code it first
   * revokes SLOVO at Apple and answers how that went; a revocation that
   * fails holds back no deletion. Without a code it answers none.
   */
  delete(session: Session, appleAuthorizationCode?: string): Promise<AppleRevocation | undefined>;
  /**
   * One page from 1 of every Account, newest first, for the owner admin alone,
   * which names Accounts other than the Session's own; a `search`
   * keeps those whose email holds it, in any case. Past the last page it
   * lists none.
   */
  list(query: { readonly page: number; readonly search: string }): Promise<AccountsPage>;
  /**
   * The Account of the id with, for every Edition it syncs, the records Sync
   * keeps of it in the order they were kept, tombstones left out; for the
   * owner admin alone, which reads them and never changes them.
   * None when no Account has the id.
   */
  get(accountId: string): Promise<AccountWithRecords | undefined>;
  /**
   * Deletes the email's Account as `delete` does a Session's, for the owner
   * admin alone, with the Action log's entry of the Account deleted in the
   * same write, and answers the Account deleted; none, and nothing changes,
   * when the email has no Account.
   */
  deleteByEmail(
    email: string,
    entryOf: (deleted: AccountRecord) => ActionEntry,
  ): Promise<AccountRecord | undefined>;
}

/** An Account as the owner admin opens it, with the records Sync keeps of it per Edition. */
export interface AccountWithRecords extends ReaderAccount {
  readonly editions: readonly {
    readonly editionId: string;
    readonly records: readonly RecordChange[];
  }[];
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
  appleRevoker,
  bundleId,
  mailer,
  rateLimits,
  records,
  clock,
}: {
  editions: EditionRegistry;
  authenticator: Authenticator;
  google: GoogleVerifier;
  apple: AppleVerifier;
  /** Revokes SLOVO at Apple when an Account with Sign in with Apple is deleted. */
  appleRevoker: AppleRevoker;
  /** The app's bundle id, SLOVO's client id at Apple (ADR 0047), from the AppConfig. */
  bundleId: string;
  mailer: Mailer;
  rateLimits: RateLimits;
  records: UserRecords;
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

      const code = await authenticator.createCode(email, editionId);
      const values = { code, name: edition.config.accountName };
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
      const overLimit = await limits.codeCheck(email, ip);
      if (overLimit !== undefined) return overLimit;
      const editionId = await authenticator.codeEdition(email);
      if (editionId !== undefined) {
        const serving = await editions.serving(editionId, 'account');
        if (!serving.ok) return serving;
      }
      return authenticator.checkCode(email, code);
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

      // The app's bundle id is SLOVO's client id at Apple (ADR 0047).
      const check = await apple.verify(idToken, bundleId);
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

    signInMethodsOf: async ({ account }) =>
      (await authenticator.accountById(account.id))?.signInMethods ?? [],

    signOut: ({ token }) => authenticator.revoke(token),

    signOutEverywhere: ({ account }) => authenticator.revokeAll(account.id),

    async delete({ account }, appleAuthorizationCode) {
      const revocation =
        appleAuthorizationCode === undefined
          ? undefined
          : await appleRevoker
              .revoke(appleAuthorizationCode, bundleId)
              .catch((error: unknown): AppleRevocation => ({
                ok: false,
                reason: 'failed',
                error: error instanceof Error ? error : new Error('The Apple revocation failed'),
              }));
      await authenticator.delete(account);
      return revocation;
    },

    list: ({ page, search }) =>
      authenticator.accounts({
        search: search.trim().toLowerCase(),
        offset: (page - 1) * ACCOUNTS_PAGE_SIZE,
        limit: ACCOUNTS_PAGE_SIZE,
      }),

    async get(accountId) {
      // An unknown id reads no records.
      const found = await authenticator.accountById(accountId);
      if (found === undefined) return undefined;
      const kept = await records.ofAccount(accountId);
      const byEdition = new Map<string, RecordChange[]>();
      for (const { editionId, key, value, changedAt } of kept) {
        if (value === null) continue;
        const edition = byEdition.get(editionId) ?? [];
        edition.push({ key, value, changedAt });
        byEdition.set(editionId, edition);
      }
      return {
        ...found,
        editions: [...byEdition].map(([editionId, changes]) => ({ editionId, records: changes })),
      };
    },

    async deleteByEmail(typedEmail, entryOf) {
      const email = normalised(typedEmail);
      if (email === undefined) return undefined;
      const found = await authenticator.accountOf(email);
      if (found === undefined) return undefined;
      await authenticator.delete(found.account, { ...entryOf(found.account), at: clock.now() });
      return found.account;
    },
  };
}
