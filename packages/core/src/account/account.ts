import { AccountEmailSchema, SignInCodeSchema } from '@slovo/contracts';

import { createSubscribers } from '../in-turn';
import type {
  AccountApi,
  AccountApiFailure,
  Clock,
  GoogleSignInSheet,
  Random,
  RequestFailure,
  Schedule,
  SessionStore,
} from '../ports';
import { withRetries, type Answer } from '../retry';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** How long after a Sign-in code was sent another can be sent, in milliseconds. */
const RESEND_AFTER = 60_000;

/** How long a check of the Session with the server holds, in milliseconds: an hour. */
const CHECK_HOLDS = 60 * 60_000;

/**
 * Why the last request of the Account did not do what the reader asked.
 * `refused` is a Google sign-in the backend refused: the token was not
 * Google's, had expired, was for another app or named an email Google hasn't
 * verified (ADR 0047).
 */
export type AccountProblem =
  | 'offline'
  | 'invalid-email'
  | 'wrong-code'
  | 'code-expired'
  | 'too-many-requests'
  | 'refused'
  | 'unexpected';

/** The actions of the reader that make a request of the server, by name. */
export type AccountRequest = keyof Pick<
  Account,
  'requestCode' | 'resendCode' | 'verifyCode' | 'signInWithGoogle' | 'signOutEverywhere' | 'delete'
>;

/**
 * The Account on this device as it stands: signed out, a Sign-in code sent,
 * or signed in; beside it, the action whose request is in flight, if any, and
 * the problem of the last one, if any.
 */
export type AccountState = (
  | { readonly status: 'signed-out' }
  | {
      readonly status: 'code-sent';
      /** The email the code went to, trimmed and in lower case. */
      readonly email: string;
      /** When another code can be sent. */
      readonly resendAt: Date;
      /** The tries the code has left, known once the server answered a wrong code. */
      readonly triesLeft: number | undefined;
    }
  | { readonly status: 'signed-in'; readonly email: string }
) & {
  readonly inFlight: AccountRequest | undefined;
  readonly problem: AccountProblem | undefined;
};

/**
 * The reader's Account («SLOVO ID») on this device, with every rule of
 * signing in, by a Sign-in code or with Google, out and deleting it. While a
 * request of the reader is in flight no other starts, signing out aside. A request that fails with no answer or a server
 * error is tried again, at most 3 times, with backoff and jitter (ADR 0037).
 * Whenever the server says the Session has ended, the device forgets
 * it and shows signed out, with no problem. Nothing here touches the user
 * state but the installed marker: the reader's words stay whatever happens to
 * the Account.
 */
export interface Account {
  /**
   * The Account as it stands. A change never edits it: it makes a new one and
   * tells the subscribers, so it stays the same object until something changes.
   */
  readonly state: AccountState;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Sends a Sign-in code to the email, when signed out. The email is trimmed
   * and put in lower case, and nothing is sent when it is not an email.
   */
  requestCode(email: string): Promise<void>;
  /** Sends a new Sign-in code to the same email, 60 s after the last one at the earliest. */
  resendCode(): Promise<void>;
  /** Goes back from a Sign-in code sent to the email, signed out, to change it. */
  changeEmail(): void;
  /**
   * Signs in with the Sign-in code sent. A code that is not six digits is no
   * try: nothing is sent and nothing changes, so a wrong code always comes with
   * the tries left.
   */
  verifyCode(code: string): Promise<void>;
  /**
   * Signs in with Google, when signed out: shows Google's sheet and sends the
   * identity token it answers to the backend, which signs the email's one
   * Account in, whatever Sign-in method made it (ADR 0047). The sheet counts
   * as the request in flight. A sheet the reader cancels leaves the Account
   * as it was, with no problem; a refused token is the problem `refused`.
   */
  signInWithGoogle(): Promise<void>;
  /**
   * Signs this device out at once, even offline, and tells the server; when
   * it can't, the next `refresh` tells it.
   */
  signOut(): Promise<void>;
  /** Ends every Session of the Account, this device's too. */
  signOutEverywhere(): Promise<void>;
  /** Deletes the Account with every Session of it, for good. */
  delete(): Promise<void>;
  /**
   * Tells the server of the sign-outs it missed, and checks the Session with
   * it at most once an hour: a check that finds no server counts for nothing,
   * and offline the Session holds. The check is in the background, one at a
   * time: it shows nothing in flight, keeps the problem shown and holds back
   * no action of the reader; its answer changes nothing once the Session
   * ended on the way. The shell calls it when the app returns to the
   * foreground and when Settings opens.
   */
  refresh(): Promise<void>;
  /**
   * Makes the request of another module, such as Sync, with this device's
   * Session, and answers its answer; without a Session it makes none and
   * answers `undefined`. The Account's 401 rule holds for it: when it says
   * the Session has ended, the device forgets it and shows signed out, with
   * no problem, unless the Session ended on the way. It tries nothing again
   * and shows nothing in flight: the request is not the reader's.
   */
  withSession<A extends Answer>(request: (token: string) => Promise<A>): Promise<A | undefined>;
}

