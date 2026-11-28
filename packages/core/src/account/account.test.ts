import { describe, expect, it, vi } from 'vitest';

import {
  createMemorySessionStore,
  openAccount,
  type AnalyticsPort,
  type FeatureSwitch,
  type KeptSession,
  type Random,
  type Schedule,
  type SessionStore,
  type UserStatePort,
} from '../index';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
} from '../testing';
import { fakeClock, randomOf, analyticsInto, settle } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

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
  analytics,
  on = ['analytics'],
  sessions = createMemorySessionStore(kept),
}: {
  kept?: KeptSession;
  sessions?: SessionStore;
  random?: Random;
  port?: UserStatePort;
  analytics?: AnalyticsPort;
  on?: readonly FeatureSwitch[];
} = {}) {
  const api = createFakeBackend();
  const googleSheet = createFakeGoogleSignInSheet();
  const appleSheet = createFakeAppleSignInSheet();
  const time = fakeClock();
  const later = atOnce();
  const installed = await installedUserState(port);
  /** Launches the app: over the user state given, or the one this install kept. */
  const open = async (userState = installed) =>
    openAccount({
      backend: api.backend,
      edition: { id: 'uk', isFeatureEnabled: (feature) => on.includes(feature) },
      googleSheet,
      appleSheet,
      sessions,
      userState,
      clock: time.clock,
      schedule: later.schedule,
      random,
      ...(analytics === undefined ? {} : { analytics: analyticsInto(analytics) }),
    });
  const account = await open();
  return { account, api, googleSheet, appleSheet, sessions, time, delays: later.delays, open };
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
    expect(api.account.sentCodes).toEqual([{ email: 'anna@mail.com', code: '100001' }]);
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
    expect(api.account.accounts).toEqual(['anna@mail.com']);
    expect(await sessions.read()).toEqual({ token: 'session-1', email: 'anna@mail.com' });

    const reopened = await open();
    expect(reopened.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it.each(['', '   '])('sends nothing when no email was typed (%j), and says so', async (typed) => {
    const { account, api } = await setup();

    await account.requestCode(typed);

    expect(api.calls).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'no-email',
    });
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
    expect(api.account.sentCodes).toHaveLength(1);

    time.advance(1);
    await account.resendCode();
    expect(api.account.sentCodes).toEqual([
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
    expect(api.account.sentCodes.map(({ email }) => email)).toEqual([
      'ana@mail.com',
      'anna@mail.com',
    ]);
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

    expect(api.calls).toEqual(['account.requestCode']);
    expect(account.state).toBe(sent);

    await account.verifyCode(' 100001 ');
    expect(account.state).toMatchObject({ status: 'signed-in' });
  });

  it('says when the code has expired, and a new code signs in', async () => {
    const { account, api, time } = await setup();
    await account.requestCode('anna@mail.com');
    api.account.expireCodes();

    await account.verifyCode('100001');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: 'code-expired' });

    time.advance(60_000);
    await account.resendCode();
    expect(account.state).toMatchObject({ problem: undefined });
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in' });
  });

  it('says the code is spent after its last wrong try, and only a new code signs in', async () => {
    const { account, time } = await setup();
    await account.requestCode('anna@mail.com');
    for (let tries = 0; tries < 5; tries++) await account.verifyCode('999999');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: 'code-spent' });

    await account.verifyCode('100001');
    expect(account.state).toMatchObject({ status: 'code-sent', problem: 'code-spent' });

    time.advance(60_000);
    await account.resendCode();
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in' });
  });

  it('says there were too many requests when the backend holds the request back', async () => {
    const { account, api } = await setup();
    api.failNext('too-many-requests');

    await account.requestCode('anna@mail.com');

    expect(api.account.sentCodes).toEqual([]);
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

    expect(api.calls).toEqual(['account.requestCode']);
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
async function signedIn(options: Parameters<typeof setup>[0] = {}) {
  const parts = await setup(options);
  await parts.account.requestCode(anna.email);
  await parts.account.verifyCode('100001');
  return parts;
}

/** A Session store whose `failing` step is refused, as a locked Keychain refuses it. */
function sessionStoreFailingTo(failing: 'keep' | 'forget' | 'keepUntold'): SessionStore {
  return {
    ...createMemorySessionStore(),
    [failing]: () => Promise.reject(new Error(`cannot ${failing} the Session`)),
  };
}

describe('the Account signed in', () => {
  it('signs out even when the Session fails to be forgotten on the device', async () => {
    const { account, api } = await signedIn({ sessions: sessionStoreFailingTo('forget') });

    await account.signOut();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.account.sessionTokens).toEqual([]);
  });

  it('settles signed out after a delete even when the Session fails to be forgotten', async () => {
    const { account, api } = await signedIn({ sessions: sessionStoreFailingTo('forget') });

    await account.delete();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.account.accounts).toEqual([]);
  });

  it('signs the new Session out on the server when it fails to be kept on the device', async () => {
    const { account, api } = await setup({ sessions: sessionStoreFailingTo('keep') });
    await account.requestCode(anna.email);

    await expect(account.verifyCode('100001')).rejects.toThrow('cannot keep the Session');

    expect(account.state).toMatchObject({ status: 'code-sent', inFlight: undefined });
    expect(api.calls).toContain('account.signOut');
    expect(api.account.sessionTokens).toEqual([]);
  });

  it('checks the Session at most once an hour', async () => {
    const { account, api, time } = await signedIn();

    await account.refresh();
    expect(api.calls).not.toContain('account.me');

    time.advance(59 * 60_000);
    await account.refresh();
    expect(api.calls).not.toContain('account.me');

    time.advance(60_000);
    await account.refresh();
    await account.refresh();
    expect(api.calls.filter((call) => call === 'account.me')).toHaveLength(1);
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
  });

  it('checks a Session kept from before at the first refresh', async () => {
    const { account, api } = await setup({ kept: anna });
    api.account.endSessions();

    await account.refresh();

    expect(api.calls).toEqual(['account.me']);
    expect(account.state).toMatchObject({ status: 'signed-out' });
  });

  it('signs out quietly when the server says the Session has ended', async () => {
    const { account, api, sessions, time } = await signedIn();
    api.account.endSessions();
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
    expect(api.calls.filter((call) => call === 'account.me')).toHaveLength(5);
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
    expect(api.account.sessionTokens).toEqual([]);
    expect(api.account.accounts).toEqual(['anna@mail.com']);
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
    expect(api.account.sessionTokens).toEqual(['session-1']);

    await account.refresh();
    expect(api.account.sessionTokens).toEqual([]);
    await account.refresh();
    expect(api.calls.filter((call) => call === 'account.signOut')).toHaveLength(5);
  });

  it('keeps a sign-out the server has not heard of for the next launch, and forgets it once told', async () => {
    const { account, api, sessions, open } = await signedIn();
    api.failNext('offline', 'offline', 'offline', 'offline');
    await account.signOut();
    expect(await sessions.untold()).toEqual(['session-1']);

    // The app is killed and launched again: the Session is still to be told.
    const relaunched = await open();
    expect(relaunched.state).toMatchObject({ status: 'signed-out' });
    await relaunched.refresh();

    expect(api.account.sessionTokens).toEqual([]);
    expect(await sessions.untold()).toEqual([]);
  });

  it('signs out and tells the server even when the sign-out fails to be kept on the device', async () => {
    const { account, api } = await signedIn({ sessions: sessionStoreFailingTo('keepUntold') });

    await account.signOut();

    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.account.sessionTokens).toEqual([]);
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

    expect(api.account.accounts).toEqual([]);
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

    expect(api.calls.filter((call) => call === 'account.me')).toHaveLength(1);
  });

  it('keeps the problem shown while it checks the Session', async () => {
    const { account, api, time } = await signedIn();
    api.failNext('offline', 'offline', 'offline', 'offline');
    await account.signOutEverywhere();
    time.advance(60 * 60_000);

    await account.refresh();

    expect(api.calls).toContain('account.me');
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'offline' });
  });

  it('signs out everywhere, ending every Session of the Account', async () => {
    const { account, api, sessions } = await signedIn();
    await api.backend.account.requestCode({ email: anna.email, editionId: 'uk' });
    await api.backend.account.verifyCode({ email: anna.email, code: '100002' });
    expect(api.account.sessionTokens).toEqual(['session-1', 'session-2']);

    await account.signOutEverywhere();

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
    expect(await sessions.read()).toBeUndefined();
    expect(api.account.sessionTokens).toEqual([]);
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
    expect(api.account.accounts).toEqual([]);
    expect(api.account.sessionTokens).toEqual([]);
  });

  it('stays signed in when signing out everywhere or deleting finds no server, and says so', async () => {
    const { account, api, sessions } = await signedIn();
    api.failNext(...Array<'offline'>(8).fill('offline'));

    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'offline' });
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'offline' });

    expect(await sessions.read()).toEqual(anna);
    expect(api.account.accounts).toEqual(['anna@mail.com']);
  });

  it('stays signed in when the backend answers signing out everywhere or deleting unexpectedly, and says so', async () => {
    const { account, api } = await signedIn();
    api.failNext('unexpected', 'unexpected');

    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'unexpected' });
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'unexpected' });
    expect(api.account.accounts).toEqual(['anna@mail.com']);
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
    expect(api.calls.filter((call) => call === 'account.signOut')).toHaveLength(1);
  });

  it('signs out quietly when deleting finds the Session ended', async () => {
    const { account, api } = await signedIn();
    api.account.endSessions();

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
    expect(api.calls).toEqual(['account.signInWithGoogle']);
    expect(api.account.accounts).toEqual(['anna@mail.com']);
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
    expect(api.account.accounts).toEqual([anna.email]);

    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in', email: anna.email });
    expect(api.account.accounts).toEqual([anna.email]);
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

    expect(api.calls).toEqual(Array<string>(4).fill('account.signInWithGoogle'));
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

    expect(api.calls).toEqual(['account.signInWithGoogle']);
    expect(api.account.accounts).toEqual([]);
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
    const release = googleSheet.holds();
    googleSheet.signsIn(anna.email, { verified: false });

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
    expect(api.account.sessionTokens).toEqual([]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.account.sessionTokens).toEqual([]);

    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.account.accounts).toEqual([]);
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
    api.account.endSessions();
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
    expect(api.account.accounts).toEqual([]);
  });
});

