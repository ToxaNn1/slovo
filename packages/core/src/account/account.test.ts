import { describe, expect, it, vi } from 'vitest';

import {
  createMemorySessionStore,
  openAccount,
  createMemoryUserStatePort,
  openUserState,
  userStateRecords,
  type KeptSession,
  type Random,
  type Schedule,
  type UserStatePort,
} from '../index';
import { createFakeAccountApi, createFakeGoogleSignInSheet } from '../testing';
import { fakeClock, randomOf } from '../test-support';

/** A schedule that runs what it is given at once and keeps each delay asked for. */
function atOnce() {
  const delays: number[] = [];
  const schedule: Schedule = (run, delay) => {
    delays.push(delay);
    run();
    return () => undefined;
  };
  return { schedule, delays };
}

/** A user state this install of the app has kept before: it holds the installed marker. */
async function installedUserState(port: UserStatePort = createMemoryUserStatePort()) {
  const userState = await openUserState({ port });
  await userState.write(userStateRecords.installed.change(true));
  return userState;
}

async function setup({
  kept,
  random = randomOf(0.5),
  port,
}: { kept?: KeptSession; random?: Random; port?: UserStatePort } = {}) {
  const api = createFakeAccountApi();
  const googleSheet = createFakeGoogleSignInSheet();
  const sessions = createMemorySessionStore(kept);
  const time = fakeClock();
  const later = atOnce();
  const installed = await installedUserState(port);
  /** Launches the app: over the user state given, or the one this install kept. */
  const open = async (userState = installed) =>
    openAccount({
      api,
      googleSheet,
      sessions,
      userState,
      clock: time.clock,
      schedule: later.schedule,
      random,
    });
  const account = await open();
  return { account, api, googleSheet, sessions, time, delays: later.delays, open };
}

