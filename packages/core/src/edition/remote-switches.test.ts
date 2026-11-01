import { describe, expect, it } from 'vitest';

import { openRemoteSwitches, type Edition, type FeatureSwitch, type Schedule } from '../index';
import { randomOf } from '../test-support';
import { createFakeBackend } from '../testing';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** An Edition that turns on every Feature Switch but those named. */
const editionWithout = (
  ...off: FeatureSwitch[]
): Pick<Edition, 'id' | 'locale' | 'isFeatureEnabled'> => ({
  id: 'uk',
  locale: 'uk-UA',
  isFeatureEnabled: (feature) => !off.includes(feature),
});

/** The schedule of the tries again: it runs each at once and keeps its delay. */
function immediateSchedule() {
  const delays: number[] = [];
  const schedule: Schedule = (run, delay) => {
    delays.push(delay);
    run();
    return () => undefined;
  };
  return { schedule, delays };
}

/**
 * A device of the Edition: its user state and the backend, shared by its
 * launches, so a new launch finds the answer the one before kept.
 */
function device(edition = editionWithout()) {
  const backend = createFakeBackend();
  const records = new Map<string, string>();
  const { schedule, delays } = immediateSchedule();
  return {
    backend,
    records,
    delays,
    async launch() {
      return openRemoteSwitches({
        edition,
        backend: backend.backend,
        userState: await openUserState({ port: createMemoryUserStatePort(records) }),
        schedule,
        random: randomOf(0.5),
      });
    },
  };
}

