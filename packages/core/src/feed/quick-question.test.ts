import { describe, expect, it } from 'vitest';

import { openComposition, type AnalyticsPort, type FeatureSwitch, type FeedCard } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word, analyticsInto } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

// Spec #1358, ticket #1374, ADR 0066: the Quick Question in the Feed.

const words = Array.from({ length: 14 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words,
});

const ALL_ON: readonly FeatureSwitch[] = [
  'xpLog',
  'game',
  'quickQuestion',
  // A mode whose Round is a pick, and one whose Round is not.
  'gameGuessWord',
  'gamePairs',
  'knowledge',
  'confirmedEntries',
  'analytics',
];

/** The Core composition of one app run over the records, with the analytics events it emits. */
async function run({
  records = new Map<string, string>(),
  on = ALL_ON,
  over = content,
}: {
  records?: Map<string, string>;
  on?: readonly FeatureSwitch[];
  over?: typeof content;
} = {}) {
  const events: [string, unknown][] = [];
  const analytics: AnalyticsPort = {
    // The onboarding, which opens on a fresh user state, has events of its own.
    track: (event, properties) => {
      if (!event.startsWith('onboarding')) events.push([event, properties]);
    },
    stop: () => undefined,
  };
  const time = fakeClock('2026-10-14T08:00:00+03:00');
  const app = await openComposition({
    content: over,
    edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: seededRandom(7),
    analytics: analyticsInto(analytics),
  });
  return { app, events, time };
}

type App = Awaited<ReturnType<typeof run>>['app'];

/** The Feed's first `count` cards. */
async function cardsOf(app: App, count: number): Promise<readonly FeedCard[]> {
  while (app.feed.cards.length < count) {
    if ((await app.feed.next()) === undefined) break;
  }
  return app.feed.cards.slice(0, count);
}

/** The places of the Quick Questions among the Feed's first `count` cards. */
async function askedAt(app: App, count: number): Promise<number[]> {
  return (await cardsOf(app, count)).flatMap((card, place) =>
    card.kind === 'quick-question' ? [place] : [],
  );
}

/** The first Quick Question of the Feed and its place. */
async function firstQuestion(app: App) {
  const cards = await cardsOf(app, 12);
  const position = cards.findIndex((card) => card.kind === 'quick-question');
  const card = cards[position];
  if (card?.kind !== 'quick-question') throw new Error('No Quick Question');
  return { card, position };
}

describe('the Quick Question frequency', () => {
  it('takes every 10th card by default', async () => {
    const { app } = await run();

    expect(await askedAt(app, 25)).toEqual([9, 19]);
  });

  it('takes every 6th card when the Mix says so', async () => {
    const { app } = await run();
    await app.mix.setQuickQuestionEvery(6);

    expect(await askedAt(app, 18)).toEqual([5, 11, 17]);
  });

  it('never comes while the Mix turns it off', async () => {
    const { app } = await run();
    await app.mix.setQuickQuestionEvery('off');

    expect(await askedAt(app, 25)).toEqual([]);
  });

  it.each<FeatureSwitch>(['quickQuestion', 'game'])(
    'never comes with the %s switch off',
    async (off) => {
      const { app } = await run({ on: ALL_ON.filter((feature) => feature !== off) });

      expect(app.mix.quickQuestionEveryInEffect()).toBeUndefined();
      expect(await askedAt(app, 25)).toEqual([]);
    },
  );

  it("comes as often as the reader's choice in the Mix, which off stops it", async () => {
    const { app } = await run();
    await app.mix.setQuickQuestionEvery(6);
    expect(app.mix.quickQuestionEveryInEffect()).toBe(6);

    await app.mix.setQuickQuestionEvery('off');

    expect(app.mix.quickQuestionEveryInEffect()).toBeUndefined();
  });

  it('gives its slot to a Word due for Review first and comes right after it', async () => {
    const due = new Map(
      words
        .slice(0, 2)
        .map(({ id }) => [
          `knowledge.${id}`,
          JSON.stringify({ mark: 'unknown', step: 1, reviewDay: '2026-10-13', learned: false }),
        ]),
    );
    const { app } = await run({ records: due });
    await app.mix.setQuickQuestionEvery(6);

    const cards = await cardsOf(app, 8);

    expect(cards[5]).toMatchObject({ kind: 'word', review: true });
    expect(cards[6]?.kind).toBe('quick-question');
  });
});

