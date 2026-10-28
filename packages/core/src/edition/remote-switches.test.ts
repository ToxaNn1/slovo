import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openRemoteSwitches,
  openUserState,
  type Edition,
  type FeatureSwitch,
  type RequestFailure,
  type Schedule,
  type SwitchesApi,
} from '../index';
import { randomOf } from '../test-support';

/** An Edition that turns on every Feature Switch but those named. */
const editionWithout = (
  ...off: FeatureSwitch[]
): Pick<Edition, 'id' | 'locale' | 'isFeatureEnabled'> => ({
  id: 'uk',
  locale: 'uk-UA',
  isFeatureEnabled: (feature) => !off.includes(feature),
});

/**
 * A backend that answers `edition.switches` like the real one: the features
 * the owner turned off remotely, with an ETag that names them, and nothing
 * new when the app names that ETag.
 */
function fakeBackend() {
  let off: string[] = [];
  const failures: RequestFailure['reason'][] = [];
  /** The ETag each request named, in order, the failed ones included. */
  const asked: (string | undefined)[] = [];
  const etagOf = (names: readonly string[]) => `"${names.join(',')}"`;
  const api: SwitchesApi = {
    switches(etag) {
      asked.push(etag);
      const reason = failures.shift();
      if (reason !== undefined) return Promise.resolve({ ok: false, reason });
      const answer = etag === etagOf(off) ? 'unchanged' : { off: [...off], etag: etagOf(off) };
      return Promise.resolve({ ok: true, answer });
    },
  };
  return {
    api,
    asked,
    /** Sets the features turned off remotely, as `pnpm switch:off` and `switch:clear` do. */
    turnOff(...features: string[]) {
      off = [...features].sort();
    },
    /** Fails the next requests, one per reason, in order. */
    fail(...reasons: RequestFailure['reason'][]) {
      failures.push(...reasons);
    },
  };
}

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
  const backend = fakeBackend();
  const records = new Map<string, string>();
  const { schedule, delays } = immediateSchedule();
  return {
    backend,
    records,
    delays,
    async launch() {
      return openRemoteSwitches({
        edition,
        api: backend.api,
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
    app.backend.turnOff('game');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
    expect(switches.edition.isFeatureEnabled('account')).toBe(true);
  });

  it('turn one feature of 0.8.13 off remotely and keep the others', async () => {
    const app = device();
    app.backend.turnOff('search');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('search')).toBe(false);
    expect(switches.edition.isFeatureEnabled('moods')).toBe(true);
    expect(switches.edition.isFeatureEnabled('dailyLimit')).toBe(true);
  });

  it('turn the Community Counters off remotely and keep the other features of 0.8.14', async () => {
    const app = device();
    app.backend.turnOff('communityCounters');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('communityCounters')).toBe(false);
    expect(switches.edition.isFeatureEnabled('communityWord')).toBe(true);
    expect(switches.edition.isFeatureEnabled('mistakeReports')).toBe(true);
  });

  it('give every Game Mode and the Daily Crossword as off once the Game is off remotely', async () => {
    const app = device();
    app.backend.turnOff('game');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('gameStress')).toBe(false);
    expect(switches.edition.isFeatureEnabled('gameGuessWord')).toBe(false);
    expect(switches.edition.isFeatureEnabled('dailyCrossword')).toBe(false);
  });

  it('turn one Game Mode off remotely and keep the others', async () => {
    const app = device();
    app.backend.turnOff('gameAnagram');
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
    app.backend.turnOff('account');
    const switches = await app.launch();

    await switches.ask();
    app.backend.turnOff();
    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
  });

  it('give a feature back once the remote switch is cleared', async () => {
    const app = device();
    app.backend.turnOff('game');
    const switches = await app.launch();
    await switches.ask();

    app.backend.turnOff();
    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(true);
  });

  it('skip a name the app doesn’t know', async () => {
    const app = device();
    app.backend.turnOff('chat', 'game');
    const switches = await app.launch();

    await switches.ask();

    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
    expect(switches.edition.isFeatureEnabled('corrections')).toBe(true);
  });

  describe('at launch', () => {
    it('give the answer the device kept, before asking', async () => {
      const app = device();
      app.backend.turnOff('game');
      await (await app.launch()).ask();

      const next = await app.launch();

      expect(next.edition.isFeatureEnabled('game')).toBe(false);
    });

    it('keep the answer as a record that stays on the device', async () => {
      const app = device();
      app.backend.turnOff('game');

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
        api: fakeBackend().api,
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
      app.backend.turnOff('game');
      await (await app.launch()).ask();
      const next = await app.launch();
      app.backend.turnOff();
      app.backend.fail('offline', 'offline', 'offline', 'offline');

      await next.ask();

      expect(next.edition.isFeatureEnabled('game')).toBe(false);
    });

    it('give the Edition’s values without a kept answer', async () => {
      const app = device();
      app.backend.turnOff('game');
      const switches = await app.launch();
      app.backend.fail('offline', 'offline', 'offline', 'offline');

      await switches.ask();

      expect(switches.edition.isFeatureEnabled('game')).toBe(true);
      expect(app.records.has('edition.switches')).toBe(false);
    });

    it('try again by the one rule, with backoff and jitter', async () => {
      const app = device();
      app.backend.turnOff('game');
      const switches = await app.launch();
      app.backend.fail('offline', 'server-error');

      await switches.ask();

      expect(app.backend.asked).toHaveLength(3);
      expect(app.delays).toEqual([750, 1500]);
      expect(switches.edition.isFeatureEnabled('game')).toBe(false);
    });

    it('keep the answer through a refusal, which is not tried again', async () => {
      const app = device();
      const switches = await app.launch();
      app.backend.turnOff('game');
      app.backend.fail('unexpected');

      await expect(switches.ask()).resolves.toBe(false);

      expect(app.backend.asked).toHaveLength(1);
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
      app.backend.turnOff('game');

      await expect(switches.ask()).resolves.toBe(true);

      expect(told).toBe(1);
      expect(switches.edition).not.toBe(before);
    });

    it('is read by an Edition kept from before, so a module acts on it', async () => {
      const app = device();
      const switches = await app.launch();
      const kept = switches.edition;
      app.backend.turnOff('game');

      await switches.ask();

      expect(kept.isFeatureEnabled('game')).toBe(false);
    });
  });

  describe('an unchanged answer', () => {
    it('asks for no reopen when the backend names the switches the app keeps', async () => {
      const app = device();
      app.backend.turnOff('game');
      await (await app.launch()).ask();
      const switches = await app.launch();
      const before = switches.edition;
      let told = 0;
      switches.subscribe(() => {
        told += 1;
      });

      await expect(switches.ask()).resolves.toBe(false);

      expect(app.backend.asked).toEqual([undefined, '"game"']);
      expect(told).toBe(0);
      expect(switches.edition).toBe(before);
    });

    it('asks for no reopen when only a feature the Edition turns off is turned off too', async () => {
      const app = device(editionWithout('game'));
      const switches = await app.launch();
      app.backend.turnOff('game');

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
    app.backend.turnOff('game');
    const switches = await app.launch();

    const [first, second] = await Promise.all([switches.ask(), switches.ask()]);

    expect([first, second]).toEqual([true, true]);
    expect(app.backend.asked).toHaveLength(1);
  });

  it('never rejects, even when the answer can’t be kept', async () => {
    const backend = fakeBackend();
    backend.turnOff('game');
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const switches = await openRemoteSwitches({
      edition: editionWithout(),
      api: backend.api,
      userState: { ...userState, write: () => Promise.reject(new Error('The disk is full')) },
      schedule: immediateSchedule().schedule,
      random: randomOf(0.5),
    });

    await expect(switches.ask()).resolves.toBe(true);
    expect(switches.edition.isFeatureEnabled('game')).toBe(false);
  });
});
