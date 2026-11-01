import { describe, expect, it } from 'vitest';

import type { Category, FeatureSwitch } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  userStateRecords,
  type AnalyticsPort,
  type Composition,
  type FeedCard,
} from '../index';
import { createMemoryContentPort } from '../testing';
import type { UserState } from '../user-state/user-state';
import { fakeClock, randomOf, testEdition, word } from '../test-support';

const categories: readonly Category[] = [
  { id: 'nature', displayName: 'Nature' },
  { id: 'people', displayName: 'People' },
  { id: 'things', displayName: 'Things' },
];

const content = createMemoryContentPort({
  categories,
  words: categories.flatMap(({ id: categoryId }) =>
    Array.from({ length: 6 }, (_, index) => word(`w_${categoryId}_${index}`, { categoryId })),
  ),
});

/** 09:00 in Kyiv on the local day `date` (`YYYY-MM-DD`). */
const morningOf = (date: string) => `${date}T09:00:00+03:00`;

/** Every Feature Switch on but those in `off`. */
const switchesBut =
  (off: readonly FeatureSwitch[]) =>
  (feature: FeatureSwitch): boolean =>
    !off.includes(feature);

/** The Core composition of one app run on the day `on`, over the records, so the user state survives between runs. */
async function run({
  records,
  on,
  off = [],
  events = [],
}: {
  records: Map<string, string>;
  on: string;
  off?: readonly FeatureSwitch[];
  events?: unknown[][];
}): Promise<Composition & { userState: UserState }> {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  const analytics: AnalyticsPort = {
    track: (event, properties) => {
      if (event === 'laterQuestionAnswered') events.push([event, properties]);
    },
    stop: () => undefined,
  };
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: switchesBut(['firstWeek', 'weeklyRecap', 'enoughForToday', ...off]),
    }),
    userState,
    clock: fakeClock(morningOf(on)).clock,
    random: randomOf(0.25),
    analytics,
  });
  return Object.assign(app, { userState });
}

/** The later questions among the Feed's first `count` cards of the run. */
async function laterQuestionsIn(app: Composition, count = 8): Promise<readonly string[]> {
  const cards: FeedCard[] = [];
  while (app.feed.cards.length < count) {
    if ((await app.feed.next()) === undefined) break;
  }
  cards.push(...app.feed.cards);
  return cards.flatMap((card) =>
    card.kind === 'notice' && card.notice !== 'levelMilestone' ? [card.notice] : [],
  );
}

/** Records of a reader who finished the onboarding before it asked a Daily Goal. */
async function existingReader(): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  await userState.write(userStateRecords.onboardingFinished.change('2026-01-10T09:00:00.000Z'));
  return records;
}

/** Records of a reader who finishes today's onboarding on the local day `on`. */
async function newReader(on: string): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  await (await run({ records, on })).onboarding.finish();
  return records;
}

