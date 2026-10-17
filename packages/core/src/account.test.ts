import { describe, expect, it } from 'vitest';

import {
  createFakeAccountApi,
  createMemorySessionStore,
  openAccount,
  createMemoryUserStatePort,
  type KeptSession,
  type Random,
  type Schedule,
} from './index';
import { fakeClock, randomOf } from './test-support';

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

async function setup({
  kept,
  random = randomOf(0.5),
}: { kept?: KeptSession; random?: Random } = {}) {
  const api = createFakeAccountApi();
  const sessions = createMemorySessionStore(kept);
  const time = fakeClock();
  const later = atOnce();
  const open = () =>
    openAccount({
      api,
      sessions,
      clock: time.clock,
      schedule: later.schedule,
      random,
    });
  const account = await open();
  return { account, api, sessions, time, delays: later.delays, open };
}

describe('the Account', () => {
  it('signs in from signed out through a Sign-in code sent to the email, and stays signed in', async () => {
    const { account, api, sessions, time, open } = await setup();
    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });

    await account.requestCode(' Anna@Mail.com ');
    expect(api.sentCodes).toEqual([{ email: 'anna@mail.com', code: '100001' }]);
    expect(account.state).toEqual({
      status: 'code-sent',
      email: 'anna@mail.com',
      resendAt: new Date(time.clock.now().getTime() + 60_000),
      triesLeft: undefined,
      inFlight: false,
      problem: undefined,
    });

    await account.verifyCode('100001');
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: false,
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
      inFlight: false,
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
    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });

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

  it('says there were too many requests when the limit holds through every try', async () => {
    const { account, api } = await setup();
    api.failNext(
      'too-many-requests',
      'too-many-requests',
      'too-many-requests',
      'too-many-requests',
    );

    await account.requestCode('anna@mail.com');

    expect(api.sentCodes).toEqual([]);
    expect(account.state).toEqual({
      status: 'signed-out',
      inFlight: false,
      problem: 'too-many-requests',
    });
  });

  it('says it is offline when no try reaches the server, and sends once it does', async () => {
    const { account, api } = await setup();
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.requestCode('anna@mail.com');
    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: 'offline' });

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
    expect(account.state).toMatchObject({ status: 'signed-out', inFlight: true });
    await account.requestCode('anna@mail.com');
    release();
    await sending;

    expect(api.calls).toEqual(['requestCode']);
    expect(account.state).toMatchObject({ status: 'code-sent', inFlight: false });
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
      inFlight: false,
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

    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
    expect(await sessions.read()).toBeUndefined();
  });

  it('keeps the Session when the check finds no server, and shows no problem', async () => {
    const { account, api, sessions, time } = await signedIn();
    time.advance(60 * 60_000);
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.refresh();
    expect(account.state).toEqual({
      status: 'signed-in',
      email: 'anna@mail.com',
      inFlight: false,
      problem: undefined,
    });
    expect(await sessions.read()).toEqual(anna);

    await account.refresh();
    expect(api.calls.filter((call) => call === 'me')).toHaveLength(5);
  });

  it('signs out on this device and tells the server', async () => {
    const { account, api, sessions } = await signedIn();

    await account.signOut();

    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessions).toEqual([]);
    expect(api.accounts).toEqual(['anna@mail.com']);
  });

  it('signs out at once offline, and tells the server at the next refresh', async () => {
    const { account, api, sessions } = await signedIn();
    api.failNext('offline', 'offline', 'offline', 'offline');

    await account.signOut();
    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessions).toEqual(['session-1']);

    await account.refresh();
    expect(api.sessions).toEqual([]);
    await account.refresh();
    expect(api.calls.filter((call) => call === 'signOut')).toHaveLength(5);
  });

  it('signs out at once while a check is in flight, and the check changes nothing after', async () => {
    const { account, api, sessions, time } = await signedIn();
    time.advance(60 * 60_000);
    const release = api.hold();

    const checking = account.refresh();
    expect(account.state).toMatchObject({ status: 'signed-in', inFlight: true });
    await account.signOut();
    release();
    await checking;

    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
    expect(await sessions.read()).toBeUndefined();
  });

  it('signs out everywhere, ending every Session of the Account', async () => {
    const { account, api, sessions } = await signedIn();
    await api.requestCode(anna.email);
    await api.verifyCode(anna.email, '100002');
    expect(api.sessions).toEqual(['session-1', 'session-2']);

    await account.signOutEverywhere();

    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.sessions).toEqual([]);
  });

  it('deletes the Account and ends signed out', async () => {
    const { account, api, sessions } = await signedIn();

    await account.delete();

    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
    expect(await sessions.read()).toBeUndefined();
    expect(api.accounts).toEqual([]);
    expect(api.sessions).toEqual([]);
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

  it('signs out quietly when deleting finds the Session ended', async () => {
    const { account, api } = await signedIn();
    api.endSessions();

    await account.delete();

    expect(account.state).toEqual({ status: 'signed-out', inFlight: false, problem: undefined });
  });
});

describe('the Account tries a request again', () => {
  it('on no answer, a server error and too many requests, waiting twice as long each time', async () => {
    const { account, api, delays } = await setup();
    api.failNext('offline', 'server-error', 'too-many-requests');

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
    const records = new Map([
      ['favorite:w-1', '{"addedAt":"2026-10-01T09:00:00.000Z"}'],
      ['setting:theme', '"dark"'],
    ]);
    const userState = createMemoryUserStatePort(records);
    const before = await userState.list('');
    const { account } = await signedIn();

    await account.signOut();
    await account.requestCode(anna.email);
    await account.verifyCode('100002');
    await account.signOutEverywhere();
    await account.requestCode(anna.email);
    await account.verifyCode('100003');
    await account.delete();

    expect(await userState.list('')).toEqual(before);
  });
});