describe('the remote Feature Switches', () => {
  it('give the Edition’s values until the backend turns a feature off', async () => {
    const app = device(editionWithout('corrections'));
    const switches = await app.launch();

    expect(switches.edition.isFeatureEnabled('game')).toBe(true);
    expect(switches.edition.isFeatureEnabled('corrections')).toBe(false);
  });

  it('give a feature turned off remotely as off once asked', async () => {
    const app = device();
    app.backend.switches.turnOff('game');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
    expect(switches.edition.isFeatureEnabled('account')).toBe(true);
  });

  it('turn one feature of 0.8.13 off remotely and keep the others', async () => {
    const app = device();
    app.backend.switches.turnOff('search');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('search')).toBe(false);
    expect(switches.edition.isFeatureEnabled('moods')).toBe(true);
    expect(switches.edition.isFeatureEnabled('enoughForToday')).toBe(true);
  });

  it('turn the Community Counters off remotely and keep the other features of 0.8.14', async () => {
    const app = device();
    app.backend.switches.turnOff('communityCounters');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('communityCounters')).toBe(false);
    expect(switches.edition.isFeatureEnabled('communityWord')).toBe(true);
    expect(switches.edition.isFeatureEnabled('mistakeReports')).toBe(true);
  });

  it('turn the Collection Links off remotely and keep the other features of 0.8.15', async () => {
    const app = device();
    app.backend.switches.turnOff('collectionLinks');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('collectionLinks')).toBe(false);
    expect(switches.edition.isFeatureEnabled('spotlight')).toBe(true);
    expect(switches.edition.isFeatureEnabled('appIntents')).toBe(true);
    expect(switches.edition.isFeatureEnabled('calligraphy')).toBe(true);
  });

  it('turn Sign in with Apple off remotely and keep the other Sign-in methods', async () => {
    const app = device();
    app.backend.switches.turnOff('signInWithApple');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('signInWithApple')).toBe(false);
    expect(switches.edition.isFeatureEnabled('googleSignIn')).toBe(true);
    expect(switches.edition.isFeatureEnabled('account')).toBe(true);
  });

  it('never turn Sign in with Apple on when the Edition turns it off', async () => {
    const app = device(editionWithout('signInWithApple'));
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('signInWithApple')).toBe(false);
  });

  it('give every Game Mode and the Daily Crossword as off once the Game is off remotely', async () => {
    const app = device();
    app.backend.switches.turnOff('game');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('gameStress')).toBe(false);
    expect(switches.edition.isFeatureEnabled('gameGuessWord')).toBe(false);
    expect(switches.edition.isFeatureEnabled('dailyCrossword')).toBe(false);
  });

  it('give the Badges, the Break, the Profile and the Daily Goal as off once the XP log is off remotely', async () => {
    const app = device();
    app.backend.switches.turnOff('xpLog');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('badges')).toBe(false);
    expect(switches.edition.isFeatureEnabled('streakBreak')).toBe(false);
    expect(switches.edition.isFeatureEnabled('profile')).toBe(false);
    expect(switches.edition.isFeatureEnabled('dailyGoal')).toBe(false);
    expect(switches.edition.isFeatureEnabled('progressShareCards')).toBe(false);
    expect(switches.edition.isFeatureEnabled('shareCards')).toBe(true);
  });

  it('turn one Game Mode off remotely and keep the others', async () => {
    const app = device();
    app.backend.switches.turnOff('gameAnagram');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('gameAnagram')).toBe(false);
    expect(switches.edition.isFeatureEnabled('gameStress')).toBe(true);
    expect(switches.edition.isFeatureEnabled('game')).toBe(true);
  });

  it('keep the rest of the Edition as it is', async () => {
    const app = device();
    const switches = await app.launch();

    expect(switches.edition.id).toBe('uk');
    expect(switches.edition.locale).toBe('uk-UA');
  });

  it('never turn on a feature the Edition turns off', async () => {
    const app = device(editionWithout('game'));
    app.backend.switches.turnOff('account');
    const switches = await app.launch();

    await switches.ask();
    app.backend.switches.turnOff();
    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
  });

  it('give a feature back once the remote switch is cleared', async () => {
    const app = device();
    app.backend.switches.turnOff('game');
    const switches = await app.launch();
    await switches.ask();

    app.backend.switches.turnOff();
    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(true);
  });

  it('skip a name the app doesn’t know', async () => {
    const app = device();
    app.backend.switches.turnOff('chat', 'game');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
    expect(switches.edition.isFeatureEnabled('corrections')).toBe(true);
  });

  describe('at launch', () => {
    it('give the answer the device kept, before asking', async () => {
      const app = device();
      app.backend.switches.turnOff('game');
      await (await app.launch()).ask();

      const next = await app.launch();

      expect(next.edition.isFeatureEnabled('game')).toBe(false);
    });

    it('keep the answer as a record that stays on the device', async () => {
      const app = device();
      app.backend.switches.turnOff('game');

      await (await app.launch()).ask();

      expect(JSON.parse(app.records.get('edition.switches') ?? 'null')).toEqual({
        off: ['game'],
        etag: '"game"',
      });
      expect(app.records.has('sync.pending.edition.switches')).toBe(false);
    });

    it('give the Edition’s values when the kept answer is unreadable', async () => {
      const app = device();
      app.records.set('edition.switches', '{"off":');

      const switches = await app.launch();

      expect(switches.edition.isFeatureEnabled('game')).toBe(true);
    });

    it('give the Edition’s values when the user state can’t be read', async () => {
      const userState = await openUserState({ port: createMemoryUserStatePort() });

      const switches = await openRemoteSwitches({
        edition: editionWithout(),
        backend: createFakeBackend().backend,
        userState: {
          ...userState,
          read: () => Promise.reject(new Error('The database is locked')),
        },
        schedule: immediateSchedule().schedule,
        random: randomOf(0.5),
      });

      expect(switches.edition.isFeatureEnabled('game')).toBe(true);
    });
  });

  describe('offline', () => {
    it('keep the answer the device kept', async () => {
      const app = device();
      app.backend.switches.turnOff('game');
      await (await app.launch()).ask();
      const next = await app.launch();
      app.backend.switches.turnOff();
      app.backend.failNext('offline', 'offline', 'offline', 'offline');

      await next.ask();

      expect(next.edition.isFeatureEnabled('game')).toBe(false);
    });

    it('give the Edition’s values without a kept answer', async () => {
      const app = device();
      app.backend.switches.turnOff('game');
      const switches = await app.launch();
      app.backend.failNext('offline', 'offline', 'offline', 'offline');

      await switches.ask();

      expect(switches.edition.isFeatureEnabled('game')).toBe(true);
      expect(app.records.has('edition.switches')).toBe(false);
    });

    it('try again by the one rule, with backoff and jitter', async () => {
      const app = device();
      app.backend.switches.turnOff('game');
      const switches = await app.launch();
      app.backend.failNext('offline', 'server-error');

      await switches.ask();

      expect(app.backend.switches.asked).toHaveLength(3);
      expect(app.delays).toEqual([750, 1500]);
      expect(switches.edition.isFeatureEnabled('game')).toBe(false);
    });

    it('keep the answer through a refusal, which is not tried again', async () => {
      const app = device();
      const switches = await app.launch();
      app.backend.switches.turnOff('game');
      app.backend.failNext('unexpected');

      await expect(switches.ask()).resolves.toBe(false);

      expect(app.backend.switches.asked).toHaveLength(1);
      expect(switches.edition.isFeatureEnabled('game')).toBe(true);
    });
  });

  describe('a changed answer', () => {
    it('asks for a reopen, once, with a new Edition', async () => {
      const app = device();
      const switches = await app.launch();
      const before = switches.edition;
      let told = 0;
      switches.subscribe(() => {
        told += 1;
      });
      app.backend.switches.turnOff('game');

      await expect(switches.ask()).resolves.toBe(true);

      expect(told).toBe(1);
      expect(switches.edition).not.toBe(before);
    });

    it('is read by an Edition kept from before, so a module acts on it', async () => {
      const app = device();
      const switches = await app.launch();
      const kept = switches.edition;
      app.backend.switches.turnOff('game');

      await switches.ask();

      expect(kept.isFeatureEnabled('game')).toBe(false);
    });
  });

  describe('an unchanged answer', () => {
    it('asks for no reopen when the backend names the switches the app keeps', async () => {
      const app = device();
      app.backend.switches.turnOff('game');
      await (await app.launch()).ask();
      const switches = await app.launch();
      const before = switches.edition;
      let told = 0;
      switches.subscribe(() => {
        told += 1;
      });

      await expect(switches.ask()).resolves.toBe(false);

      expect(app.backend.switches.asked).toEqual([undefined, '"game"']);
      expect(told).toBe(0);
      expect(switches.edition).toBe(before);
    });

    it('asks for no reopen when only a feature the Edition turns off is turned off too', async () => {
      const app = device(editionWithout('game'));
      const switches = await app.launch();
      app.backend.switches.turnOff('game');

      await expect(switches.ask()).resolves.toBe(false);
    });

    it('asks for no reopen when nothing is off, and keeps the answer', async () => {
      const app = device();
      const switches = await app.launch();

      await expect(switches.ask()).resolves.toBe(false);

      expect(app.records.has('edition.switches')).toBe(true);
    });
  });

  it('joins an ask under way', async () => {
    const app = device();
    app.backend.switches.turnOff('game');
    const switches = await app.launch();

    const [first, second] = await Promise.all([switches.ask(), switches.ask()]);

    expect([first, second]).toEqual([true, true]);
    expect(app.backend.switches.asked).toHaveLength(1);
  });

  it('never rejects, even when the answer can’t be kept', async () => {
    const backend = createFakeBackend();
    backend.switches.turnOff('game');
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const switches = await openRemoteSwitches({
      edition: editionWithout(),
      backend: backend.backend,
      userState: { ...userState, write: () => Promise.reject(new Error('The disk is full')) },
      schedule: immediateSchedule().schedule,
      random: randomOf(0.5),
    });

    await expect(switches.ask()).resolves.toBe(true);
    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
  });
});