describe('the Account signs in with Apple', () => {
  it('from signed out, through the sheet, and stays signed in', async () => {
    const { account, api, appleSheet, sessions, open } = await setup();
    appleSheet.signsIn('Anna@Mail.com');

    await account.signInWithApple();

    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.calls).toEqual(['account.signInWithApple']);
    expect(api.account.accounts).toEqual(['anna@mail.com']);
    expect(await sessions.read()).toEqual({ token: 'session-1', email: 'anna@mail.com' });
    const reopened = await open();
    expect(reopened.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('signs a private relay address in like any email', async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.signsIn('abc123@privaterelay.appleid.com');

    await account.signInWithApple();

    expect(account.state).toMatchObject({
      status: 'signed-in',
      email: 'abc123@privaterelay.appleid.com',
    });
    expect(api.account.accounts).toEqual(['abc123@privaterelay.appleid.com']);
  });

  it('reaches the Account a Sign-in code or Google made, and either reaches the one Apple made', async () => {
    const { account, api, appleSheet, googleSheet } = await signedIn();
    await account.signOut();
    appleSheet.signsIn(anna.email);

    await account.signInWithApple();
    expect(account.state).toMatchObject({ status: 'signed-in', email: anna.email });
    expect(api.account.accounts).toEqual([anna.email]);

    await account.signOut();
    googleSheet.signsIn(anna.email);
    await account.signInWithGoogle();
    expect(account.state).toMatchObject({ status: 'signed-in', email: anna.email });

    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in', email: anna.email });
    expect(api.account.accounts).toEqual([anna.email]);
  });

  it('stays signed out with no problem when the reader cancels the sheet', async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.cancels();

    await account.signInWithApple();

    expect(appleSheet.shown).toBe(1);
    expect(api.calls).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
  });

  it('says the sign-in was refused when the backend refuses the token, and the device stays signed out', async () => {
    const { account, api, appleSheet, sessions } = await setup();
    appleSheet.signsIn(anna.email, { expired: true });

    await account.signInWithApple();

    expect(api.calls).toEqual(['account.signInWithApple']);
    expect(api.account.accounts).toEqual([]);
    expect(await sessions.read()).toBeUndefined();
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: 'refused',
    });
  });

  it('says the sign-in was refused when the backend does not offer Sign in with Apple', async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.signsIn(anna.email);
    // The switch turned off remotely, or an Edition without it.
    api.failNext({ procedure: 'account.signInWithApple', reason: 'not-found' });

    await account.signInWithApple();

    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'refused' });
  });

  it('says it is offline when the sheet finds no network, or when no try reaches the server', async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.fails('offline');
    await account.signInWithApple();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'offline' });

    appleSheet.signsIn(anna.email);
    api.failNext('offline', 'offline', 'offline', 'offline');
    await account.signInWithApple();
    expect(api.calls).toEqual(Array<string>(4).fill('account.signInWithApple'));
    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'offline' });
  });

  it('shows the sign-in in flight while the sheet is up, and starts no other request meanwhile', async () => {
    const { account, api, appleSheet, googleSheet } = await setup();
    const release = appleSheet.holds();
    appleSheet.signsIn(anna.email);

    const signingIn = account.signInWithApple();
    expect(account.state).toMatchObject({ status: 'signed-out', inFlight: 'signInWithApple' });

    await account.requestCode(anna.email);
    await account.signInWithGoogle();
    expect(api.calls).toEqual([]);
    expect(googleSheet.shown).toBe(0);

    release();
    await signingIn;
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: undefined });
  });

  it('opens no sheet once a Sign-in code is sent, nor while signed in', async () => {
    const { account, appleSheet } = await setup();
    await account.requestCode(anna.email);
    await account.signInWithApple();
    expect(appleSheet.shown).toBe(0);

    await account.verifyCode('100001');
    await account.signInWithApple();
    expect(appleSheet.shown).toBe(0);
  });

  it('signs out, signs out everywhere and deletes the Account as after a Sign-in code', async () => {
    const { account, api, appleSheet, googleSheet, sessions } = await setup();
    appleSheet.signsIn(anna.email);
    await account.signInWithApple();

    await account.signOut();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.account.sessionTokens).toEqual([]);
    // The Core doesn't know how the Session started, so Google's sign-in is forgotten too.
    expect(googleSheet.forgotten).toEqual([{ revoke: false }]);

    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    await account.signOutEverywhere();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.account.sessionTokens).toEqual([]);

    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    appleSheet.authorizes();
    await account.delete();
    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(api.account.accounts).toEqual([]);
  });
});