describe('the Account', () => {
  it('signs in from signed out through a Sign-in code sent to the email, and stays signed in', async () => {
    const { account, api, sessions, time, open } = await setup();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });

    await account.requestCode(' Anna@Mail.com ');
    expect(api.sentCodes).toEqual([{ email: 'anna@mail.com', code: '100001' }]);
    expect(account.state).toEqual({
      status: 'code-sent',
      email: 'anna@mail.com',
      resendAt: new Date(time.clock.now().getTime() + 60_000),
      triesLeft: undefined,
      inFlight: undefined,
      problem: undefined,
    });

    await account.verifyCode('100001');
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.accounts).toEqual(['anna@mail.com']);
    expect(await sessions.read()).toEqual({ token: 'session-1', email: 'anna@mail.com' });

    const reopened = await open();
    expect(reopened.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('sends nothing to an email that is not one, and says so', async () => {
    const { account, api } = await setup();

    await account.requestCode('anna@mail');

    expect(api.calls).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'invalid-email',
    });

    await account.requestCode('anna@mail.com');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: undefined });
  });

  it('sends another Sign-in code 60 s after the last, not before', async () => {
    const { account, api, time } = await setup();
    await account.requestCode('anna@mail.com');

    time.advance(59_999);
    await account.resendCode();
    expect(api.sentCodes).toHaveLength(1);

    time.advance(1);
    await account.resendCode();
    expect(api.sentCodes).toEqual([
      { email: 'anna@mail.com', code: '100001' },
      { email: 'anna@mail.com', code: '100002' },
    ]);
    expect(account.state).toMatchObject({
      status: 'code-sent',
      resendAt: new Date(time.clock.now().getTime() + 60_000),
    });
  });

  it('goes back to the email to change it before the code is typed', async () => {
    const { account, api } = await setup();
    await account.requestCode('ana@mail.com');

    account.changeEmail();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });

    await account.requestCode('anna@mail.com');
    expect(api.sentCodes.map(({ email }) => email)).toEqual(['ana@mail.com', 'anna@mail.com']);
  });

  it('tells the tries left after a wrong code, and signs in with the right one after it', async () => {
    const { account } = await setup();
    await account.requestCode('anna@mail.com');

    await account.verifyCode('999999');
    expect(account.state).toMatchObject({
      status: 'code-sent',
      triesLeft: 4,
      problem: 'wrong-code',
    });

    await account.verifyCode('100001');
    expect(account.state).toMatchObject({ status: 'signed-in', problem: undefined });
  });

  it('sends no code that is not six digits, and changes nothing for it', async () => {
    const { account, api } = await setup();
    await account.requestCode('anna@mail.com');
    const sent = account.state;

    await account.verifyCode('12345');

    expect(api.calls).toEqual(['requestCode']);
    expect(account.state).toBe(sent);

    await account.verifyCode(' 100001 ');
    expect(account.state).toMatchObject({ status: 'signed-in' });
  });

  it('says when the code has expired, and a new code signs in', async () => {
    const { account, api, time } = await setup();
    await account.requestCode('anna@mail.com');
    api.expireCodes();

    await account.verifyCode('100001');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: 'code-expired' });

    time.advance(60_000);
    await account.resendCode();
    expect(account.state).toMatchObject({ problem: undefined });
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in' });
  });

  it('says there were too many requests when the backend holds the request back', async () => {
    const { account, api } = await setup();
    api.failNext('too-many-requests');

    await account.requestCode('anna@mail.com');

    expect(api.sentCodes).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'too-many-requests',
    });
  });

  it('says something went wrong when the backend answers what the request never expects', async () => {
    const { account, api } = await setup();
    api.failNext('unexpected');

    await account.requestCode('anna@mail.com');
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'unexpected',
    });

    await account.requestCode('anna@mail.com');
    api.failNext('unexpected');
    await account.verifyCode('100001');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: 'unexpected' });
  });

  it('says it is offline when no try reaches the server, and sends once it does', async () => {
    const { account, api } = await setup();
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.requestCode('anna@mail.com');
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'offline',
    });

    await account.requestCode('anna@mail.com');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: undefined });
  });

  it('calls a server failing through every try offline too', async () => {
    const { account, api } = await setup();
    await account.requestCode('anna@mail.com');
    api.failNext('server-error', 'server-error', 'server-error', 'server-error');

    await account.verifyCode('100001');

    expect(account.state).toMatchObject({ status: 'code-sent', problem: 'offline' });
  });

  it('shows a request in flight and sends no second one meanwhile', async () => {
    const { account, api } = await setup();
    const release = api.hold();

    const sending = account.requestCode('anna@mail.com');
    expect(account.state).toMatchObject({ status: 'signed-out', inFlight: 'requestCode' });
    await account.requestCode('anna@mail.com');
    release();
    await sending;

    expect(api.calls).toEqual(['requestCode']);
    expect(account.state).toMatchObject({ status: 'code-sent', inFlight: undefined });
  });

  it('names the request in flight: a new code or a sign-in', async () => {
    const { account, api, time } = await setup();
    await account.requestCode('anna@mail.com');
    time.advance(60_000);

    let release = api.hold();
    const resending = account.resendCode();
    expect(account.state).toMatchObject({ status: 'code-sent', inFlight: 'resendCode' });
    release();
    await resending;

    release = api.hold();
    const verifying = account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'code-sent', inFlight: 'verifyCode' });
    release();
    await verifying;
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: undefined });
  });
});

const anna: KeptSession = { token: 'session-1', email: 'anna@mail.com' };

/** An Account signed in on this device as Anna, through the fake API. */
async function signedIn() {
  const parts = await setup();
  await parts.account.requestCode(anna.email);
  await parts.account.verifyCode('100001');
  return parts;
}

