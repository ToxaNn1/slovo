import { describe, expect, it, vi } from 'vitest';

import { createSettings, openComposition, type AnalyticsPort, type FeatureSwitch } from '../index';
import { switchedOn } from '../edition/edition';
import {
  createFakeBackend,
  createFakeNotificationScheduler,
  createMemoryContentPort,
  type FakeBackend,
} from '../testing';
import {
  fakeClock,
  testEdition,
  word,
  type TestEditionOverrides,
  analyticsInto,
} from '../test-support';
import type { NotificationSchedulerPort } from '../ports';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const content = createMemoryContentPort({
  words: Array.from({ length: 12 }, (_, index) => word(`w_${String(index)}`)),
});

const ALL_ON: readonly FeatureSwitch[] = [
  'wordOfTheDay',
  'questionnaire',
  'dailyGoal',
  'rarityCeiling',
  'analytics',
  'xpLog',
  'rarityTest',
  'notifications',
  'notificationTimeStep',
];

/** One app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  on = ALL_ON,
  api = createFakeBackend(),
  overrides = {},
  scheduler,
  pack = content,
}: {
  pack?: ReturnType<typeof createMemoryContentPort>;
  records?: Map<string, string>;
  on?: readonly FeatureSwitch[];
  api?: FakeBackend;
  overrides?: TestEditionOverrides;
  scheduler?: NotificationSchedulerPort;
} = {}) {
  const events: unknown[][] = [];
  const analytics: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  // The switches in effect as the Edition reads them, with what each depends on.
  const edition = testEdition({
    ...overrides,
    isFeatureEnabled: switchedOn((feature) => on.includes(feature)),
  });
  const settings = createSettings({ userState, defaults: edition.userSettingDefaults });
  const app = await openComposition({
    content: pack,
    edition,
    userState,
    clock: fakeClock('2026-11-01T09:00:00+02:00').clock,
    random: { next: () => 0.25 },
    analytics: analyticsInto(analytics),
    backend: api.backend,
    ...(scheduler === undefined
      ? {}
      : {
          scheduling: {
            scheduler,
            ellipsis: '…',
            titles: ['{word}'],
            farewell: 'Farewell',
            streakWarning: 'Streak warning',
            goalNotMet: 'Goal not met',
          },
        }),
  });
  return { app, events, api, settings };
}

/** The step on screen, or nothing once the onboarding is finished. */
const stepOf = ({ onboarding: { state } }: Awaited<ReturnType<typeof run>>['app']) =>
  state.status === 'open' ? state.step : undefined;
const kinds = (app: Awaited<ReturnType<typeof run>>['app']) => stepOf(app)?.kind;

