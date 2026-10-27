import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type ContentReadPort,
  type NotificationSchedulerPort,
  type OnboardingStep,
  type PlannedNotification,
} from '../index';
import { createFakeNotificationScheduler, createMemoryContentPort } from '../testing';
import { fakeClock, word } from '../test-support';

/** The instant these tests start at. */
const start = '2026-10-14T08:00:00+03:00';

/** The Language Pack's two Categories. */
const categories = [
  { id: 'test', displayName: 'Test' },
  { id: 'other', displayName: 'Other' },
];

/** Words of two Categories, so the Mix step can take one out. */
const twoCategories = createMemoryContentPort({
  categories,
  words: [
    ...Array.from({ length: 12 }, (_, index) =>
      word(`w_test${String(index)}`, { categoryId: 'test' }),
    ),
    ...Array.from({ length: 12 }, (_, index) =>
      word(`w_other${String(index)}`, { categoryId: 'other' }),
    ),
  ],
  corrections: [],
});

/** One Word, whose Definition is longer than a notification body holds. */
const longDefinitionOnly = createMemoryContentPort({
  categories,
  words: [word('w_long', { categoryId: 'test', primaryDefinition: 'very '.repeat(30).trim() })],
  corrections: [],
});

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock(start).clock,
  scheduler,
  content = twoCategories,
  account = false,
  notifications = true,
}: {
  content?: ContentReadPort;
  records?: Map<string, string>;
  clock?: Clock;
  scheduler?: NotificationSchedulerPort;
  /** Whether the Edition turns the Account on. */
  account?: boolean;
  /** Whether the Edition in effect has the Feature Switch of notifications on. */
  notifications?: boolean;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      id: 'test',
      userSettingDefaults: {
        mix: {
          categoryIds: ['test', 'other'],
          correctionCategoryIds: 'all' as const,
          corrections: false,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: ['09:00', '13:00', '19:00'],
      },
      isFeatureEnabled: (feature) =>
        (feature === 'account' && account) ||
        (feature === 'notifications' && notifications) ||
        feature === 'wordOfTheDay',
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
    ...(scheduler === undefined ? {} : { scheduling: { scheduler, ellipsis: '…' } }),
  });
}

/** The Account as the reader comes back with it from the SLOVO ID screen. */
const signedIn = { status: 'signed-in' } as const;
const signedOut = { status: 'signed-out' } as const;

/** A scheduler that asks the reader for the first time, who answers `answer`. */
const firstLaunch = (answer: 'allowed' | 'denied' = 'allowed') =>
  createFakeNotificationScheduler({ permission: 'not-asked', answer });

/** The step the onboarding is on; it fails the test once the onboarding is finished. */
function stepOf(app: Composition): OnboardingStep {
  const { step } = app.onboarding.state;
  if (step === undefined) throw new Error('Expected the onboarding to be open');
  return step;
}

/** Goes on from the welcome to the step of `kind`. */
async function goTo(app: Composition, kind: OnboardingStep['kind']): Promise<void> {
  while (stepOf(app).kind !== kind) await app.onboarding.next();
}

/** The sample of the notifications step; it fails the test on another step. */
function sampleOf(app: Composition) {
  const step = stepOf(app);
  if (step.kind !== 'notifications') throw new Error('Expected the notifications step');
  return step.sample;
}

/** The first notification at the earliest time of the plan the scheduler was last given. */
function morningOf(plan: readonly PlannedNotification[] | undefined, earliest = '09:00') {
  const morning = plan?.find(({ time }) => time === earliest);
  if (morning === undefined) throw new Error('Expected a morning notification in the plan');
  return morning;
}