describe('the Account signed in', () => {
  it('checks the Session at most once an hour', async () => {
    const { account, api, time } = await signedIn();

    await account.refresh();
    expect(api.calls).not.toContain('me');

    time.advance(59 * 60_000);
    await account.refresh();
    expect(api.calls).not.toContain('me');

    time.advance(60_000);
    await account.refresh();
    await account.refresh();
    expect(api.calls.filter((call) => call === 'me')).toHaveLength(1);
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
  });

  it('checks a Session kept from before at the first refresh', async () => {
    const { account, api } = await setup({ kept: anna });
    api.endSessions();

    await account.refresh();

    expect(api.calls).toEqual(['me']);
    expect(account.state).toMatchObject({ status: 'signed-out' });
  });

  it('signs out quietly when the server says the Session has ended', async () => {
    const { account, api, sessions, time } = await signedIn();
    api.endSessions();
    time.advance(60 * 60_000);

    await account.refresh();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
  });

  it('lends its Session to the request of another module, and signs out quietly when it has ended', async () => {
    const { account, sessions } = await signedIn();
    const tokens: string[] = [];

    expect(
      await account.withSession((token) => {
        tokens.push(token);
        return Promise.resolve({ ok: true });
      }),
    ).toEqual({ ok: true });
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: undefined });

    expect(
      await account.withSession(() => Promise.resolve({ ok: false, reason: 'unauthorized' })),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(
      await account.withSession((token) => {
        tokens.push(token);
        return Promise.resolve({ ok: true });
      }),
    ).toBeUndefined();
    expect(tokens).toEqual(['session-1']);
  });

  it('keeps a new Session when a request with an old one finds it ended', async () => {
    const { account } = await signedIn();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const lent = account.withSession(async () => {
      await held;
      return { ok: false, reason: 'unauthorized' } as const;
    });
    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    release();
    await lent;

    expect(account.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('keeps the Session when the check finds no server, and shows no problem', async () => {
    const { account, api, sessions, time } = await signedIn();
    time.advance(60 * 60_000);
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.refresh();
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toEqual(anna);

    await account.refresh();
    expect(api.calls.filter((call) => call === 'me')).toHaveLength(5);
  });

  it('signs out on this device and tells the server', async () => {
    const { account, api, sessions } = await signedIn();

    await account.signOut();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessionTokens).toEqual([]);
    expect(api.accounts).toEqual(['anna@mail.com']);
  });

  it('signs out at once offline, and tells the server at the next refresh', async () => {
    const { account, api, sessions } = await signedIn();
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.signOut();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessionTokens).toEqual(['session-1']);

    await account.refresh();
    expect(api.sessionTokens).toEqual([]);
    await account.refresh();
    expect(api.calls.filter((call) => call === 'signOut')).toHaveLength(5);
  });

  it('signs out at once while a check is in flight, and the check changes nothing after', async () => {
    const { account, api, sessions, time } = await signedIn();
    time.advance(60 * 60_000);
    const release = api.hold();

    const checking = account.refresh();
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: undefined });
    await account.signOut();
    release();
    await checking;

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
  });

  it('checks the Session in the background, so deleting goes ahead at once and the check changes nothing after', async () => {
    const { account, api, sessions, time } = await signedIn();
    time.advance(60 * 60_000);
    const release = api.hold();

    const checking = account.refresh();
    await account.delete();
    release();
    await checking;

    expect(api.accounts).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
  });

  it('checks the Session once at a time, however often it is asked', async () => {
    const { account, api, time } = await signedIn();
    time.advance(60 * 60_000);
    const release = api.hold();

    const checking = [account.refresh(), account.refresh()];
    release();
    await Promise.all(checking);

    expect(api.calls.filter((call) => call === 'me')).toHaveLength(1);
  });

  it('keeps the problem shown while it checks the Session', async () => {
    const { account, api, time } = await signedIn();
    api.failNext('offline', 'offline', 'offline', 'offline');
    await account.signOutEverywhere();
    time.advance(60 * 60_000);

    await account.refresh();

    expect(api.calls).toContain('me');
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'offline' });
  });

  it('signs out everywhere, ending every Session of the Account', async () => {
    const { account, api, sessions } = await signedIn();
    await api.requestCode(anna.email);
    await api.verifyCode(anna.email, '100002');
    expect(api.sessionTokens).toEqual(['session-1', 'session-2']);

    await account.signOutEverywhere();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessionTokens).toEqual([]);
  });

  it('names which of the requests that end the Session is in flight', async () => {
    const { account, api } = await signedIn();
    // Signing out everywhere fails, so the Session is still on for deleting.
    api.failNext('unexpected');

    let release = api.hold();
    const endingEverywhere = account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: 'signOutEverywhere' });
    release();
    await endingEverywhere;

    release = api.hold();
    const deleting = account.delete();
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: 'delete' });
    release();
    await deleting;
    expect(account.state).toMatchObject({ status: 'signed-out', inFlight: undefined });
  });

  it('deletes the Account and ends signed out', async () => {
    const { account, api, sessions } = await signedIn();

    await account.delete();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(api.accounts).toEqual([]);
    expect(api.sessionTokens).toEqual([]);
  });

  it('stays signed in when signing out everywhere or deleting finds no server, and says so', async () => {
    const { account, api, sessions } = await signedIn();
    api.failNext(...Array<'offline'>(8).fill('offline'));

    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'offline' });
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'offline' });

    expect(await sessions.read()).toEqual(anna);
    expect(api.accounts).toEqual(['anna@mail.com']);
  });

  it('stays signed in when the backend answers signing out everywhere or deleting unexpectedly, and says so', async () => {
    const { account, api } = await signedIn();
    api.failNext('unexpected', 'unexpected');

    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'unexpected' });
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'unexpected' });
    expect(api.accounts).toEqual(['anna@mail.com']);
  });

  it('tells the server of a sign-out no more once it answers it unexpectedly', async () => {
    const { account, api } = await signedIn();
    api.failNext('unexpected');

    await account.signOut();
    await account.refresh();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.calls.filter((call) => call === 'signOut')).toHaveLength(1);
  });

  it('signs out quietly when deleting finds the Session ended', async () => {
    const { account, api } = await signedIn();
    api.endSessions();

    await account.delete();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
  });
});