describe('the onboarding', () => {
  it('runs welcome, the first Word, «Рівень», «Навіщо», the Daily Goal, «Коли нагадати?», then the Feed', async () => {
    const { app } = await run();
    const seen = [];
    for (let i = 0, step = stepOf(app); i < 7 && step !== undefined; i += 1, step = stepOf(app)) {
      const { kind, number, total } = step;
      seen.push(`${kind} ${String(number)}/${String(total)}`);
      await app.onboarding.next();
    }
    expect(seen).toEqual([
      'welcome 1/6',
      'firstWord 2/6',
      'level 3/6',
      'why 4/6',
      'dailyGoal 5/6',
      'notificationTime 6/6',
    ]);
    expect(app.onboarding.state.status).toBe('finished');
  });

  // Spec #1553, ticket #1558: «ГРАЙ!» shows the Games after the first Word.
  it('shows «ГРАЙ!» after the first Word while the Game and `playStep` are on, counted in the steps', async () => {
    const { app } = await run({ on: [...ALL_ON, 'game', 'playStep'] });
    const seen = [];
    for (let i = 0, step = stepOf(app); i < 8 && step !== undefined; i += 1, step = stepOf(app)) {
      const { kind, number, total } = step;
      seen.push(`${kind} ${String(number)}/${String(total)}`);
      await app.onboarding.next();
    }
    expect(seen).toEqual([
      'welcome 1/7',
      'firstWord 2/7',
      'playStep 3/7',
      'level 4/7',
      'why 5/7',
      'dailyGoal 6/7',
      'notificationTime 7/7',
    ]);
  });

  it.each([
    ['the Game', ['playStep']],
    ['`playStep`', ['game']],
  ] as const)(
    'leaves out «ГРАЙ!» with %s off, and the step numbers stay right',
    async (_, more) => {
      const { app } = await run({ on: [...ALL_ON, ...more] });
      await app.onboarding.next();
      await app.onboarding.next();
      expect(stepOf(app)).toMatchObject({ kind: 'level', number: 3, total: 6 });
    },
  );

  // «ГОЛОС» picks the Narrator Voice after the first Word, before «ГРАЙ!».
  it('shows «ГОЛОС» after the first Word while `narratorVoice` and `voiceStep` are on, counted in the steps', async () => {
    const { app } = await run({
      on: [...ALL_ON, 'game', 'playStep', 'pronunciation', 'narratorVoice', 'voiceStep'],
    });
    const seen = [];
    for (let i = 0, step = stepOf(app); i < 9 && step !== undefined; i += 1, step = stepOf(app)) {
      const { kind, number, total } = step;
      seen.push(`${kind} ${String(number)}/${String(total)}`);
      await app.onboarding.next();
    }
    expect(seen).toEqual([
      'welcome 1/8',
      'firstWord 2/8',
      'voiceStep 3/8',
      'playStep 4/8',
      'level 5/8',
      'why 6/8',
      'dailyGoal 7/8',
      'notificationTime 8/8',
    ]);
  });

  it.each([
    ['`narratorVoice`', ['pronunciation', 'voiceStep']],
    ['`voiceStep`', ['pronunciation', 'narratorVoice']],
  ] as const)('leaves out «ГОЛОС» with %s off', async (_, more) => {
    const { app } = await run({ on: [...ALL_ON, ...more] });
    await app.onboarding.next();
    await app.onboarding.next();
    expect(stepOf(app)).toMatchObject({ kind: 'level', number: 3, total: 6 });
  });

  it('shows the Word of the Day as the first Word, and the Edition options of the questions', async () => {
    const { app } = await run();
    await app.onboarding.next();
    const first = stepOf(app);
    expect(first?.kind === 'firstWord' && first.word.wordId).toMatch(/^w_/);
    await app.onboarding.next();
    const level = stepOf(app);
    expect(level?.kind === 'level' && level.options).toEqual([
      { id: 'starting', label: 'Starting' },
      { id: 'good', label: 'Good' },
      { id: 'dont-know', label: 'Not sure' },
    ]);
  });

  it('leaves out the questions with the questionnaire switch off and the Daily Goal with its switch off', async () => {
    const { app } = await run({ on: ['wordOfTheDay'] });
    expect(stepOf(app)).toMatchObject({ kind: 'welcome', total: 2 });
    await app.onboarding.next();
    expect(kinds(app)).toBe('firstWord');
  });

  it('highlights the Edition Daily Goal in Words on its step and sets the goal the reader picks', async () => {
    const { app } = await run({ on: ['dailyGoal', 'xpLog'] });
    while (kinds(app) !== 'dailyGoal') await app.onboarding.next();
    expect(stepOf(app)).toMatchObject({
      kind: 'dailyGoal',
      goals: [10, 25, 50],
      highlighted: 10,
    });
    await app.onboarding.chooseDailyGoal(25);
    expect(app.xpLog.dayOf('2026-11-01').dailyGoal?.goal).toBe(25);
    expect(app.onboarding.state.status).toBe('finished');
  });

  it('leaves the Rarity Range as it is on «Рівень» and sets the kind weights by «Навіщо»', async () => {
    const { app } = await run();
    await app.rarityRange.set({ from: 1, to: 3 });
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('good');
    expect(kinds(app)).toBe('why');
    await app.onboarding.answer('write-correctly');
    expect(app.rarityRange.state).toEqual({ from: 1, to: 3 });
    expect(app.mix.state.kindWeights.correction).toBe('more');
  });

  it('opens the Rarity Test with «Не знаю», numbered as «Рівень», then goes on to «Навіщо»', async () => {
    const { app, events, api } = await run();
    await app.onboarding.next();
    await app.onboarding.next();
    const ceiling = app.rarityRange.state.to;
    await app.onboarding.answer('dont-know');
    expect(stepOf(app)).toEqual({ kind: 'rarityTest', number: 3, total: 6 });
    expect(app.rarityRange.state.to).toBe(ceiling);
    await vi.waitFor(() => {
      expect(api.counters.answers).toEqual([
        { editionId: 'test', question: 'level', answer: 'dont-know' },
      ]);
    });
    expect(events).toContainEqual(['onboardingStepViewed', { step: 'rarityTest' }]);
    expect(events).toContainEqual([
      'questionnaireAnswered',
      { question: 'level', answer: 'dont-know' },
    ]);
    await app.onboarding.next();
    expect(stepOf(app)).toMatchObject({ kind: 'why', number: 4 });
  });

  it('leaves out «Не знаю» and ignores it with the Rarity Test switch off', async () => {
    const { app } = await run({ on: ALL_ON.filter((feature) => feature !== 'rarityTest') });
    await app.onboarding.next();
    await app.onboarding.next();
    const level = stepOf(app);
    expect(level?.kind === 'level' && level.options.map(({ id }) => id)).toEqual([
      'starting',
      'good',
    ]);
    await app.onboarding.answer('dont-know');
    expect(kinds(app)).toBe('level');
  });

  it('keeps the defaults when the questions are skipped', async () => {
    const { app } = await run();
    const before = app.mix.state;
    const ceiling = app.rarityRange.state.to;
    await app.onboarding.finish();
    expect(app.onboarding.state.status).toBe('finished');
    expect(app.rarityRange.state.to).toBe(ceiling);
    expect(app.mix.state.kindWeights).toEqual(before.kindWeights);
  });

  it('ignores an id that is no option, and stays on the step', async () => {
    const { app } = await run();
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('nobody');
    expect(kinds(app)).toBe('level');
  });

  it('counts each answer on the backend with no reader id, and none when sharing is off', async () => {
    const shared = await run();
    await shared.app.onboarding.next();
    await shared.app.onboarding.next();
    await shared.app.onboarding.answer('starting');
    await vi.waitFor(() => {
      expect(shared.api.counters.answers).toEqual([
        { editionId: 'test', question: 'level', answer: 'starting' },
      ]);
    });

    const records = new Map<string, string>();
    const quiet = await run({ records });
    await quiet.settings.update({ shareCounters: false });
    await quiet.app.onboarding.next();
    await quiet.app.onboarding.next();
    await quiet.app.onboarding.answer('starting');
    // Long enough for a count that was sent to arrive.
    for (let turn = 0; turn < 50; turn += 1) await Promise.resolve();
    expect(quiet.api.counters.answers).toEqual([]);
  });

  it('goes on when the count fails', async () => {
    const api = createFakeBackend();
    api.failNext({ reason: 'offline', procedure: 'counters.questionnaire' });
    const { app } = await run({ api });
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('starting');
    expect(kinds(app)).toBe('why');
  });

  describe('counts the Daily Goal and the bucket of the Notification time on the backend with no reader id', () => {
    const counted = (api: FakeBackend) =>
      api.counters.answers.filter(({ question }) => question !== 'level' && question !== 'why');
    async function goTo(app: Awaited<ReturnType<typeof run>>['app'], kind: string) {
      while (stepOf(app) !== undefined && kinds(app) !== kind) {
        await app.onboarding.next();
      }
    }

    it('counts the goal picked and the time chosen', async () => {
      const { app, api } = await run();
      await goTo(app, 'dailyGoal');
      await app.onboarding.chooseDailyGoal(25);
      await app.onboarding.chooseNotificationTime('20:30');

      await vi.waitFor(() => {
        expect(counted(api)).toEqual([
          { editionId: 'test', question: 'dailyGoal', answer: '25' },
          { editionId: 'test', question: 'notificationTime', answer: 'evening' },
        ]);
      });
    });

    it.each([
      ['09:00', 'morning'],
      ['13:00', 'midday'],
      ['20:30', 'evening'],
      ['07:45', 'other'],
      [undefined, 'none'],
    ] as const)('counts %s as %s', async (time, bucket) => {
      const { app, api } = await run();
      await goTo(app, 'notificationTime');
      await app.onboarding.chooseNotificationTime(time);

      await vi.waitFor(() => {
        expect(counted(api).filter(({ question }) => question === 'notificationTime')).toEqual([
          { editionId: 'test', question: 'notificationTime', answer: bucket },
        ]);
      });
    });

    it('counts `none` for a step skipped, by going on or by the skip on it', async () => {
      const goneOn = await run();
      await goTo(goneOn.app, 'notificationTime');
      await goneOn.app.onboarding.next();
      const skipped = await run();
      await goTo(skipped.app, 'dailyGoal');
      await skipped.app.onboarding.finish();

      await vi.waitFor(() => {
        expect(counted(goneOn.api)).toEqual([
          { editionId: 'test', question: 'dailyGoal', answer: 'none' },
          { editionId: 'test', question: 'notificationTime', answer: 'none' },
        ]);
        expect(counted(skipped.api)).toEqual([
          { editionId: 'test', question: 'dailyGoal', answer: 'none' },
        ]);
      });
    });

    it('counts nothing for steps never shown, and nothing when sharing is off', async () => {
      const early = await run();
      await early.app.onboarding.finish();
      const quiet = await run();
      await quiet.settings.update({ shareCounters: false });
      await goTo(quiet.app, 'dailyGoal');
      await quiet.app.onboarding.chooseDailyGoal(10);
      await quiet.app.onboarding.chooseNotificationTime('09:00');

      // Long enough for a count that was sent to arrive.
      for (let turn = 0; turn < 50; turn += 1) await Promise.resolve();
      expect(counted(early.api)).toEqual([]);
      expect(quiet.api.counters.answers).toEqual([]);
      expect(quiet.app.onboarding.state.status).toBe('finished');
    });
  });

  it('emits its Analytics events, and none with sharing off', async () => {
    const { app, events } = await run();
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('starting');
    await app.onboarding.finish();
    expect(events.filter(([event]) => /onboarding|questionnaire/.exec(String(event)))).toEqual([
      ['onboardingStepViewed', { step: 'welcome' }],
      ['onboardingStepViewed', { step: 'firstWord' }],
      ['onboardingStepViewed', { step: 'level' }],
      ['questionnaireAnswered', { question: 'level', answer: 'starting' }],
      ['onboardingStepViewed', { step: 'why' }],
      ['onboardingFinished', { skipped: true }],
    ]);

    const quiet = await run();
    await quiet.settings.update({ shareCounters: false });
    quiet.events.length = 0;
    await quiet.app.onboarding.finish();
    expect(quiet.events).toEqual([]);
  });

  it('is open on a step until finished, then finished as of then with no step', async () => {
    const { app } = await run({ on: ['wordOfTheDay'] });
    expect(app.onboarding.state).toEqual({
      status: 'open',
      step: { kind: 'welcome', number: 1, total: 2 },
    });
    await app.onboarding.finish();
    expect(app.onboarding.state).toEqual({
      status: 'finished',
      finishedAt: new Date('2026-11-01T09:00:00+02:00'),
    });
  });

  it('never opens again once finished, so a reader of the old onboarding sees none', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).app.onboarding.finish();
    const again = await run({ records });
    expect(again.app.onboarding.state.status).toBe('finished');
    expect(again.events.filter(([event]) => event === 'onboardingStepViewed')).toEqual([]);
  });
  // Spec #2060, ticket #2062: the Dashboard asked «Розкрий слово» for the Word «Беру!» took.
  describe('the first Word', () => {
    const heroOf = ({ dashboard }: Awaited<ReturnType<typeof run>>['app']) =>
      dashboard.blocks.flatMap((block) => (block.kind === 'wordOfTheDay' ? [block.hero] : []))[0];

    // Owner decision 20.11: «Беру!» takes the Word then and there, not the end of the onboarding.
    it('is Seen the moment «Беру!» goes on from it, the onboarding still open: the Dashboard, History and the Daily Goal count it', async () => {
      const { app } = await run({ on: [...ALL_ON, 'seenWordXp'] });
      await app.onboarding.next();
      const first = stepOf(app);
      if (first?.kind !== 'firstWord') throw new Error('The first Word is not on screen');
      expect(heroOf(app)?.state).toBe('unrevealed');
      expect(app.history.list).toEqual([]);

      await app.onboarding.next();

      expect(app.onboarding.state.status).toBe('open');
      expect(heroOf(app)).toMatchObject({ state: 'revealed', wordId: first.word.wordId });
      expect(app.history.list.map(({ entryId }) => entryId)).toEqual([first.word.wordId]);

      await app.onboarding.next();
      await app.onboarding.next();
      await app.onboarding.chooseDailyGoal(3);
      await app.onboarding.next();

      expect(app.onboarding.state.status).toBe('finished');
      expect(app.history.list.map(({ entryId }) => entryId)).toEqual([first.word.wordId]);
      expect(app.xpLog.state.dailyGoal).toMatchObject({ goal: 3, seen: 1 });
      // ADR 0202: the goal set after «Беру!» earns the first Word its XP.
      expect(app.xpLog.state.today).toBe(1);
    });

    it('stays Seen when the app closes before the onboarding finishes, and «Беру!» in the next run counts it once', async () => {
      const records = new Map<string, string>();
      const on: readonly FeatureSwitch[] = [...ALL_ON, 'seenWordXp'];
      const { app: closed } = await run({ records, on });
      await closed.onboarding.next();
      await closed.onboarding.next();

      const { app } = await run({ records, on });
      expect(kinds(app)).toBe('welcome');
      expect(heroOf(app)?.state).toBe('revealed');
      expect(app.history.list).toHaveLength(1);

      await app.onboarding.next();
      await app.onboarding.next();
      await app.onboarding.next();
      await app.onboarding.next();
      await app.onboarding.chooseDailyGoal(3);
      expect(app.history.list).toHaveLength(1);
      expect(app.xpLog.state.dailyGoal).toMatchObject({ goal: 3, seen: 1 });
      expect(app.xpLog.state.today).toBe(1);
    });

    it('stays unseen when the reader skips the rest on its step without «Беру!»', async () => {
      const { app } = await run();
      await app.onboarding.next();
      await app.onboarding.finish();

      expect(heroOf(app)?.state).toBe('unrevealed');
      expect(app.history.list).toEqual([]);
    });

    it('stays unseen when the onboarding is skipped before it was shown', async () => {
      const { app } = await run({ on: [...ALL_ON, 'seenWordXp'] });
      await app.onboarding.finish();

      expect(heroOf(app)?.state).toBe('unrevealed');
      expect(app.history.list).toEqual([]);
      expect(app.xpLog.state.total).toBe(0);
    });
  });

  // Spec #1553, ticket #1559.
  describe('«Коли нагадати?»', () => {
    /** Goes on to the step of `kind`. */
    async function goTo(app: Awaited<ReturnType<typeof run>>['app'], kind: string) {
      while (stepOf(app) !== undefined && kinds(app) !== kind) {
        await app.onboarding.next();
      }
    }

    it('offers 09:00, 13:00 and 20:30, and a chosen time becomes the only Notification time', async () => {
      const { app } = await run();
      await goTo(app, 'notificationTime');
      const step = stepOf(app);
      expect(step?.kind === 'notificationTime' && step.times).toEqual(['09:00', '13:00', '20:30']);

      await app.onboarding.chooseNotificationTime('07:45');

      expect(app.notifications.state.times).toEqual({
        kind: 'on',
        word: '07:45',
        reminder: undefined,
      });
      expect(app.onboarding.state.status).toBe('finished');
    });

    it('offers the Edition times and counts each by its bucket', async () => {
      const { app, api } = await run({
        overrides: {
          onboardingNotificationTimes: { morning: '08:15', midday: '12:00', evening: '21:00' },
        },
      });
      await goTo(app, 'notificationTime');
      const step = stepOf(app);
      expect(step?.kind === 'notificationTime' && step.times).toEqual(['08:15', '12:00', '21:00']);

      await app.onboarding.chooseNotificationTime('21:00');

      await vi.waitFor(() => {
        expect(
          api.counters.answers.filter(({ question }) => question === 'notificationTime'),
        ).toEqual([{ editionId: 'test', question: 'notificationTime', answer: 'evening' }]);
      });
    });

    it('keeps the time and goes on when asking the permission fails', async () => {
      const fake = createFakeNotificationScheduler();
      const scheduler: NotificationSchedulerPort = {
        ...fake,
        permission: () => Promise.resolve('not-asked'),
        askPermission: () => Promise.reject(new Error('no device')),
      };
      const { app } = await run({ scheduler });
      await goTo(app, 'notificationTime');

      await app.onboarding.chooseNotificationTime('09:00');

      expect(app.notifications.state.times).toEqual({
        kind: 'on',
        word: '09:00',
        reminder: undefined,
      });
      expect(app.onboarding.state.status).toBe('finished');
    });

    it('leaves no Notification time after «Без нагадувань»', async () => {
      const { app } = await run();
      await goTo(app, 'notificationTime');

      await app.onboarding.chooseNotificationTime(undefined);

      expect(app.notifications.state.times).toEqual({ kind: 'off' });
      expect(app.onboarding.state.status).toBe('finished');
    });

    it('keeps the default Notification times and the later explainer when skipped', async () => {
      const records = new Map<string, string>();
      const { app } = await run({ records });
      const defaults = app.notifications.state.times;
      await goTo(app, 'notificationTime');

      await app.onboarding.next();

      expect(app.onboarding.state.status).toBe('finished');
      expect(app.notifications.state.times).toEqual(defaults);
      expect(records.has('notifications.ask')).toBe(false);
    });

    it('is absent with notifications or its switch off, and ignores a time on another step', async () => {
      for (const off of ['notifications', 'notificationTimeStep'] as const) {
        const { app } = await run({ on: ALL_ON.filter((feature) => feature !== off) });
        const before = app.notifications.state.times;
        await app.onboarding.chooseNotificationTime('07:45');
        expect(kinds(app)).toBe('welcome');
        await goTo(app, 'notificationTime');
        expect(app.onboarding.state.status).toBe('finished');
        expect(app.notifications.state.times).toEqual(before);
      }
    });
  });
});