/** The Word of the Day the Feed opens on. */
function wordOfTheDayOf(app: Composition) {
  const card = app.feed.cards.find((candidate) => candidate.kind === 'word');
  if (card?.kind !== 'word' || card.wordOfTheDay === undefined) {
    throw new Error('Expected the Word of the Day');
  }
  return card.model;
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('Onboarding', () => {
  it('opens on the welcome on a fresh install, with the Word of the Day as its hero', async () => {
    const app = await run();

    expect(app.onboarding.state.finishedAt).toBeUndefined();
    expect(stepOf(app)).toEqual({
      kind: 'welcome',
      number: 1,
      total: 3,
      hero: wordOfTheDayOf(app),
    });
  });

  it('goes from the welcome to the Mix and on to the notifications, telling the subscribers', async () => {
    const app = await run({ scheduler: firstLaunch() });
    let told = 0;
    app.onboarding.subscribe(() => {
      told += 1;
    });

    await app.onboarding.next();
    expect(stepOf(app)).toEqual({ kind: 'mix', number: 2, total: 3 });

    await app.onboarding.next();
    expect(stepOf(app)).toMatchObject({ kind: 'notifications', number: 3, total: 3 });
    expect(told).toBe(2);
    expect(app.onboarding.state.finishedAt).toBeUndefined();
  });

  it('finishes past the last step', async () => {
    const app = await run();
    await goTo(app, 'notifications');

    await app.onboarding.next();

    expect(app.onboarding.state).toEqual({
      finishedAt: new Date('2026-10-14T08:00:00+03:00'),
      step: undefined,
    });
  });

  it('starts over at the welcome when the app is closed halfway', async () => {
    const records = new Map<string, string>();
    await goTo(await run({ records }), 'notifications');

    const reopened = await run({ records });

    expect(stepOf(reopened).kind).toBe('welcome');
  });

  describe('skip', () => {
    it.each(['welcome', 'mix', 'notifications'] as const)(
      'on the %s step finishes at once, and the onboarding never opens again',
      async (kind) => {
        const records = new Map<string, string>();
        const app = await run({ records, scheduler: firstLaunch() });
        await goTo(app, kind);
        const before = app.onboarding.state;
        let told = 0;
        app.onboarding.subscribe(() => {
          told += 1;
        });

        await app.onboarding.finish();

        expect(app.onboarding.state).toEqual({
          finishedAt: new Date('2026-10-14T08:00:00+03:00'),
          step: undefined,
        });
        expect(app.onboarding.state).not.toBe(before);
        expect(told).toBe(1);
        expect((await run({ records })).onboarding.state).toEqual(app.onboarding.state);
      },
    );

    it("is the notifications step's later too: it asks nothing", async () => {
      const scheduler = firstLaunch();
      const app = await run({ scheduler });
      await goTo(app, 'notifications');

      await app.onboarding.finish();

      expect(await scheduler.permission()).toBe('not-asked');
      expect(app.notifications.state.permission).toBe('not-asked');
      expect(app.onboarding.state.finishedAt).toBeDefined();
    });
  });

  it('keeps the first moment when it ends again, and tells nobody', async () => {
    const time = fakeClock(start);
    const app = await run({ clock: time.clock });
    await app.onboarding.finish();
    const finished = app.onboarding.state;
    let told = 0;
    app.onboarding.subscribe(() => {
      told += 1;
    });

    time.advance(60_000);
    await app.onboarding.finish();
    await app.onboarding.next();
    await app.onboarding.allowNotifications();

    expect(app.onboarding.state).toBe(finished);
    expect(told).toBe(0);
  });

  it('stays unfinished when the app is closed before it ends', async () => {
    const records = new Map<string, string>();
    await run({ records });

    const reopened = await run({ records });

    expect(reopened.onboarding.state.finishedAt).toBeUndefined();
  });

  it('is not finished by a record it cannot read', async () => {
    const app = await run({ records: new Map([['onboarding.finished', '"yesterday"']]) });

    expect(app.onboarding.state.finishedAt).toBeUndefined();
    expect(stepOf(app).kind).toBe('welcome');
  });

  describe('allowing notifications', () => {
    it('asks for permission, plans by the answer and then finishes', async () => {
      const scheduler = firstLaunch('allowed');
      const app = await run({ scheduler });
      await goTo(app, 'notifications');

      await app.onboarding.allowNotifications();

      expect(app.notifications.state.permission).toBe('allowed');
      expect(scheduler.plan?.length).toBeGreaterThan(0);
      expect(app.onboarding.state.step).toBeUndefined();
      expect(app.onboarding.state.finishedAt).toBeDefined();
    });

    it('finishes after a refusal, keeping the times for the notification settings', async () => {
      const app = await run({ scheduler: firstLaunch('denied') });
      await goTo(app, 'notifications');

      await app.onboarding.allowNotifications();

      expect(app.notifications.state.permission).toBe('denied');
      expect(app.notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
      expect(app.onboarding.state.finishedAt).toBeDefined();
    });

    it('finishes when nothing can ask, as on a binary without the module', async () => {
      const app = await run();
      await goTo(app, 'notifications');

      await app.onboarding.allowNotifications();

      expect(app.notifications.state.permission).toBe('not-asked');
      expect(app.onboarding.state.finishedAt).toBeDefined();
    });

    it('finishes when asking fails, and then reports the failure', async () => {
      const failure = new Error('The prompt could not open');
      const app = await run({
        scheduler: { ...firstLaunch(), askPermission: () => Promise.reject(failure) },
      });
      await goTo(app, 'notifications');

      await expect(app.onboarding.allowNotifications()).rejects.toBe(failure);

      expect(app.onboarding.state.finishedAt).toBeDefined();
    });

    it('takes one tap: while the prompt is up, every other tap does nothing', async () => {
      const answer = deferred<'allowed'>();
      let asked = 0;
      const scheduler = firstLaunch();
      const app = await run({
        scheduler: {
          ...scheduler,
          askPermission() {
            asked += 1;
            return answer.promise;
          },
        },
      });
      await goTo(app, 'notifications');
      const onStep = app.onboarding.state;

      const allowing = app.onboarding.allowNotifications();
      await Promise.all([
        app.onboarding.allowNotifications(),
        app.onboarding.finish(),
        app.onboarding.next(),
      ]);

      expect(asked).toBe(1);
      expect(app.onboarding.state).toBe(onStep);
      answer.resolve('allowed');
      await allowing;
      expect(app.onboarding.state.finishedAt).toBeDefined();
    });
  });

  describe('enabling notifications later, from the notification settings', () => {
    it('asks after «Пізніше» and plans as allowing them on the step does', async () => {
      const onTheStep = firstLaunch('allowed');
      const allowedOnTheStep = await run({ scheduler: onTheStep });
      await goTo(allowedOnTheStep, 'notifications');
      await allowedOnTheStep.onboarding.allowNotifications();
      const scheduler = firstLaunch('allowed');
      const app = await run({ scheduler });
      await goTo(app, 'notifications');
      await app.onboarding.finish();
      expect(app.notifications.state.permission).toBe('not-asked');
      expect(scheduler.plan).toEqual([]);

      expect(await app.notifications.askPermission()).toBe('allowed');

      expect(app.notifications.state.permission).toBe('allowed');
      // Every Word of the two Categories, one per notification.
      expect(scheduler.plan).toHaveLength(24);
      expect(scheduler.plan).toEqual(onTheStep.plan);
    });

    it('stays denied after a refusal, asking no more and planning nothing, until the reader allows them in the iOS settings', async () => {
      const scheduler = firstLaunch('denied');
      let asked = 0;
      const app = await run({
        scheduler: {
          ...scheduler,
          askPermission() {
            asked += 1;
            return scheduler.askPermission();
          },
        },
      });
      await app.onboarding.finish();

      expect(await app.notifications.askPermission()).toBe('denied');
      expect(await app.notifications.askPermission()).toBe('denied');

      expect(asked).toBe(1);
      expect(app.notifications.state.permission).toBe('denied');
      expect(scheduler.plan).toEqual([]);
      expect(app.notifications.state.times).toEqual(['09:00', '13:00', '19:00']);

      scheduler.setPermission('allowed');
      await app.resume();
      expect(app.notifications.state.permission).toBe('allowed');
      expect(scheduler.plan).toHaveLength(24);
    });
  });

  it('takes one tap per step: a second tap on the welcome does not skip the Mix', async () => {
    const app = await run();

    await Promise.all([app.onboarding.next(), app.onboarding.next()]);

    expect(stepOf(app).kind).toBe('mix');
  });

  describe('the sample notification', () => {
    it('is none while the notifications are switched off', async () => {
      const app = await run({ scheduler: firstLaunch(), notifications: false });
      await goTo(app, 'notifications');

      expect(sampleOf(app)).toBeUndefined();
    });

    it("is this morning's notification of the plan, the Word of the Day's", async () => {
      const scheduler = firstLaunch();
      const app = await run({ scheduler });
      const wordOfTheDay = wordOfTheDayOf(app);
      await goTo(app, 'notifications');
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      const morning = morningOf(scheduler.plan);
      expect(morning.date).toBe('2026-10-14');
      expect(sample).toEqual({
        wordCard: wordOfTheDay,
        body: morning.body,
        time: '09:00',
      });
      expect(morning.wordId).toBe(wordOfTheDay.wordId);
    });

    it("is the next day's morning notification once this morning's time has passed", async () => {
      const scheduler = firstLaunch();
      const app = await run({ scheduler, clock: fakeClock('2026-10-14T10:00:00+03:00').clock });
      const wordOfTheDay = wordOfTheDayOf(app);
      await goTo(app, 'notifications');
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      const morning = morningOf(scheduler.plan);
      expect(morning.date).toBe('2026-10-15');
      expect(sample?.wordCard.wordId).toBe(morning.wordId);
      expect(sample?.wordCard.wordId).not.toBe(wordOfTheDay.wordId);
      expect(sample?.wordCard.lemma).toBe(morning.title);
      expect(sample?.body).toBe(morning.body);
      expect(sample?.time).toBe('09:00');
    });

    it('follows the local time after a time-zone change that passes the morning', async () => {
      const scheduler = firstLaunch();
      const time = fakeClock('2026-10-14T08:00:00+03:00');
      const app = await run({ scheduler, clock: time.clock });
      time.moveTo('Asia/Tokyo');
      await goTo(app, 'notifications');
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      const morning = morningOf(scheduler.plan);
      expect(morning.date).toBe('2026-10-15');
      expect(sample?.wordCard.wordId).toBe(morning.wordId);
    });

    it("is not today's Word of the Day once it is Seen, as in a session restored from before", async () => {
      const records = new Map<string, string>();
      const time = fakeClock(start);
      // A session before, closed on the onboarding, after the Word of the Day was read in the Feed.
      const before = await run({ records, clock: time.clock });
      const wordOfTheDay = wordOfTheDayOf(before);
      await before.feed.show(0);
      time.advance(SEEN_DWELL_MS);
      await before.feed.show(undefined);
      const scheduler = firstLaunch();
      const app = await run({ records, clock: time.clock, scheduler });
      await goTo(app, 'notifications');
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      const morning = morningOf(scheduler.plan);
      expect(morning.date).toBe('2026-10-14');
      expect(sample?.wordCard.wordId).toBe(morning.wordId);
      expect(sample?.wordCard.wordId).not.toBe(wordOfTheDay.wordId);
    });

    it("follows the plan after the Mix step takes the Word of the Day's Category out and restores it", async () => {
      const scheduler = firstLaunch();
      const app = await run({ scheduler });
      const { categoryId } = wordOfTheDayOf(app);
      await goTo(app, 'mix');
      await app.mix.takeOut(categoryId);
      await app.mix.putBack(categoryId);
      await app.onboarding.next();
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      const morning = morningOf(scheduler.plan);
      expect(sample?.wordCard.wordId).toBe(morning.wordId);
      expect(sample?.body).toBe(morning.body);
    });

    it('follows the Notification times changed on the step', async () => {
      const scheduler = firstLaunch();
      const app = await run({ scheduler });
      await goTo(app, 'notifications');

      await app.notifications.removeTime('09:00');
      await app.notifications.keepTime('11:30');
      await expect.poll(() => sampleOf(app)?.time).toBe('11:30');
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      const morning = morningOf(scheduler.plan, '11:30');
      expect(sample?.wordCard.wordId).toBe(morning.wordId);
    });

    it('cuts a long Definition the way the notification does', async () => {
      const scheduler = firstLaunch();
      const app = await run({ scheduler, content: longDefinitionOnly });
      await goTo(app, 'notifications');
      const sample = sampleOf(app);

      await app.onboarding.allowNotifications();

      expect(sample?.wordCard.wordId).toBe('w_long');
      expect(sample?.body).toBe(morningOf(scheduler.plan).body);
      expect(sample?.body.endsWith('…')).toBe(true);
    });

    it('is the Word of the Day without a time once every Notification time is removed', async () => {
      const app = await run({ scheduler: firstLaunch() });
      const wordOfTheDay = wordOfTheDayOf(app);
      await goTo(app, 'notifications');

      for (const time of ['09:00', '13:00', '19:00']) await app.notifications.removeTime(time);

      await expect.poll(() => sampleOf(app)?.time).toBeUndefined();
      expect(sampleOf(app)?.wordCard).toEqual(wordOfTheDay);
    });

    it('is left out without a scheduler, as in tools: nothing is planned', async () => {
      const app = await run();

      await goTo(app, 'notifications');

      expect(sampleOf(app)).toBeUndefined();
    });
  });

  describe('the SLOVO ID step', () => {
    it('comes fourth of four with the Account on, after the notifications', async () => {
      const app = await run({ account: true, scheduler: firstLaunch() });
      expect(stepOf(app)).toMatchObject({ kind: 'welcome', number: 1, total: 4 });
      await goTo(app, 'notifications');
      expect(stepOf(app)).toMatchObject({ number: 3, total: 4 });

      await app.onboarding.next();

      expect(stepOf(app)).toEqual({ kind: 'account', number: 4, total: 4 });
    });

    it('is left out with the Account off: the notifications step is the last of three', async () => {
      const app = await run({ scheduler: firstLaunch() });
      await goTo(app, 'notifications');
      expect(stepOf(app)).toMatchObject({ number: 3, total: 3 });

      await app.onboarding.allowNotifications();

      expect(app.onboarding.state.finishedAt).toBeDefined();
    });

    it('follows allowing notifications, which asks first', async () => {
      const scheduler = firstLaunch('allowed');
      const app = await run({ account: true, scheduler });
      await goTo(app, 'notifications');

      await app.onboarding.allowNotifications();

      expect(app.notifications.state.permission).toBe('allowed');
      expect(scheduler.plan?.length).toBeGreaterThan(0);
      expect(stepOf(app).kind).toBe('account');
      expect(app.onboarding.state.finishedAt).toBeUndefined();
    });

    it('follows the notifications step when asking fails, and then reports the failure', async () => {
      const failure = new Error('The prompt could not open');
      const app = await run({
        account: true,
        scheduler: { ...firstLaunch(), askPermission: () => Promise.reject(failure) },
      });
      await goTo(app, 'notifications');

      await expect(app.onboarding.allowNotifications()).rejects.toBe(failure);

      expect(stepOf(app).kind).toBe('account');
    });

    it('finishes on «Продовжити без акаунта», and the onboarding never opens again', async () => {
      const records = new Map<string, string>();
      const app = await run({ records, account: true });
      await goTo(app, 'account');

      await app.onboarding.next();

      expect(app.onboarding.state).toEqual({
        finishedAt: new Date('2026-10-14T08:00:00+03:00'),
        step: undefined,
      });
      expect((await run({ records, account: true })).onboarding.state).toEqual(
        app.onboarding.state,
      );
    });

    it('finishes when the reader comes back from the SLOVO ID screen signed in', async () => {
      const records = new Map<string, string>();
      const app = await run({ records, account: true });
      await goTo(app, 'account');

      await app.onboarding.backFromAccount(signedIn);

      expect(app.onboarding.state).toEqual({
        finishedAt: new Date('2026-10-14T08:00:00+03:00'),
        step: undefined,
      });
      expect((await run({ records, account: true })).onboarding.state.finishedAt).toBeDefined();
    });

    it('stays when the reader comes back signed out, and tells nobody', async () => {
      const app = await run({ account: true });
      await goTo(app, 'account');
      const onStep = app.onboarding.state;
      let told = 0;
      app.onboarding.subscribe(() => {
        told += 1;
      });

      await app.onboarding.backFromAccount(signedOut);

      expect(app.onboarding.state).toBe(onStep);
      expect(told).toBe(0);
    });

    it('finishes on skip too', async () => {
      const app = await run({ account: true });
      await goTo(app, 'account');

      await app.onboarding.finish();

      expect(app.onboarding.state.finishedAt).toBeDefined();
    });
  });

  describe('the Mix step', () => {
    it('starts from the Edition default Mix, which finishing without a change keeps', async () => {
      const records = new Map<string, string>();
      const app = await run({ records });
      expect(app.mix.state.categoryIds).toEqual(['test', 'other']);

      await app.onboarding.finish();

      expect((await run({ records })).mix.state.categoryIds).toEqual(['test', 'other']);
    });

    it('keeps a choice made on the way, when the reader skips', async () => {
      const records = new Map<string, string>();
      const app = await run({ records });

      await app.mix.takeOut('other');
      await app.onboarding.finish();

      const reopened = await run({ records });
      expect(reopened.mix.state.categoryIds).toEqual(['test']);
      expect(reopened.onboarding.state.finishedAt).toBeDefined();
    });

    it('keeps a choice made before the app is closed halfway, and the onboarding opens again', async () => {
      const records = new Map<string, string>();
      await (await run({ records })).mix.takeOut('other');

      const reopened = await run({ records });

      expect(reopened.mix.state.categoryIds).toEqual(['test']);
      expect(reopened.onboarding.state.finishedAt).toBeUndefined();
    });

    it('always leaves one Category in the Mix', async () => {
      const app = await run();
      await app.mix.takeOut('other');

      const refused = await app.mix.takeOut('test');

      expect(refused).toBe(false);
      expect(app.mix.state.categoryIds).toEqual(['test']);
      expect(app.mix.state.lastCategoryId).toBe('test');
    });
  });
});