describe('a Quick Question answered', () => {
  it('asks one pick Round of an Eligible Entry', async () => {
    const { app } = await run();
    const { card } = await firstQuestion(app);

    expect(words.map(({ id }) => id)).toContain(card.entry.id);
    expect(card.round.form).toBe('pick');
    expect(card.round.options[card.round.correct]).toBeDefined();
  });

  it('right earns 2 XP and confirms its Entry', async () => {
    const { app, events } = await run();
    const { card, position } = await firstQuestion(app);

    const right = await app.feed.answerQuickQuestion(position, card.round.correct);

    expect(right).toBe(true);
    expect(app.xpLog.state).toMatchObject({ total: 2, today: 2 });
    expect(app.knowledge.state.confirmed.total).toBe(1);
    expect(app.feed.cards[position]).toMatchObject({ answered: card.round.correct });
    expect(events).toContainEqual([
      'quickQuestionAnswered',
      { right: true, entryKind: 'word', rarity: 3, categoryId: 'test' },
    ]);
  });

  it('wrong marks its Entry Unknown and earns nothing', async () => {
    const { app, events } = await run();
    const { card, position } = await firstQuestion(app);
    const wrong = (card.round.correct + 1) % card.round.options.length;

    const right = await app.feed.answerQuickQuestion(position, wrong);

    expect(right).toBe(false);
    expect(app.knowledge.state.shown.get(card.entry.id)).toBe('unknown');
    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });
    expect(app.knowledge.state.confirmed.total).toBe(0);
    expect(events).toContainEqual([
      'quickQuestionAnswered',
      { right: false, entryKind: 'word', rarity: 3, categoryId: 'test' },
    ]);
  });

  it('is answered once: a second answer changes nothing', async () => {
    const { app } = await run();
    const { card, position } = await firstQuestion(app);
    await app.feed.answerQuickQuestion(position, card.round.correct);

    expect(await app.feed.answerQuickQuestion(position, card.round.correct)).toBeUndefined();
    expect(app.xpLog.state).toMatchObject({ total: 2, today: 2 });
  });

  it('makes nothing Seen when the reader leaves it', async () => {
    const { app, events, time } = await run();
    const { position } = await firstQuestion(app);
    await app.feed.show(position);
    const seenBefore = events.filter(([event]) => event === 'seen').length;

    time.advance(5_000);
    await app.feed.show(position + 1);

    expect(events.filter(([event]) => event === 'seen').length).toBe(seenBefore);
  });
});

describe('a Quick Question prompt', () => {
  /** Words whose Definitions run past what a Feed card holds, all but those in `short`. */
  function overLong(short: readonly string[]) {
    return createMemoryContentPort({
      categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
      words: words.map((each) =>
        short.includes(each.id)
          ? each
          : {
              ...each,
              primaryDefinition: `The meaning of ${each.lemma}. ${'More of it. '.repeat(11)}`,
            },
      ),
    });
  }

  it('is never longer than 140 characters: a longer Entry is not asked', async () => {
    const { app } = await run({ over: overLong(['w_05']) });
    await app.mix.setQuickQuestionEvery(6);

    const asked = (await cardsOf(app, 24)).flatMap((card) =>
      card.kind === 'quick-question' ? [card] : [],
    );

    expect(asked.length).toBeGreaterThan(0);
    for (const card of asked) {
      expect(card.entry.id).toBe('w_05');
      expect(card.round.prompt.length).toBeLessThanOrEqual(140);
    }
  });

  it('gives no Quick Question when no Entry fits', async () => {
    const { app } = await run({ over: overLong([]) });

    expect(await askedAt(app, 25)).toEqual([]);
  });
});