describe('the onboarding, step by step', () => {
  it('leaves out the first Word while there is no Word of the Day', async () => {
    const { app } = await run({ pack: createMemoryContentPort({ words: [] }) });
    const seen = [];
    for (let i = 0, step = stepOf(app); i < 6 && step !== undefined; i += 1, step = stepOf(app)) {
      seen.push(`${step.kind} ${String(step.number)}/${String(step.total)}`);
      await app.onboarding.next();
    }
    expect(seen).toEqual([
      'welcome 1/5',
      'level 2/5',
      'why 3/5',
      'dailyGoal 4/5',
      'notificationTime 5/5',
    ]);
  });

  it('shows the Edition options of «Навіщо» on its step', async () => {
    const { app } = await run();
    for (let i = 0; i < 3; i += 1) await app.onboarding.next();
    const why = stepOf(app);
    expect(why?.kind === 'why' && why.options).toEqual([
      { id: 'write-correctly', label: 'Write correctly' },
      { id: 'play', label: 'Play' },
    ]);
  });

  it('tells each subscriber of every step it goes on to', async () => {
    const { app } = await run();
    const told: unknown[] = [];
    app.onboarding.subscribe(() => told.push(kinds(app)));
    await app.onboarding.next();
    await app.onboarding.next();
    expect(told).toEqual(['firstWord', 'level']);
  });

  it('takes one of two Daily Goals chosen at once, and counts it once', async () => {
    const { app, api } = await run();
    while (stepOf(app) !== undefined && kinds(app) !== 'dailyGoal') await app.onboarding.next();
    await Promise.all([app.onboarding.chooseDailyGoal(25), app.onboarding.chooseDailyGoal(50)]);
    await vi.waitFor(() => {
      expect(api.counters.answers.filter(({ question }) => question === 'dailyGoal')).toEqual([
        { editionId: 'test', question: 'dailyGoal', answer: '25' },
      ]);
    });
    expect(kinds(app)).toBe('notificationTime');
  });

  it('does nothing for a call once finished', async () => {
    const { app, events } = await run();
    await app.onboarding.finish();
    events.length = 0;
    await app.onboarding.next();
    await app.onboarding.finish();
    expect(app.onboarding.state.status).toBe('finished');
    expect(events).toEqual([]);
  });

  it('finishes as not skipped past the last step', async () => {
    const { app, events } = await run();
    for (let i = 0; i < 6; i += 1) await app.onboarding.next();
    expect(app.onboarding.state.status).toBe('finished');
    expect(events).toContainEqual(['onboardingFinished', { skipped: false }]);
    expect(events).not.toContainEqual(['onboardingFinished', { skipped: true }]);
  });

  it('ignores an answer on a step that asks no question', async () => {
    const { app, events } = await run();
    await app.onboarding.answer('play');
    expect(kinds(app)).toBe('welcome');
    expect(events).not.toContainEqual([
      'questionnaireAnswered',
      { question: 'welcome', answer: 'play' },
    ]);
  });

  it('opens the Rarity Test only from «Рівень», never by its id on «Навіщо»', async () => {
    const { app } = await run();
    for (let i = 0; i < 3; i += 1) await app.onboarding.next();
    await app.onboarding.answer('dont-know');
    expect(kinds(app)).toBe('why');
  });

  it('ignores a Daily Goal chosen on another step', async () => {
    const { app } = await run({ on: ['dailyGoal', 'xpLog'] });
    const before = app.xpLog.state.dailyGoal;
    await app.onboarding.chooseDailyGoal(50);
    expect(kinds(app)).toBe('welcome');
    expect(app.xpLog.state.dailyGoal).toEqual(before);
  });
});