describe('the Account deletes an Account with Sign in with Apple', () => {
  it("sends a fresh authorization code from Apple's sheet with the deletion", async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    appleSheet.authorizes();

    await account.delete();

    expect(appleSheet.authorizations).toBe(1);
    expect(api.account.deletions).toEqual([
      { email: 'anna@mail.com', appleAuthorizationCode: 'apple-code:1' },
    ]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
  });

  it('asks Apple when the Account has Sign in with Apple, whatever signed this device in', async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100001');
    appleSheet.authorizes();

    await account.delete();

    expect(api.account.deletions).toEqual([
      { email: 'anna@mail.com', appleAuthorizationCode: 'apple-code:1' },
    ]);
  });

  it("keeps the Account, with no problem, when the reader cancels Apple's sheet", async () => {
    const { account, api, appleSheet, sessions } = await setup();
    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    appleSheet.cancelsAuthorization();

    await account.delete();

    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
    expect(api.calls).not.toContain('account.delete');
    expect(api.account.accounts).toEqual(['anna@mail.com']);
    expect(await sessions.read()).toMatchObject({ email: 'anna@mail.com' });
  });

  it.each(['unavailable', 'unexpected'] as const)(
    "deletes without a code when Apple's sheet is %s",
    async (reason) => {
      const { account, api, appleSheet } = await setup();
      appleSheet.signsIn(anna.email);
      await account.signInWithApple();
      appleSheet.failsAuthorization(reason);

      await account.delete();

      expect(api.account.deletions).toEqual([
        { email: 'anna@mail.com', appleAuthorizationCode: undefined },
      ]);
      expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    },
  );

  it("shows the deletion in flight while Apple's sheet is up", async () => {
    const { account, appleSheet } = await setup();
    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    appleSheet.authorizes();

    const deleting = account.delete();
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: 'delete' });
    await deleting;
    expect(account.state).toMatchObject({ status: 'signed-out', inFlight: undefined });
  });

  it("never shows Apple's sheet for an Account without Sign in with Apple", async () => {
    const { account, api, appleSheet } = await signedIn();

    await account.delete();

    expect(appleSheet.authorizations).toBe(0);
    expect(api.account.deletions).toEqual([
      { email: 'anna@mail.com', appleAuthorizationCode: undefined },
    ]);
  });

  it('stays signed in and says so when the Account cannot be read before the deletion', async () => {
    const { account, api, appleSheet } = await setup();
    appleSheet.signsIn(anna.email);
    await account.signInWithApple();
    api.failNext({ reason: 'unexpected', procedure: 'account.me' });

    await account.delete();

    expect(appleSheet.authorizations).toBe(0);
    expect(account.state).toMatchObject({ status: 'signed-in', problem: 'unexpected' });
    expect(api.account.accounts).toEqual(['anna@mail.com']);
  });
});

