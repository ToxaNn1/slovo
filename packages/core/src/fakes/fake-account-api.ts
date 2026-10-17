import type { AccountApi, AccountApiFailure } from '../ports';

/** How many tries a Sign-in code of the fake allows, as the backend's do. */
const CODE_TRIES = 5;

/** A Sign-in code the fake sent, as a test reads it from the mailbox. */
export interface SentCode {
  readonly email: string;
  readonly code: string;
}

/**
 * An Account API for tests that answers like the backend, in memory: it
 * sends Sign-in codes to a mailbox the test reads, creates an Account on its
 * first right code, and keeps Sessions by token.
 */
export interface FakeAccountApi extends AccountApi {
  /** The Sign-in codes sent, oldest first. */
  readonly sentCodes: readonly SentCode[];
  /** The procedures called, by name, in order, the failed ones included. */
  readonly calls: readonly (keyof AccountApi)[];
  /** The emails of the Accounts there are. */
  readonly accounts: readonly string[];
  /** The tokens of the Sessions there are. */
  readonly sessions: readonly string[];
  /** Makes the next calls fail, one each, in the order given, before they reach the Accounts. */
  failNext(...reasons: AccountApiFailure['reason'][]): void;
  /** Lets every Sign-in code sent so far expire. */
  expireCodes(): void;
  /** Ends every Session there is, as signing out everywhere on another device does. */
  endSessions(): void;
  /** Holds the next call until the call it returns lets it go on. */
  hold(): () => void;
}

/**
 * Makes a fake Account API. Its Sign-in codes are `100001`, `100002` and so
 * on, in the order it sends them, each valid for 5 tries; a new code for an
 * email replaces the one before.
 */
export function createFakeAccountApi(): FakeAccountApi {
  const sentCodes: SentCode[] = [];
  const calls: (keyof AccountApi)[] = [];
  const accounts = new Set<string>();
  /** The email of each Session, by token. */
  const sessions = new Map<string, string>();
  /** The live code of each email, with its tries left. */
  const codes = new Map<string, { code: string; triesLeft: number }>();
  const failures: AccountApiFailure['reason'][] = [];
  let held: Promise<void> | undefined;
  let sessionCount = 0;

  /** Logs the call, waits while it is held, and answers the next failure, if any. */
  async function arrive(name: keyof AccountApi): Promise<AccountApiFailure | undefined> {
    calls.push(name);
    const holding = held;
    held = undefined;
    await holding;
    const reason = failures.shift();
    return reason === undefined ? undefined : { ok: false, reason };
  }

  /** Acts on the Session's Account, or answers that the Session has ended. */
  async function withSession<A>(
    name: keyof AccountApi,
    token: string,
    act: (email: string) => A,
  ): Promise<A | AccountApiFailure> {
    const failure = await arrive(name);
    if (failure !== undefined) return failure;
    const email = sessions.get(token);
    if (email === undefined) return { ok: false, reason: 'unauthorized' };
    return act(email);
  }

  function endSessionsOf(email: string): void {
    for (const [token, owner] of sessions) if (owner === email) sessions.delete(token);
  }

  return {
    get sentCodes() {
      return [...sentCodes];
    },
    get calls() {
      return [...calls];
    },
    get accounts() {
      return [...accounts];
    },
    get sessions() {
      return [...sessions.keys()];
    },
    failNext(...reasons) {
      failures.push(...reasons);
    },
    expireCodes() {
      codes.clear();
    },
    endSessions() {
      sessions.clear();
    },
    hold() {
      let release: () => void = () => undefined;
      held = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    async requestCode(email) {
      const failure = await arrive('requestCode');
      if (failure !== undefined) return failure;
      const code = String(100_001 + sentCodes.length);
      codes.set(email, { code, triesLeft: CODE_TRIES });
      sentCodes.push({ email, code });
      return { ok: true };
    },
    async verifyCode(email, code) {
      const failure = await arrive('verifyCode');
      if (failure !== undefined) return failure;
      const live = codes.get(email);
      if (live === undefined) return { ok: false, reason: 'code-expired' };
      if (live.code !== code) {
        live.triesLeft -= 1;
        if (live.triesLeft === 0) codes.delete(email);
        return { ok: false, reason: 'wrong-code', triesLeft: live.triesLeft };
      }
      codes.delete(email);
      accounts.add(email);
      sessionCount += 1;
      const token = `session-${String(sessionCount)}`;
      sessions.set(token, email);
      return { ok: true, token, email };
    },
    me: (token) => withSession('me', token, (email) => ({ ok: true, email }) as const),
    signOut: (token) =>
      withSession('signOut', token, () => {
        sessions.delete(token);
        return { ok: true } as const;
      }),
    signOutEverywhere: (token) =>
      withSession('signOutEverywhere', token, (email) => {
        endSessionsOf(email);
        return { ok: true } as const;
      }),
    delete: (token) =>
      withSession('delete', token, (email) => {
        endSessionsOf(email);
        accounts.delete(email);
        return { ok: true } as const;
      }),
  };
}