describe('the Account signs in with Google', () => {
  it('from signed out, through the sheet, and stays signed in', async () => {
    const { account, api, googleSheet, sessions, open } = await setup();
    googleSheet.signsIn('Anna@Mail.com');

    await account.signInWithGoogle();

    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.calls).toEqual(['signInWithGoogle']);
    expect(api.accounts).toEqual(['anna@mail.com']);
    expect(await sessions.read()).toEqual({ token: 'session-1', email: 'anna@mail.com' });
    const reopened = await open();
    expect(reopened.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('reaches the Account a Sign-in code made, and a code reaches the one Google made', async () => {
    const { account, api, googleSheet } = await signedIn();
    await account.signOut();
    googleSheet.signsIn(anna.email);

    await account.signInWithGoogle();
    expect(account.state).toMatchObject({ status: 'signed-in', email: anna.email });
    expect(api.accounts).toEqual([anna.email]);

    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in', email: anna.email });
    expect(api.accounts).toEqual([anna.email]);
  });

  it('stays signed out with no problem when the reader cancels the sheet', async () => {
    const { account, api, googleSheet } = await setup();
    googleSheet.cancels();

    await account.signInWithGoogle();

    expect(googleSheet.shown).toBe(1);
    expect(api.calls).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
  });

  it('says it is offline when the sheet finds no network, and signs in once it does', async () => {
    const { account, googleSheet } = await setup();
    googleSheet.fails('offline');
    await account.signInWithGoogle();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'offline',
    });

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: undefined });
  });

  it('says it is offline when no try with the token reaches the server', async () => {
    const { account, api, googleSheet } = await setup();
    googleSheet.signsIn(anna.email);
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.signInWithGoogle();

    expect(api.calls).toEqual(Array<string>(4).fill('signInWithGoogle'));
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'offline',
    });
  });

  it('says the sign-in was refused when the backend refuses the token, and makes no Account', async () => {
    const { account, api, googleSheet } = await setup();
    googleSheet.signsIn(anna.email, { verified: false });

    await account.signInWithGoogle();

    expect(api.calls).toEqual(['signInWithGoogle']);
    expect(api.accounts).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'refused',
    });
  });

  it('says there were too many requests when the backend holds the sign-in back', async () => {
    const { account, api, googleSheet } = await setup();
    googleSheet.signsIn(anna.email);
    api.failNext('too-many-requests');

    await account.signInWithGoogle();

    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'too-many-requests' });
  });

  it('says something went wrong when the sheet fails otherwise', async () => {
    const { account, googleSheet } = await setup();
    googleSheet.fails('unexpected');

    await account.signInWithGoogle();

    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'unexpected' });
  });

  it('shows the sign-in in flight while the sheet is up, and starts no other request meanwhile', async () => {
    const { account, api, googleSheet } = await setup();
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    googleSheet.signIn = async () => {
      await pending;
      return { ok: true, idToken: 'not-a-token' };
    };

    const signingIn = account.signInWithGoogle();
    expect(account.state).toMatchObject({ status: 'signed-out', inFlight: 'signInWithGoogle' });

    await account.requestCode(anna.email);
    await account.signInWithGoogle();
    expect(api.calls).toEqual([]);

    release();
    await signingIn;
    expect(account.state).toMatchObject({ inFlight: undefined, problem: 'refused' });
  });

  it('opens no sheet once a Sign-in code is sent, nor while signed in', async () => {
    const { account, googleSheet } = await setup();
    await account.requestCode(anna.email);
    await account.signInWithGoogle();
    expect(googleSheet.shown).toBe(0);

    await account.verifyCode('100001');
    await account.signInWithGoogle();
    expect(googleSheet.shown).toBe(0);
  });

  it('signs out, signs out everywhere and deletes the Account as after a Sign-in code', async () => {
    const { account, api, googleSheet, sessions } = await setup();
    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();

    await account.signOut();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessionTokens).toEqual([]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.sessionTokens).toEqual([]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.accounts).toEqual([]);
  });

  it('forgets the Google sign-in whenever the Session ends, and revokes it when the Account is deleted', async () => {
    const { account, api, googleSheet, time } = await setup();
    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    expect(googleSheet.forgotten).toEqual([]);

    await account.signOut();
    expect(googleSheet.forgotten).toEqual([{ revoke: false }]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.signOutEverywhere();
    expect(googleSheet.forgotten).toEqual([{ revoke: false }, { revoke: false }]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    api.endSessions();
    time.advance(60 * 60_000);
    await account.refresh();
    expect(account.state).toMatchObject({ status: 'signed-out' });
    expect(googleSheet.forgotten).toEqual([
      { revoke: false },
      { revoke: false },
      { revoke: false },
    ]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.delete();
    expect(googleSheet.forgotten).toEqual([
      { revoke: false },
      { revoke: false },
      { revoke: false },
      { revoke: true },
    ]);
  });

  it('ends the Session even when forgetting the Google sign-in fails', async () => {
    const { account, api, googleSheet, sessions } = await setup();
    googleSheet.failsToForget();
    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();

    await account.signOut();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.delete();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.accounts).toEqual([]);
  });
});