type Unauthorized = Extract<AccountApiFailure, { readonly reason: 'unauthorized' }>;

const unauthorized = (answer: Answer) => !answer.ok && answer.reason === 'unauthorized';

/**
 * The problem a failed request shows. A server that fails through every try
 * is out of reach, as when offline.
 */
function problemOf(reason: RequestFailure['reason'] | 'code-expired' | 'refused'): AccountProblem {
  return reason === 'server-error' ? 'offline' : reason;
}

const signedOut: AccountState = { status: 'signed-out', inFlight: undefined, problem: undefined };

const signedIn = (email: string): AccountState => ({
  status: 'signed-in',
  email,
  inFlight: undefined,
  problem: undefined,
});

/**
 * Opens the Account from the Session the device keeps, apart from the Core
 * composition, since it needs no Language Pack (ADR 0037). A fresh install
 * starts signed out: when the user state lacks the installed marker, a Session
 * kept is one an earlier install left in the Keychain, so it is forgotten, the
 * server is told in the background, and the marker is written.
 */
export async function openAccount({
  api,
  googleSheet,
  sessions,
  userState,
  clock,
  schedule,
  random,
}: {
  api: AccountApi;
  googleSheet: GoogleSignInSheet;
  sessions: SessionStore;
  /** The user state, opened, which holds the installed marker. */
  userState: Pick<UserState, 'read' | 'write'>;
  clock: Clock;
  /** What failed requests wait by before they are tried again. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
}): Promise<Account> {
  const subscribers = createSubscribers();
  const kept = await sessions.read();
  let state: AccountState = kept === undefined ? signedOut : signedIn(kept.email);
  /** The token of this device's Session, while signed in. */
  let token = kept?.token;
  /** When the server last vouched for the Session, in milliseconds; never for a Session kept from before. */
  let checkedAt: number | undefined;
  /** How many Sessions this device has ended: an answer that comes after one ended is outdated. */
  let endedSessions = 0;
  /** The tokens of the Sessions signed out on this device that the server has not heard of yet. */
  const untold: string[] = [];
  let telling: Promise<void> | undefined;
  /** The check of the Session with the server in flight, if any. */
  let checking: Promise<void> | undefined;

  const retried = <A extends Answer>(call: () => Promise<A>) =>
    withRetries(call, { schedule, random });

  function change(next: AccountState): void {
    state = next;
    subscribers.tell();
  }

  /**
   * Forgets this device's Session, so the answers in flight with it are
   * outdated, and the Google sign-in with it, revoked when the Account is
   * deleted; answers signed out. A Google sign-in that fails to be forgotten
   * changes nothing.
   */
  async function endSession({ revoke = false } = {}): Promise<AccountState> {
    endedSessions += 1;
    token = undefined;
    checkedAt = undefined;
    await sessions.forget();
    await googleSheet.forget({ revoke }).catch(() => undefined);
    return signedOut;
  }

  /** Keeps the Session a sign-in started, and answers signed in. */
  async function startSession(session: { token: string; email: string }): Promise<AccountState> {
    await sessions.keep(session);
    token = session.token;
    checkedAt = clock.now().getTime();
    return signedIn(session.email);
  }

  /** Clears the last problem and shows the action `name` in flight, when none is. */
  function begin(name: AccountRequest): boolean {
    if (state.inFlight !== undefined) return false;
    change({ ...state, inFlight: name, problem: undefined });
    return true;
  }

  /**
   * Makes the request of the action `name`, none while another is in flight:
   * it clears the last problem, shows the action in flight, tries the request
   * again by the rule, and changes to the state `settle` makes of its answer,
   * or to signed out on a 401. An answer outdated by a sign-out on the way
   * changes nothing.
   */
  async function request<A extends Answer>(
    name: AccountRequest,
    call: () => Promise<A>,
    settle: (answer: Exclude<A, Unauthorized>) => AccountState | Promise<AccountState>,
  ): Promise<void> {
    if (begin(name)) await complete(call, settle);
  }

  /** The request of the action in flight, from its call to the state it settles in. */
  async function complete<A extends Answer>(
    call: () => Promise<A>,
    settle: (answer: Exclude<A, Unauthorized>) => AccountState | Promise<AccountState>,
  ): Promise<void> {
    const ended = endedSessions;
    let next: AccountState;
    try {
      const answer = await retried(call);
      if (ended !== endedSessions) return;
      next = unauthorized(answer)
        ? await endSession()
        : await settle(answer as Exclude<A, Unauthorized>);
    } catch (error) {
      if (ended === endedSessions) change({ ...state, inFlight: undefined });
      throw error;
    }
    change({ ...next, inFlight: undefined });
  }

  function sendCode(
    name: Extract<AccountRequest, 'requestCode' | 'resendCode'>,
    email: string,
  ): Promise<void> {
    return request(
      name,
      () => api.requestCode(email),
      (answer): AccountState =>
        answer.ok
          ? {
              status: 'code-sent',
              email,
              resendAt: new Date(clock.now().getTime() + RESEND_AFTER),
              triesLeft: undefined,
              inFlight: undefined,
              problem: undefined,
            }
          : { ...state, problem: problemOf(answer.reason) },
    );
  }

  /** Tells the server of each sign-out it has not heard of, until one finds no server. */
  function tellSignOuts(): Promise<void> {
    telling ??= (async () => {
      let next = untold[0];
      while (next !== undefined) {
        const signedOutToken = next;
        const answer = await retried(() => api.signOut(signedOutToken));
        // A Session the server has ended already needs no telling, and one it
        // answers unexpectedly no telling changes.
        if (!answer.ok && answer.reason !== 'unauthorized' && answer.reason !== 'unexpected')
          return;
        untold.shift();
        next = untold[0];
      }
    })().finally(() => {
      telling = undefined;
    });
    return telling;
  }

  /** Ends this device's Session through the server by the action `name`, when the server answers. */
  async function endThroughServer(
    name: Extract<AccountRequest, 'signOutEverywhere' | 'delete'>,
  ): Promise<void> {
    const current = token;
    if (current === undefined) return;
    await request(
      name,
      () => api[name](current),
      (answer) =>
        answer.ok
          ? endSession({ revoke: name === 'delete' })
          : { ...state, problem: problemOf(answer.reason) },
    );
  }

  if ((await userState.read(userStateRecords.installed)) === undefined) {
    if (token !== undefined) {
      untold.push(token);
      state = await endSession();
      void tellSignOuts().catch(() => undefined);
    }
    await userState.write(userStateRecords.installed.change(true));
  }

  return {
    get state() {
      return state;
    },
    subscribe: subscribers.subscribe,
    async requestCode(typed) {
      if (state.status !== 'signed-out' || state.inFlight !== undefined) return;
      const email = AccountEmailSchema.safeParse(typed);
      if (!email.success) {
        change({ ...state, problem: 'invalid-email' });
        return;
      }
      await sendCode('requestCode', email.data);
    },
    async resendCode() {
      if (state.status !== 'code-sent' || clock.now() < state.resendAt) return;
      await sendCode('resendCode', state.email);
    },
    changeEmail() {
      if (state.status === 'code-sent' && state.inFlight === undefined) change(signedOut);
    },
    async verifyCode(typed) {
      const sent = state;
      if (sent.status !== 'code-sent' || sent.inFlight !== undefined) return;
      const code = typed.trim();
      if (!SignInCodeSchema.safeParse(code).success) return;
      await request(
        'verifyCode',
        () => api.verifyCode(sent.email, code),
        async (answer) => {
          if (answer.ok) return startSession({ token: answer.token, email: answer.email });
          if (answer.reason === 'wrong-code') {
            return { ...sent, triesLeft: answer.triesLeft, problem: 'wrong-code' };
          }
          return { ...sent, problem: problemOf(answer.reason) };
        },
      );
    },
    async signInWithGoogle() {
      if (state.status !== 'signed-out' || !begin('signInWithGoogle')) return;
      let shown: Awaited<ReturnType<GoogleSignInSheet['signIn']>>;
      try {
        shown = await googleSheet.signIn();
      } catch (error) {
        change({ ...state, inFlight: undefined });
        throw error;
      }
      if (!shown.ok) {
        change({
          ...state,
          inFlight: undefined,
          problem: shown.reason === 'cancelled' ? undefined : shown.reason,
        });
        return;
      }
      await complete(
        () => api.signInWithGoogle(shown.idToken),
        (answer) =>
          answer.ok
            ? startSession({ token: answer.token, email: answer.email })
            : { ...state, problem: problemOf(answer.reason) },
      );
    },
    async signOut() {
      if (token === undefined) return;
      untold.push(token);
      change(await endSession());
      await tellSignOuts();
    },
    signOutEverywhere: () => endThroughServer('signOutEverywhere'),
    delete: () => endThroughServer('delete'),
    async refresh() {
      if (untold.length > 0) await tellSignOuts();
      const current = token;
      if (current === undefined) return;
      if (checkedAt !== undefined && clock.now().getTime() - checkedAt < CHECK_HOLDS) return;
      checking ??= (async () => {
        const ended = endedSessions;
        const answer = await retried(() => api.me(current));
        if (ended !== endedSessions) return;
        if (answer.ok) checkedAt = clock.now().getTime();
        else if (unauthorized(answer)) change(await endSession());
      })().finally(() => {
        checking = undefined;
      });
      await checking;
    },
    async withSession(lent) {
      const current = token;
      if (current === undefined) return undefined;
      const ended = endedSessions;
      const answer = await lent(current);
      if (unauthorized(answer) && ended === endedSessions) change(await endSession());
      return answer;
    },
  };
}
