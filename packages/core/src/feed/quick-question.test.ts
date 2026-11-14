import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import { openComposition, type AnalyticsPort, type FeatureSwitch, type FeedCard } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word, analyticsInto } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

// Spec #1358, ticket #1374, ADR 0066: the Quick Question in the Feed.

const words = Array.from({ length: 14 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));
/** The Language Pack of the Words alone. */
const packOf = (ofWords: readonly Word[]) =>
  createMemoryContentPort({
    categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
    words: [...ofWords],
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
  of = words,
}: {
  records?: Map<string, string>;
  on?: readonly FeatureSwitch[];
  of?: readonly Word[];
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
    content: packOf(of),
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

  it('says it came from the Game Mode whose Round it asks', async () => {
    const { app } = await run();
    const { card } = await firstQuestion(app);

    expect(card.source).toEqual({ kind: 'game-mode', modeId: 'guess-word' });
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
      { right: true, mode: 'guess-word', entryKind: 'word', rarity: 3, categoryId: 'test' },
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
      { right: false, mode: 'guess-word', entryKind: 'word', rarity: 3, categoryId: 'test' },
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

// Spec #1831, ticket #1833, ADR 0128: the Word Meaning question.

/** The Quick Question with the Word Meaning question alone: no Game Mode whose Round is a pick is on. */
const WORD_MEANING_ONLY: readonly FeatureSwitch[] = [
  'xpLog',
  'game',
  'quickQuestion',
  'quickQuestionWordMeaning',
  'knowledge',
  'confirmedEntries',
  'analytics',
];

/** The same with «Вгадай слово», whose Round is a pick, on beside it. */
const WITH_GUESS_WORD: readonly FeatureSwitch[] = [...WORD_MEANING_ONLY, 'gameGuessWord'];

const numbered = (index: number) => String(index).padStart(2, '0');

/** A Word the Word Meaning question may ask: its Definition names it by its number alone. */
const meant = (index: number, overrides: Partial<Word> = {}): Word =>
  word(`w_m${numbered(index)}`, {
    lemma: `lemma${numbered(index)}`,
    primaryDefinition: `What number ${String(index)} stands for.`,
    ...overrides,
  });

/** A Word whose Definition holds its own Lemma, in other letter case. */
const selfNamed = (index: number, overrides: Partial<Word> = {}): Word =>
  meant(index, { primaryDefinition: `Anything a LEMMA${numbered(index)} does.`, ...overrides });

const meantWords = Array.from({ length: 14 }, (_, index) => meant(index));

/** The Quick Questions among the Feed's first `count` cards, one in every six. */
async function questionsOf(app: App, count: number) {
  await app.mix.setQuickQuestionEvery(6);
  return (await cardsOf(app, count)).flatMap((card) =>
    card.kind === 'quick-question' ? [card] : [],
  );
}

type Question = Awaited<ReturnType<typeof questionsOf>>[number];

const textsOf = (card: Question) => card.round.options.map(({ text }) => text);

const sourceIdOf = ({ source }: Question) =>
  source.kind === 'game-mode' ? source.modeId : source.kind;

describe('the Word Meaning question', () => {
  it("asks an Eligible Word by its Lemma and offers four Definitions, the Word's own the right one", async () => {
    const { app } = await run({ on: WORD_MEANING_ONLY, of: meantWords });

    const { card } = await firstQuestion(app);

    const asked = meantWords.find(({ id }) => id === card.entry.id);
    expect(asked).toBeDefined();
    expect(card.source).toEqual({ kind: 'word-meaning' });
    expect(card.round).toMatchObject({ form: 'pick', prompt: asked?.lemma, labelKind: 'meaning' });
    expect(card.round.options).toHaveLength(4);
    expect(card.round.options[card.round.correct]?.text).toBe(asked?.primaryDefinition);
  });

  it('offers the Definitions of other Words of the same part of speech, whole', async () => {
    const long = 'A meaning that runs on and on, well past a line. '.repeat(5);
    const mixed = Array.from({ length: 14 }, (_, index) =>
      meant(index, {
        partOfSpeech: index < 7 ? 'noun' : 'verb',
        primaryDefinition: `${long}It is number ${String(index)}.`,
      }),
    );
    const { app } = await run({ on: WORD_MEANING_ONLY, of: mixed });

    const questions = await questionsOf(app, 48);

    expect(questions).toHaveLength(8);
    for (const card of questions) {
      const offered = textsOf(card).map((text) =>
        mixed.find(({ primaryDefinition }) => primaryDefinition === text),
      );
      const asked = mixed.find(({ id }) => id === card.entry.id);
      expect(asked).toBeDefined();
      expect(offered.map((each) => each?.partOfSpeech)).toEqual(
        Array.from({ length: 4 }, () => asked?.partOfSpeech),
      );
      expect(new Set(offered.map((each) => each?.id)).size).toBe(4);
    }
  });

  it('fills the options from other parts of speech when its own has too few', async () => {
    const nouns = [meant(0), meant(1)];
    // The verbs are never asked, their Definitions holding their Lemmas, and still offered.
    const verbs = Array.from({ length: 12 }, (_, index) =>
      selfNamed(index + 2, { partOfSpeech: 'verb' }),
    );
    const { app } = await run({ on: WORD_MEANING_ONLY, of: [...nouns, ...verbs] });

    const { card } = await firstQuestion(app);

    const offered = textsOf(card);
    expect(offered).toHaveLength(4);
    expect(offered).toEqual(expect.arrayContaining(nouns.map((noun) => noun.primaryDefinition)));
    expect(
      offered.filter((text) => verbs.some((verb) => verb.primaryDefinition === text)),
    ).toHaveLength(2);
  });

  it('never offers two Definitions alike', async () => {
    // Five meanings among fourteen Words, written in differing case and spacing.
    const alike = Array.from({ length: 14 }, (_, index) =>
      meant(index, {
        primaryDefinition: `${index % 2 === 0 ? 'Meaning  number' : 'MEANING number'} ${String(index % 5)}.`,
      }),
    );
    const { app } = await run({ on: WORD_MEANING_ONLY, of: alike });

    const questions = await questionsOf(app, 48);

    expect(questions).toHaveLength(8);
    for (const card of questions) {
      const keys = textsOf(card).map((text) => text.toLowerCase().replaceAll(/\s+/g, ' '));
      expect(new Set(keys).size).toBe(4);
    }
  });

  it("never offers a homonym's Definition, which would be right too", async () => {
    // Seven pairs of homonyms, each pair one Lemma with two meanings.
    const homonyms = Array.from({ length: 14 }, (_, index) =>
      meant(index, { lemma: `lemma${numbered(index % 7)}` }),
    );
    const { app } = await run({ on: WORD_MEANING_ONLY, of: homonyms });

    const questions = await questionsOf(app, 48);

    expect(questions).toHaveLength(8);
    for (const card of questions) {
      const asked = homonyms.find(({ id }) => id === card.entry.id);
      const lemmas = textsOf(card).map(
        (text) => homonyms.find(({ primaryDefinition }) => primaryDefinition === text)?.lemma,
      );
      expect(lemmas.filter((lemma) => lemma === asked?.lemma)).toHaveLength(1);
    }
  });

  it('never asks a Word whose Definition holds its Lemma', async () => {
    const plain = [meant(0), meant(1), meant(2)];
    const named = Array.from({ length: 11 }, (_, index) => selfNamed(index + 3));
    const { app } = await run({ on: WORD_MEANING_ONLY, of: [...named, ...plain] });

    const questions = await questionsOf(app, 60);

    expect(questions.length).toBeGreaterThan(5);
    for (const card of questions) {
      expect(plain.map(({ id }) => id)).toContain(card.entry.id);
    }
  });

  it('asks nothing when four distinct Definitions cannot be found', async () => {
    const few = Array.from({ length: 14 }, (_, index) =>
      meant(index, { primaryDefinition: `Meaning number ${String(index % 3)}.` }),
    );
    const { app } = await run({ on: WORD_MEANING_ONLY, of: few });

    expect(await questionsOf(app, 48)).toEqual([]);
  });

  it('never comes with its switch off', async () => {
    const { app } = await run({
      on: WITH_GUESS_WORD.filter((feature) => feature !== 'quickQuestionWordMeaning'),
      of: meantWords,
    });

    const questions = await questionsOf(app, 120);

    expect(questions).toHaveLength(20);
    expect(new Set(questions.map(sourceIdOf))).toEqual(new Set(['guess-word']));
  });

  it('never comes with the Quick Question off', async () => {
    const { app } = await run({
      on: WORD_MEANING_ONLY.filter((feature) => feature !== 'quickQuestion'),
      of: meantWords,
    });

    expect(await questionsOf(app, 48)).toEqual([]);
  });

  it('comes up beside each Game Mode whose Round is a pick', async () => {
    const { app } = await run({ on: WITH_GUESS_WORD, of: meantWords });

    const questions = await questionsOf(app, 120);

    expect(new Set(questions.map(sourceIdOf))).toEqual(new Set(['guess-word', 'word-meaning']));
  });

  it('right earns 2 XP and confirms its Word', async () => {
    const { app, events } = await run({ on: WORD_MEANING_ONLY, of: meantWords });
    const { card, position } = await firstQuestion(app);

    const right = await app.feed.answerQuickQuestion(position, card.round.correct);

    expect(right).toBe(true);
    expect(app.xpLog.state).toMatchObject({ total: 2, today: 2 });
    expect(app.knowledge.state.confirmed.total).toBe(1);
    expect(app.feed.cards[position]).toMatchObject({ answered: card.round.correct });
    expect(events).toContainEqual([
      'quickQuestionAnswered',
      { right: true, mode: 'word-meaning', entryKind: 'word', rarity: 3, categoryId: 'test' },
    ]);
  });

  it('wrong marks its Word Unknown and earns nothing', async () => {
    const { app, events } = await run({ on: WORD_MEANING_ONLY, of: meantWords });
    const { card, position } = await firstQuestion(app);
    const wrong = (card.round.correct + 1) % card.round.options.length;

    const right = await app.feed.answerQuickQuestion(position, wrong);

    expect(right).toBe(false);
    expect(app.knowledge.state.shown.get(card.entry.id)).toBe('unknown');
    expect(app.xpLog.state).toMatchObject({ total: 0, today: 0 });
    expect(app.knowledge.state.confirmed.total).toBe(0);
    expect(events).toContainEqual([
      'quickQuestionAnswered',
      { right: false, mode: 'word-meaning', entryKind: 'word', rarity: 3, categoryId: 'test' },
    ]);
  });
});