describe('the Account tries a request again', () => {
  it('on no answer and a server error, waiting twice as long each time', async () => {
    const { account, api, delays } = await setup();
    api.failNext('offline', 'server-error', 'offline');

    await account.requestCode('anna@mail.com');

    expect(api.calls).toEqual(['requestCode', 'requestCode', 'requestCode', 'requestCode']);
    expect(delays).toEqual([750, 1_500, 3_000]);
    expect(account.state).toMatchObject({ status: 'code-sent', problem: undefined });
  });

  it('at most 3 times', async () => {
    const { account, api, delays } = await setup();
    api.failNext('offline', 'offline', 'offline', 'offline', 'offline');

    await account.requestCode('anna@mail.com');

    expect(api.calls).toHaveLength(4);
    expect(delays).toHaveLength(3);
    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'offline' });
  });

  it('with jitter: each wait is drawn between half and all of its longest', async () => {
    const early = await setup({ random: randomOf(0) });
    early.api.failNext('offline', 'offline', 'offline');
    await early.account.requestCode('anna@mail.com');

    const late = await setup({ random: randomOf(0.75) });
    late.api.failNext('offline', 'offline', 'offline');
    await late.account.requestCode('anna@mail.com');

    expect(early.delays).toEqual([500, 1_000, 2_000]);
    expect(late.delays).toEqual([875, 1_750, 3_500]);
  });

  it('never on too many requests: a limit holds longer than the tries wait, and a spent code for good', async () => {
    const { account, api, delays } = await setup();
    api.failNext('too-many-requests');

    await account.requestCode('anna@mail.com');

    expect(api.calls).toEqual(['requestCode']);
    expect(delays).toEqual([]);
    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'too-many-requests' });
  });

  it('never on an answer the request never expects: no try changes it', async () => {
    const { account, api, delays } = await setup();
    api.failNext('unexpected');

    await account.requestCode('anna@mail.com');

    expect(api.calls).toEqual(['requestCode']);
    expect(delays).toEqual([]);
  });

  it('never on a wrong code or a Session the server has ended', async () => {
    const { account, api, delays, time } = await signedIn();
    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('999999');
    await account.verifyCode('100002');
    api.endSessions();
    time.advance(60 * 60_000);

    await account.refresh();

    expect(api.calls).toEqual([
      'requestCode',
      'verifyCode',
      'signOut',
      'requestCode',
      'verifyCode',
      'verifyCode',
      'me',
    ]);
    expect(delays).toEqual([]);
  });
});

