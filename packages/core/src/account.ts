import { z } from 'zod';

import { createSubscribers } from './in-turn';
import type {
  AccountApi,
  AccountApiFailure,
  Clock,
  Random,
  RequestFailure,
  Schedule,
  SessionStore,
} from './ports';
import { withRetries, type Answer } from './retry';

/** How long after a Sign-in code was sent another can be sent, in milliseconds. */
const RESEND_AFTER = 60_000;

/** How long a check of the Session with the server holds, in milliseconds: an hour. */
const CHECK_HOLDS = 60 * 60_000;

/** Why the last request of the Account did not do what the reader asked. */
export type AccountProblem =
  'offline' | 'invalid-email' | 'wrong-code' | 'code-expired' | 'too-many-requests' | 'unexpected';

/**
 * The Account on this device as it stands: signed out, a Sign-in code sent,
 * or signed in; beside it, whether a request is in flight and the problem of
 * the last one, if any.
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
  readonly inFlight: boolean;
  readonly problem: AccountProblem | undefined;
};

/**
 * The reader's Account («SLOVO ID») on this device, with every rule of
 * signing in, out and deleting it. While a request is in flight no other
 * starts, signing out aside. A request that fails with no answer or a server
 * error is tried again, at most 3 times, with backoff and jitter (ADR 0037).
 * Whenever the server says the Session has ended, the device forgets
 * it and shows signed out, with no problem. Nothing here touches the user
 * state: the reader's words stay whatever happens to the Account.
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
   * and offline the Session holds. The shell calls it when the app returns to
   * the foreground and when Settings opens.
   */
  refresh(): Promise<void>;
}

type Unauthorized = Extract<AccountApiFailure, { readonly reason: 'unauthorized' }>;

const unauthorized = (answer: Answer) => !answer.ok && answer.reason === 'unauthorized';

/**
 * The problem a failed request shows. A server that fails through every try
 * is out of reach, as when offline.
 */
function problemOf(reason: RequestFailure['reason'] | 'code-expired'): AccountProblem {
  return reason === 'server-error' ? 'offline' : reason;
}

/** Whether the text is an email, by Zod's rule. */
const isEmail = (text: string) => z.email().safeParse(text).success;

const signedOut: AccountState = { status: 'signed-out', inFlight: false, problem: undefined };

const signedIn = (email: string): AccountState => ({
  status: 'signed-in',
  email,
  inFlight: false,
  problem: undefined,
});

/**
 * Opens the Account from the Session the device keeps, apart from the Core
 * composition, since it needs no Language Pack (ADR 0037).
 */
export async function openAccount({
  api,
  sessions,
  clock,
  schedule,
  random,
}: {
  api: AccountApi;
  sessions: SessionStore;
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

  const retried = <A extends Answer>(call: () => Promise<A>) =>
    withRetries(call, { schedule, random });

  function change(next: AccountState): void {
    state = next;
    subscribers.tell();
  }

  /** Forgets this device's Session, so the answers in flight with it are outdated, and answers signed out. */
  async function endSession(): Promise<AccountState> {
    endedSessions += 1;
    token = undefined;
    checkedAt = undefined;
    await sessions.forget();
    return signedOut;
  }

  /**
   * Makes a request, none while another is in flight: it clears the last
   * problem, shows the request in flight, tries it again by the rule, and
   * changes to the state `settle` makes of its answer, or to signed out on a
   * 401. An answer outdated by a sign-out on the way changes nothing.
   */
  async function request<A extends Answer>(
    call: () => Promise<A>,
    settle: (answer: Exclude<A, Unauthorized>) => AccountState | Promise<AccountState>,
  ): Promise<void> {
    if (state.inFlight) return;
    const ended = endedSessions;
    change({ ...state, inFlight: true, problem: undefined });
    let next: AccountState;
    try {
      const answer = await retried(call);
      if (ended !== endedSessions) return;
      next = unauthorized(answer)
        ? await endSession()
        : await settle(answer as Exclude<A, Unauthorized>);
    } catch (error) {
      if (ended === endedSessions) change({ ...state, inFlight: false });
      throw error;
    }
    change({ ...next, inFlight: false });
  }

  function sendCode(email: string): Promise<void> {
    return request(
      () => api.requestCode(email),
      (answer): AccountState =>
        answer.ok
          ? {
              status: 'code-sent',
              email,
              resendAt: new Date(clock.now().getTime() + RESEND_AFTER),
              triesLeft: undefined,
              inFlight: false,
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

  /** Ends this device's Session through the server, by `call`, when the server answers. */
  async function endThroughServer(
    call: (token: string) => Promise<{ readonly ok: true } | AccountApiFailure>,
  ): Promise<void> {
    const current = token;
    if (current === undefined) return;
    await request(
      () => call(current),
      (answer) => (answer.ok ? endSession() : { ...state, problem: problemOf(answer.reason) }),
    );
  }

  return {
    get state() {
      return state;
    },
    subscribe: subscribers.subscribe,
    async requestCode(typed) {
      if (state.status !== 'signed-out' || state.inFlight) return;
      const email = typed.trim().toLowerCase();
      if (!isEmail(email)) {
        change({ ...state, problem: 'invalid-email' });
        return;
      }
      await sendCode(email);
    },
    async resendCode() {
      if (state.status !== 'code-sent' || clock.now() < state.resendAt) return;
      await sendCode(state.email);
    },
    changeEmail() {
      if (state.status === 'code-sent' && !state.inFlight) change(signedOut);
    },
    async verifyCode(typed) {
      const sent = state;
      if (sent.status !== 'code-sent' || sent.inFlight) return;
      const code = typed.trim();
      if (!/^\d{6}$/.test(code)) return;
      await request(
        () => api.verifyCode(sent.email, code),
        async (answer) => {
          if (answer.ok) {
            await sessions.keep({ token: answer.token, email: answer.email });
            token = answer.token;
            checkedAt = clock.now().getTime();
            return signedIn(answer.email);
          }
          if (answer.reason === 'wrong-code') {
            return { ...sent, triesLeft: answer.triesLeft, problem: 'wrong-code' };
          }
          return { ...sent, problem: problemOf(answer.reason) };
        },
      );
    },
    async signOut() {
      if (token === undefined) return;
      untold.push(token);
      change(await endSession());
      await tellSignOuts();
    },
    signOutEverywhere: () => endThroughServer((current) => api.signOutEverywhere(current)),
    delete: () => endThroughServer((current) => api.delete(current)),
    async refresh() {
      if (untold.length > 0) await tellSignOuts();
      const current = token;
      if (current === undefined) return;
      if (checkedAt !== undefined && clock.now().getTime() - checkedAt < CHECK_HOLDS) return;
      await request(
        () => api.me(current),
        (answer) => {
          if (answer.ok) checkedAt = clock.now().getTime();
          return state;
        },
      );
    },
  };
}