describe('the Account tries a request again', () => {
  it('on no answer and a server error, waiting twice as long each time', async () => {
    const { account, api, delays } = await setup();
    api.failNext('offline', 'server-error', 'offline');

    await account.requestCode('anna@mail.com');

    expect(api.calls).toEqual([
      'account.requestCode',
      'account.requestCode',
      'account.requestCode',
      'account.requestCode',
    ]);
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

    expect(api.calls).toEqual(['account.requestCode']);
    expect(delays).toEqual([]);
    expect(account.state).toMatchObject({ status: 'signed-out', problem: 'too-many-requests' });
  });

  it('never on an answer the request never expects: no try changes it', async () => {
    const { account, api, delays } = await setup();
    api.failNext('unexpected');

    await account.requestCode('anna@mail.com');

    expect(api.calls).toEqual(['account.requestCode']);
    expect(delays).toEqual([]);
  });

  it('never on a wrong code or a Session the server has ended', async () => {
    const { account, api, delays, time } = await signedIn();
    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('999999');
    await account.verifyCode('100002');
    api.account.endSessions();
    time.advance(60 * 60_000);

    await account.refresh();

    expect(api.calls).toEqual([
      'account.requestCode',
      'account.verifyCode',
      'account.signOut',
      'account.requestCode',
      'account.verifyCode',
      'account.verifyCode',
      'account.me',
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
      expect(api.account.sessionTokens).toEqual([]);
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
      expect(api.calls.filter((call) => call === 'account.signOut')).toHaveLength(4);
    });

    expect(account.state).toMatchObject({ status: 'signed-out', problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.account.sessionTokens).toEqual(['session-1']);

    await account.refresh();
    expect(api.account.sessionTokens).toEqual([]);
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

describe('the Account and Analytics', () => {
  /** A port that keeps the events that reached it. */
  function fakePort() {
    const events: unknown[][] = [];
    const port: AnalyticsPort = {
      track: (event, properties) => void events.push([event, properties]),
      stop: () => undefined,
    };
    return { port, events };
  }

  it('tells the port of each sign-in with its Sign-in method, and of no request that fails', async () => {
    const { port, events } = fakePort();
    const { account, googleSheet, appleSheet } = await setup({ analytics: port });

    await account.requestCode('anna@mail.com');
    await account.verifyCode('999999');
    expect(events).toEqual([]);
    await account.verifyCode('100001');
    await account.signOut();
    googleSheet.signsIn('anna@mail.com');
    await account.signInWithGoogle();
    await account.signOut();
    appleSheet.signsIn('anna@mail.com');
    await account.signInWithApple();

    expect(events).toEqual([
      ['signedIn', { method: 'signInCode' }],
      ['signedIn', { method: 'google' }],
      ['signedIn', { method: 'apple' }],
    ]);
  });

  it('tells nothing while the reader does not share anonymous statistics', async () => {
    const { port, events } = fakePort();
    const userStatePort = createMemoryUserStatePort();
    const userState = await installedUserState(userStatePort);
    await userState.write(userStateRecords.shareCounters.change(false));
    const { account } = await setup({ analytics: port, port: userStatePort });

    await account.requestCode('anna@mail.com');
    await account.verifyCode('100001');

    expect(account.state).toMatchObject({ status: 'signed-in' });
    expect(events).toEqual([]);
  });

  it('tells nothing while the Edition switches Analytics off', async () => {
    const { port, events } = fakePort();
    const { account } = await setup({ analytics: port, on: [] });

    await account.requestCode('anna@mail.com');
    await account.verifyCode('100001');

    expect(account.state).toMatchObject({ status: 'signed-in' });
    expect(events).toEqual([]);
  });
});

describe('the Account guards each action by its status', () => {
  it('sends nothing for a new email once a code is sent or while signed in', async () => {
    const { account, api } = await setup();
    await account.requestCode('anna@mail.com');
    const sent = account.state;

    await account.requestCode('bob@mail.com');
    expect(account.state).toBe(sent);
    expect(api.calls).toEqual(['account.requestCode']);

    await account.verifyCode('100001');
    const signedInState = account.state;
    await account.requestCode('bob@mail.com');
    expect(account.state).toBe(signedInState);
    expect(api.calls).toEqual(['account.requestCode', 'account.verifyCode']);
  });

  it('leaves a Sign-in code in flight as it is when an empty email is typed meanwhile', async () => {
    const { account, api } = await setup();
    const release = api.hold();

    const sending = account.requestCode('anna@mail.com');
    await account.requestCode('');
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: 'requestCode',
      problem: undefined,
    });
    release();
    await sending;
  });

  it('resends, verifies and goes back to the email only once a code is sent', async () => {
    const { account, api, time } = await setup();
    time.advance(60_000);
    const out = account.state;

    await account.resendCode();
    await account.verifyCode('100001');
    account.changeEmail();

    expect(api.calls).toEqual([]);
    expect(account.state).toBe(out);

    await account.requestCode('anna@mail.com');
    await account.verifyCode('100001');
    const inState = account.state;
    time.advance(60_000);

    await account.resendCode();
    await account.verifyCode('100001');
    account.changeEmail();

    expect(api.calls).toEqual(['account.requestCode', 'account.verifyCode']);
    expect(account.state).toBe(inState);
  });

  it('keeps the problem shown when signed out and the email is changed', async () => {
    const { account } = await setup();
    await account.requestCode('not an email');
    const refused = account.state;

    account.changeEmail();

    expect(account.state).toBe(refused);
    expect(account.state).toMatchObject({ problem: 'invalid-email' });
  });

  it('does not go back to the email while the code is being checked', async () => {
    const { account, api } = await setup();
    await account.requestCode('anna@mail.com');
    const release = api.hold();

    const verifying = account.verifyCode('100001');
    account.changeEmail();
    expect(account.state).toMatchObject({ status: 'code-sent', inFlight: 'verifyCode' });
    release();
    await verifying;

    expect(account.state).toMatchObject({ status: 'signed-in' });
  });

  it('signs out, signs out everywhere, deletes and checks nothing while signed out', async () => {
    const { account, api, sessions } = await setup();
    const out = account.state;

    await account.signOut();
    await account.signOutEverywhere();
    await account.delete();
    await account.refresh();

    expect(api.calls).toEqual([]);
    expect(account.state).toBe(out);
    expect(await sessions.untold()).toEqual([]);
  });
});

describe('the Account and the sign-outs it keeps', () => {
  it('opens and tells nothing when the kept sign-outs fail to be read', async () => {
    const sessions: SessionStore = {
      ...createMemorySessionStore(),
      untold: () => Promise.reject(new Error('cannot read the sign-outs')),
    };
    const { account, api } = await setup({ sessions });

    await account.refresh();

    expect(account.state).toMatchObject({ status: 'signed-out' });
    expect(api.calls).toEqual([]);
  });

  it('tells the server of a Session once, even when it was signed out before already', async () => {
    const sessions = createMemorySessionStore(anna);
    await sessions.keepUntold([anna.token]);
    const { account, api } = await setup({ sessions });

    await account.signOut();
    await account.refresh();

    expect(api.calls.filter((call) => call === 'account.signOut')).toHaveLength(1);
    expect(await sessions.untold()).toEqual([]);
  });

  it('tells the server of a sign-out no more once it says the Session has ended already', async () => {
    const { account, api, sessions } = await signedIn();
    api.account.endSessions();

    await account.signOut();
    await account.refresh();

    expect(api.calls.filter((call) => call === 'account.signOut')).toHaveLength(1);
    expect(await sessions.untold()).toEqual([]);
  });

  it('tells the server nothing on a fresh install that kept no Session', async () => {
    const { open, api, sessions } = await setup();

    const account = await open(await openUserState({ port: createMemoryUserStatePort() }));
    await settle();

    expect(account.state).toMatchObject({ status: 'signed-out' });
    expect(api.calls).toEqual([]);
    expect(await sessions.untold()).toEqual([]);
  });
});

describe('the Account and answers that come after the Session ended', () => {
  it('stays signed out when deleting fails after a sign-out on the way', async () => {
    const { account, api } = await signedIn();
    api.failNext({ reason: 'unexpected', procedure: 'account.delete' });
    const release = api.hold();

    const deleting = account.delete();
    await account.signOut();
    release();
    await deleting;

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
  });

  it('keeps a new Session when the check of an old one finds it ended', async () => {
    const { account, api, time } = await signedIn();
    time.advance(60 * 60_000);
    const release = api.hold();

    const checking = account.refresh();
    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    expect(account.state).toMatchObject({ status: 'signed-in' });
    release();
    await checking;

    expect(account.state).toMatchObject({ status: 'signed-in', email: 'anna@mail.com' });
  });

  it('keeps the Session when the check is held back as too many requests', async () => {
    const { account, api, time } = await signedIn();
    time.advance(60 * 60_000);
    api.failNext('too-many-requests');

    await account.refresh();

    expect(api.calls).toContain('account.me');
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: undefined,
      problem: undefined,
    });
  });
});

describe('the Account when a sheet fails', () => {
  it('shows nothing in flight and no problem when the Google sheet throws', async () => {
    const { account, googleSheet } = await setup();
    vi.spyOn(googleSheet, 'signIn').mockRejectedValueOnce(new Error('the sheet broke'));

    await expect(account.signInWithGoogle()).rejects.toThrow('the sheet broke');

    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: undefined,
      problem: undefined,
    });
  });
});