// Ticket #1380, ADR 0067: the later questions come through Feed Notices, one a local day, each once.
describe('The later questions', () => {
  it('gives an existing reader the Daily Goal choice once, with 20 until they choose', async () => {
    const records = await existingReader();

    const first = await run({ records, on: '2026-11-02' });

    expect(await laterQuestionsIn(first)).toEqual(['dailyGoalChoice']);
    expect(first.xpLog.state.dailyGoal?.goal).toBe(20);
    await first.questionnaire.chooseDailyGoal(30);
    expect(first.xpLog.state.dailyGoal?.goal).toBe(30);

    const sameDay = await run({ records, on: '2026-11-02' });
    expect(await laterQuestionsIn(sameDay)).toEqual([]);
    const nextDay = await run({ records, on: '2026-11-03' });
    expect(await laterQuestionsIn(nextDay)).toEqual(['interests']);
  });

  it('asks each question once, one a local day, in order, even one swiped past', async () => {
    const records = await existingReader();

    const asked = [];
    for (const on of ['02', '03', '04', '05', '06', '07']) {
      const app = await run({ records, on: `2026-11-${on}` });
      asked.push(await laterQuestionsIn(app));
      if (on === '04') await app.questionnaire.answer('selfRating', 'many');
    }

    expect(asked).toEqual([
      ['dailyGoalChoice'],
      ['interests'],
      ['selfRating'],
      ['rarityTest'],
      ['mixReview'],
      [],
    ]);
  });

  it('keeps an unanswered question its day, so a second run that day still shows it', async () => {
    const records = await existingReader();

    await laterQuestionsIn(await run({ records, on: '2026-11-02' }));

    expect(await laterQuestionsIn(await run({ records, on: '2026-11-02' }))).toEqual([
      'dailyGoalChoice',
    ]);
  });

  it('asks a new reader nothing on the onboarding day and no Daily Goal after', async () => {
    const records = await newReader('2026-11-02');

    expect(await laterQuestionsIn(await run({ records, on: '2026-11-02' }))).toEqual([]);
    expect(await laterQuestionsIn(await run({ records, on: '2026-11-03' }))).toEqual(['interests']);
  });

  it('hides the Categories the reader leaves out of their interests', async () => {
    const records = await newReader('2026-11-01');
    const app = await run({ records, on: '2026-11-02' });

    await app.questionnaire.chooseInterests(['people']);

    expect(app.mix.state.categoryIds).toEqual(['people']);
    expect(app.mix.state.hiddenCategories.map(({ id }) => id)).toEqual(['nature', 'things']);
  });

  it('sets the Rarity Floor from the self-rating and offers no Rarity Test when it says not to', async () => {
    const records = await newReader('2026-10-31');
    await laterQuestionsIn(await run({ records, on: '2026-11-01' }));
    const app = await run({ records, on: '2026-11-02' });
    expect(await laterQuestionsIn(app)).toEqual(['selfRating']);

    await app.questionnaire.answer('selfRating', 'few');

    expect(app.mix.state.rarityFloor).toBe(1);
    expect(await laterQuestionsIn(await run({ records, on: '2026-11-03' }))).toEqual(['mixReview']);
  });

  it('raises the Rarity Ceiling with a Floor above it', async () => {
    const records = await newReader('2026-11-01');
    const app = await run({ records, on: '2026-11-02' });
    await app.mix.setRarityCeiling(2);

    await app.questionnaire.answer('selfRating', 'many');

    expect(app.mix.state.rarityFloor).toBe(3);
    expect(app.mix.state.rarityCeiling).toBe(3);
  });

  it('skips a question whose feature is off', async () => {
    const records = await existingReader();

    const app = await run({ records, on: '2026-11-02', off: ['dailyGoal'] });

    expect(await laterQuestionsIn(app)).toEqual(['interests']);
  });

  it('asks nothing while the laterQuestions Feature Switch is off', async () => {
    const records = await existingReader();

    expect(
      await laterQuestionsIn(await run({ records, on: '2026-11-02', off: ['laterQuestions'] })),
    ).toEqual([]);
  });

  it('puts a question off with «Пізніше» until the next question day', async () => {
    const records = await existingReader();
    const app = await run({ records, on: '2026-11-02' });
    await laterQuestionsIn(app);

    await app.questionnaire.later('dailyGoalChoice');

    expect(app.xpLog.state.dailyGoal?.goal).toBe(20);
    expect(await laterQuestionsIn(await run({ records, on: '2026-11-02' }))).toEqual([]);
  });

  it('emits laterQuestionAnswered for each answer, and none while sharing is off', async () => {
    const records = await existingReader();
    const events: unknown[][] = [];
    const app = await run({ records, on: '2026-11-02', events });

    await app.questionnaire.chooseDailyGoal(50);
    await app.questionnaire.chooseInterests(['nature', 'things']);
    await app.questionnaire.answer('selfRating', 'many');
    await app.questionnaire.open('rarityTest');
    await app.questionnaire.later('mixReview');
    await app.userState.write(userStateRecords.shareCounters.change(false));
    await app.questionnaire.open('mixReview');

    expect(events).toEqual([
      ['laterQuestionAnswered', { question: 'dailyGoalChoice', answer: '50' }],
      ['laterQuestionAnswered', { question: 'interests', answer: 'nature,things' }],
      ['laterQuestionAnswered', { question: 'selfRating', answer: 'many' }],
      ['laterQuestionAnswered', { question: 'rarityTest', answer: 'open' }],
      ['laterQuestionAnswered', { question: 'mixReview', answer: 'later' }],
    ]);
  });
});