describe('the Account and the user state', () => {
  it('leaves the user state as it was through signing in, out and deleting', async () => {
    const userState = createMemoryUserStatePort(
      new Map([
        ['favorites.w-1', '"2026-10-01T09:00:00.000Z"'],
        ['settings.theme', '"dark"'],
      ]),
    );
    const { account, googleSheet } = await setup({ port: userState });
    const before = await userState.list('');

    await account.requestCode(anna.email);
    await account.verifyCode('100001');
    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    await account.signOutEverywhere();
    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.delete();

    expect(await userState.list('')).toEqual(before);
  });
});

describe('the Account on a fresh install', () => {
  /** The app deleted after signing in, and installed again: the Session outlived the user state. */
  async function reinstalled() {
    const parts = await signedIn();
    const account = await parts.open(await openUserState({ port: createMemoryUserStatePort() }));
    return { ...parts, account };
  }

  it('forgets a Session left from an earlier install and tells the server', async () => {
    const { account, api, googleSheet, sessions } = await reinstalled();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(googleSheet.forgotten).toEqual([{ revoke: false }]);
    await vi.waitFor(() => {
      expect(api.sessionTokens).toEqual([]);
    });
  });

  it('forgets such a Session once: a Session kept after it holds at the next launch', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const { open, sessions } = await signedIn();
    await open(userState);

    await sessions.keep(anna);
    const account = await open(userState);

    expect(account.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('forgets such a Session on the device when the server cannot be told, and tells it at a refresh', async () => {
    const { api, open, sessions } = await signedIn();
    api.failNext('offline', 'offline', 'offline', 'offline');

    const account = await open(await openUserState({ port: createMemoryUserStatePort() }));
    await vi.waitFor(() => {
      expect(api.calls.filter((call) => call === 'signOut')).toHaveLength(4);
    });

    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessionTokens).toEqual(['session-1']);

    await account.refresh();
    expect(api.sessionTokens).toEqual([]);
  });

  it('keeps a Session signed in on a fresh install for the next launch', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const { open } = await setup();
    const first = await open(userState);
    await first.requestCode(anna.email);
    await first.verifyCode('100001');

    const account = await open(userState);

    expect(account.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('keeps the Session of an install upgraded from a version before the marker', async () => {
    const { api, open, sessions } = await setup({ kept: anna });
    const upgraded = createMemoryUserStatePort(
      new Map([
        ['schema.version', '4'],
        ['favorites.w-1', '"2026-10-01T09:00:00.000Z"'],
      ]),
    );

    const account = await open(await openUserState({ port: upgraded }));

    expect(account.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
    expect(await sessions.read()).toEqual(anna);
    expect(api.calls).toEqual([]);
  });
});
