import type { AppleSignInSheet } from '../ports';

type SheetAnswer = Awaited<ReturnType<AppleSignInSheet['signIn']>>;

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
 * An Apple sign-in sheet for tests: each time it is shown it answers what the
 * test said next, in order, and cancels when the test said nothing.
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
}

export function createFakeAppleSignInSheet(): FakeAppleSignInSheet {
  const answers: SheetAnswer[] = [];
  let shown = 0;
  let held: Promise<void> | undefined;
  return {
    get shown() {
      return shown;
    },
    signsIn(email, { expired = false } = {}) {
      answers.push({
        ok: true,
        idToken: `${TOKEN_PREFIX}${email}${expired ? EXPIRED_SUFFIX : ''}`,
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
  };
}
