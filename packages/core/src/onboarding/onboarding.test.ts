import { describe, expect, it, vi } from 'vitest';

import { createSettings, openComposition, type AnalyticsPort, type FeatureSwitch } from '../index';
import { createFakeBackend, createMemoryContentPort, type FakeBackend } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
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
];

/** One app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  on = ALL_ON,
  api = createFakeBackend(),
}: { records?: Map<string, string>; on?: readonly FeatureSwitch[]; api?: FakeBackend } = {}) {
  const events: unknown[][] = [];
  const analytics: AnalyticsPort = {
    track: (event, properties) => void events.push([event, properties]),
    stop: () => undefined,
  };
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  const edition = testEdition({ isFeatureEnabled: (feature) => on.includes(feature) });
  const settings = createSettings({ userState, defaults: edition.userSettingDefaults });
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: fakeClock('2026-11-01T09:00:00+02:00').clock,
    random: { next: () => 0.25 },
    analytics,
    backend: api.backend,
  });
  return { app, events, api, settings };
}

const kinds = (app: Awaited<ReturnType<typeof run>>['app']) => app.onboarding.state.step?.kind;

describe('the onboarding', () => {
  it('runs welcome, the first Word, «Хто ви», «Навіщо», the Daily Goal, then the Feed', async () => {
    const { app } = await run();
    const seen = [];
    for (let i = 0; i < 6 && app.onboarding.state.step !== undefined; i += 1) {
      const { kind, number, total } = app.onboarding.state.step;
      seen.push(`${kind} ${String(number)}/${String(total)}`);
      await app.onboarding.next();
    }
    expect(seen).toEqual(['welcome 1/5', 'firstWord 2/5', 'who 3/5', 'why 4/5', 'dailyGoal 5/5']);
    expect(app.onboarding.state.finishedAt).toBeInstanceOf(Date);
  });

  it('shows the Word of the Day as the first Word, and the Edition options of the questions', async () => {
    const { app } = await run();
    await app.onboarding.next();
    const first = app.onboarding.state.step;
    expect(first?.kind === 'firstWord' && first.word.wordId).toMatch(/^w_/);
    await app.onboarding.next();
    const who = app.onboarding.state.step;
    expect(who?.kind === 'who' && who.options).toEqual([
      { id: 'studying', label: 'Studying' },
      { id: 'working', label: 'Working' },
    ]);
  });

  it('leaves out the questions with the questionnaire switch off and the Daily Goal with its switch off', async () => {
    const { app } = await run({ on: ['wordOfTheDay'] });
    expect(app.onboarding.state.step).toMatchObject({ kind: 'welcome', total: 2 });
    await app.onboarding.next();
    expect(kinds(app)).toBe('firstWord');
  });

  it('highlights 20 on the Daily Goal step and sets the goal the reader picks', async () => {
    const { app } = await run({ on: ['dailyGoal', 'xpLog'] });
    while (kinds(app) !== 'dailyGoal') await app.onboarding.next();
    expect(app.onboarding.state.step).toMatchObject({
      kind: 'dailyGoal',
      goals: [10, 20, 30, 50],
      highlighted: 20,
    });
    await app.onboarding.chooseDailyGoal(30);
    expect(app.xpLog.dayOf('2026-11-01').dailyGoal?.goal).toBe(30);
    expect(app.onboarding.state.step).toBeUndefined();
  });

  it('sets the Rarity Ceiling by «Хто ви» and the kind weights by «Навіщо»', async () => {
    const { app } = await run();
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('studying');
    expect(kinds(app)).toBe('why');
    await app.onboarding.answer('write-correctly');
    expect(app.mix.state.rarityCeiling).toBe(4);
    expect(app.mix.state.kindWeights.correction).toBe('more');
  });

  it('keeps the defaults when the questions are skipped', async () => {
    const { app } = await run();
    const before = app.mix.state;
    await app.onboarding.finish();
    expect(app.onboarding.state.step).toBeUndefined();
    expect(app.mix.state.rarityCeiling).toBe(before.rarityCeiling);
    expect(app.mix.state.kindWeights).toEqual(before.kindWeights);
  });

  it('ignores an id that is no option, and stays on the step', async () => {
    const { app } = await run();
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('nobody');
    expect(kinds(app)).toBe('who');
  });

  it('counts each answer on the backend with no reader id, and none when sharing is off', async () => {
    const shared = await run();
    await shared.app.onboarding.next();
    await shared.app.onboarding.next();
    await shared.app.onboarding.answer('working');
    await vi.waitFor(() => {
      expect(shared.api.counters.answers).toEqual([
        { editionId: 'test', question: 'who', answer: 'working' },
      ]);
    });

    const records = new Map<string, string>();
    const quiet = await run({ records });
    await quiet.settings.update({ shareCounters: false });
    await quiet.app.onboarding.next();
    await quiet.app.onboarding.next();
    await quiet.app.onboarding.answer('working');
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
    await app.onboarding.answer('working');
    expect(kinds(app)).toBe('why');
  });

  it('emits its Analytics events, and none with sharing off', async () => {
    const { app, events } = await run();
    await app.onboarding.next();
    await app.onboarding.next();
    await app.onboarding.answer('working');
    await app.onboarding.finish();
    expect(events.filter(([event]) => /onboarding|questionnaire/.exec(String(event)))).toEqual([
      ['onboardingStepViewed', { step: 'welcome' }],
      ['onboardingStepViewed', { step: 'firstWord' }],
      ['onboardingStepViewed', { step: 'who' }],
      ['questionnaireAnswered', { question: 'who', answer: 'working' }],
      ['onboardingStepViewed', { step: 'why' }],
      ['onboardingFinished', { skipped: true }],
    ]);

    const quiet = await run();
    await quiet.settings.update({ shareCounters: false });
    quiet.events.length = 0;
    await quiet.app.onboarding.finish();
    expect(quiet.events).toEqual([]);
  });

  it('never opens again once finished, so a reader of the old onboarding sees none', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).app.onboarding.finish();
    const again = await run({ records });
    expect(again.app.onboarding.state.step).toBeUndefined();
    expect(again.events.filter(([event]) => event === 'onboardingStepViewed')).toEqual([]);
  });
});
