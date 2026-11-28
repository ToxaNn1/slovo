import type { AppleSignInSheet } from '../ports';
import { createFakeSignInSheet } from './fake-sign-in-sheet';

/** What Apple's sheet answers before a deletion. */
type Authorization = Awaited<ReturnType<AppleSignInSheet['authorize']>>;

/** The identity a fake Apple identity token names: its email and whether the token still holds. */
export interface FakeAppleIdentity {
  readonly email: string;
  readonly expired: boolean;
}

const TOKEN_PREFIX = 'apple-id-token:';
const EXPIRED_SUFFIX = ':expired';

/**
 * The identity a token the fake sheet handed out names, or undefined for a
 * token that is not the fake's. The fake Account API verifies tokens by it.
 */
export function fakeAppleIdentityOf(idToken: string): FakeAppleIdentity | undefined {
  if (!idToken.startsWith(TOKEN_PREFIX)) return undefined;
  const claims = idToken.slice(TOKEN_PREFIX.length);
  const expired = claims.endsWith(EXPIRED_SUFFIX);
  return { email: expired ? claims.slice(0, -EXPIRED_SUFFIX.length) : claims, expired };
}

/**
 * An Apple sign-in sheet for tests: each time it is shown, to sign in or for
 * an authorization code, it answers what the test said next for that use, in
 * order, and cancels when the test said nothing.
 */
export interface FakeAppleSignInSheet extends AppleSignInSheet {
  /** How many times the sheet was shown. */
  readonly shown: number;
  /**
   * The next sheet signs the reader in as the email, with an Apple identity
   * token for it that the fake Account API takes; an expired one, it refuses.
   */
  signsIn(email: string, options?: { readonly expired?: boolean }): void;
  /** The reader dismisses the next sheet. */
  cancels(): void;
  /** The next sheet fails: it found no network, or something else went wrong. */
  fails(reason: 'offline' | 'unexpected'): void;
  /**
   * The next sheet stays up until the test calls the release it gives back;
   * then it answers what the test said next.
   */
  holds(): () => void;
  /** How many times the sheet was shown for an authorization code, before a deletion. */
  readonly authorizations: number;
  /** The next authorization hands out a fresh code, `apple-code:1`, `apple-code:2` and so on. */
  authorizes(): void;
  /** The reader dismisses the next authorization sheet. */
  cancelsAuthorization(): void;
  /** The next authorization finds no Apple sheet on the device, or fails otherwise. */
  failsAuthorization(reason: 'unavailable' | 'unexpected'): void;
}

export function createFakeAppleSignInSheet(): FakeAppleSignInSheet {
  const sheet = createFakeSignInSheet();
  const authorizations: Authorization[] = [];
  let authorized = 0;
  let codes = 0;
  return {
    get shown() {
      return sheet.shown;
    },
    signsIn(email, { expired = false } = {}) {
      sheet.handsOut(`${TOKEN_PREFIX}${email}${expired ? EXPIRED_SUFFIX : ''}`);
    },
    cancels: sheet.cancels,
    fails: sheet.fails,
    holds: sheet.holds,
    signIn: sheet.signIn,
    get authorizations() {
      return authorized;
    },
    authorizes() {
      codes += 1;
      authorizations.push({ ok: true, authorizationCode: `apple-code:${String(codes)}` });
    },
    cancelsAuthorization() {
      authorizations.push({ ok: false, reason: 'cancelled' });
    },
    failsAuthorization(reason) {
      authorizations.push({ ok: false, reason });
    },
    authorize() {
      authorized += 1;
      return Promise.resolve(authorizations.shift() ?? { ok: false, reason: 'cancelled' });
    },
  };
}
