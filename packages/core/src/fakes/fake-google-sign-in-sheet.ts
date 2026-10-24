import type { GoogleSignInSheet } from '../ports';

type SheetAnswer = Awaited<ReturnType<GoogleSignInSheet['signIn']>>;

/** The identity a fake Google identity token names: its email and whether Google has verified it. */
export interface FakeGoogleIdentity {
  readonly email: string;
  readonly verified: boolean;
}

const TOKEN_PREFIX = 'google-id-token:';
const UNVERIFIED_SUFFIX = ':unverified';

/**
 * The identity a token the fake sheet handed out names, or undefined for a
 * token that is not the fake's. The fake Account API verifies tokens by it.
 */
export function fakeGoogleIdentityOf(idToken: string): FakeGoogleIdentity | undefined {
  if (!idToken.startsWith(TOKEN_PREFIX)) return undefined;
  const claims = idToken.slice(TOKEN_PREFIX.length);
  const verified = !claims.endsWith(UNVERIFIED_SUFFIX);
  return { email: verified ? claims : claims.slice(0, -UNVERIFIED_SUFFIX.length), verified };
}

/**
 * A Google sign-in sheet for tests: each time it is shown it answers what the
 * test said next, in order, and cancels when the test said nothing. It keeps
 * each time it was told to forget the sign-in.
 */
export interface FakeGoogleSignInSheet extends GoogleSignInSheet {
  /** How many times the sheet was shown. */
  readonly shown: number;
  /** Each time the sheet was told to forget the Google sign-in, in order. */
  readonly forgotten: readonly { readonly revoke: boolean }[];
  /**
   * The next sheet signs the reader in as the email, with a Google identity
   * token for it that the fake Account API takes; one for an email Google
   * hasn't verified, it refuses.
   */
  signsIn(email: string, options?: { readonly verified?: boolean }): void;
  /** The reader dismisses the next sheet. */
  cancels(): void;
  /** The next sheet fails: it found no network, or something else went wrong. */
  fails(reason: 'offline' | 'unexpected'): void;
  /**
   * The next sheet stays up until the test calls the release it gives back;
   * then it answers what the test said next.
   */
  holds(): () => void;
  /** Each time from now on, forgetting the Google sign-in fails. */
  failsToForget(): void;
}

export function createFakeGoogleSignInSheet(): FakeGoogleSignInSheet {
  const answers: SheetAnswer[] = [];
  const forgotten: { revoke: boolean }[] = [];
  let forgetFails = false;
  let shown = 0;
  let held: Promise<void> | undefined;
  return {
    get shown() {
      return shown;
    },
    forgotten,
    signsIn(email, { verified = true } = {}) {
      answers.push({
        ok: true,
        idToken: `${TOKEN_PREFIX}${email}${verified ? '' : UNVERIFIED_SUFFIX}`,
      });
    },
    cancels() {
      answers.push({ ok: false, reason: 'cancelled' });
    },
    fails(reason) {
      answers.push({ ok: false, reason });
    },
    holds() {
      let release: () => void = () => undefined;
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    async signIn() {
      shown += 1;
      const up = held;
      held = undefined;
      await up;
      return answers.shift() ?? { ok: false, reason: 'cancelled' };
    },
    failsToForget() {
      forgetFails = true;
    },
    forget({ revoke }) {
      forgotten.push({ revoke });
      return forgetFails ? Promise.reject(new Error('Google forgot nothing')) : Promise.resolve();
    },
  };
}
