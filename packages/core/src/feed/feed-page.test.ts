import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import {
  openComposition,
  type Composition,
  type ContentReadPort,
  type FeedCard,
  type UserStatePort,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

// Yesterday's Word of the Day, the Words whose meanings may not be its
// Distractors, the other nouns and the verbs.
const yesterdays = word('w_03');
const sameMeaning = word('w_05', { primaryDefinition: yesterdays.primaryDefinition });
const homonym = word('w_06', { lemma: yesterdays.lemma, primaryDefinition: 'Another sense.' });
const noun = word('w_10');
const nouns = [noun, word('w_11')];
const verbs = [21, 22, 23].map((index) => word(`v_${String(index)}`, { partOfSpeech: 'verb' }));
const words: readonly Word[] = [yesterdays, sameMeaning, homonym, ...nouns, ...verbs];

const everySwitch: readonly FeatureSwitch[] = [
  'knowledge',
  'weeklyRecap',
  'yesterday',
  'wordOfTheDayArchive',
];

/** A Monday whose week before has an Active Day and whose day before archived `w_03`. */
const monday = '2026-10-26';
const tuesday = '2026-10-27';
const nextMonday = '2026-11-02';

function records({
  recap = true,
  yesterday = true,
}: { recap?: boolean; yesterday?: boolean } = {}): Map<string, string> {
  return new Map([
    ...(recap ? ([['activeDays.2026-10-24', 'true']] as const) : []),
    ...(yesterday
      ? ([['wordOfTheDayArchive.2026-10-25', JSON.stringify(yesterdays.id)]] as const)
      : []),
  ]);
}

/** The Core composition of one app run at 09:00 in Kyiv on `on`, over the records, so the user state survives between runs. */
async function run(
  kept: Map<string, string>,
  on: string,
  content: readonly Word[] = words,
  port: (memory: ContentReadPort) => ContentReadPort = (memory) => memory,
  userStatePort: UserStatePort = createMemoryUserStatePort(kept),
): Promise<Composition & { advance: (ms: number) => void }> {
  const { clock, advance } = fakeClock(`${on}T09:00:00+02:00`);
  const app = await openComposition({
    content: port(createMemoryContentPort({ words: content })),
    edition: testEdition({
      isFeatureEnabled: (feature) => everySwitch.includes(feature),
      userSettingDefaults: {
        mix: { kinds: { correction: false, idiom: false, synonymRow: false, tip: false } },
      },
    }),
    userState: await openUserState({ port: userStatePort }),
    clock,
    random: randomOf(0.25),
  });
  return Object.assign(app, { advance });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Feed's first three cards: the Word of the Day, the day's Feed Notice page and a Word. */
async function firstCards(app: Composition): Promise<readonly FeedCard[]> {
  while (app.feed.cards.length < 3) if ((await app.feed.next()) === undefined) break;
  return app.feed.cards;
}

/** The Feed Notice page of the day, the Feed's second card. */
async function pageOf(app: Composition) {
  const card = (await firstCards(app))[1];
  return card?.kind === 'notice' ? card : undefined;
}

/** The Yesterday quiz on the day's page, alone or under the Weekly Recap. */
async function quizOf(app: Composition) {
  const page = await pageOf(app);
  if (page?.notice === 'yesterday') return page.quiz;
  if (page?.notice === 'weeklyRecap') return page.yesterday?.quiz;
  return undefined;
}

// Spec #1842: the board XFeed f5.
describe('the Feed Notice page', () => {
  it('puts the Weekly Recap and Yesterday on one page, the week first, when both are due', async () => {
    const app = await run(records(), monday);

    const cards = await firstCards(app);

    expect(cards[1]).toMatchObject({
      kind: 'notice',
      notice: 'weeklyRecap',
      folded: false,
      yesterday: { notice: 'yesterday', word: { wordId: yesterdays.id } },
    });
    expect(cards.filter((card) => card.kind === 'notice')).toHaveLength(1);
    expect(cards[2]?.kind).toBe('word');
  });

  it('gives the Weekly Recap alone when Yesterday is not due', async () => {
    const page = await pageOf(await run(records({ yesterday: false }), monday));

    expect(page).toMatchObject({ notice: 'weeklyRecap', folded: false, yesterday: undefined });
  });

  it('gives Yesterday alone when the Weekly Recap is not due', async () => {
    const page = await pageOf(await run(records({ recap: false }), monday));

    expect(page).toMatchObject({ notice: 'yesterday', word: { wordId: yesterdays.id } });
  });

  it('closes both for the day once swiped past', async () => {
    const kept = records();
    const app = await run(kept, monday);
    await firstCards(app);
    await app.feed.show(0);
    await app.feed.show(1);
    await app.feed.show(2);

    const cards = await firstCards(await run(kept, monday));

    expect(cards.filter((card) => card.kind === 'notice')).toEqual([]);
  });
});

describe('the Yesterday quiz', () => {
  it('gives three distinct meanings: the Word’s own and two of other Words of its part of speech', async () => {
    const quiz = await quizOf(await run(records(), monday));
    if (quiz === undefined) throw new Error('No quiz');

    expect(quiz.meanings).toHaveLength(3);
    expect(quiz.meanings[quiz.right]).toBe(yesterdays.primaryDefinition);
    expect(new Set(quiz.meanings).size).toBe(3);
    expect([...quiz.meanings].sort()).toEqual(
      [yesterdays, ...nouns].map(({ primaryDefinition }) => primaryDefinition).sort(),
    );
  });

  it('takes a Word of another part of speech when its own has too few', async () => {
    const quiz = await quizOf(await run(records(), monday, [yesterdays, noun, ...verbs]));
    if (quiz === undefined) throw new Error('No quiz');

    const meanings = new Set(quiz.meanings);
    expect(meanings.size).toBe(3);
    expect(meanings.has(yesterdays.primaryDefinition)).toBe(true);
    expect(meanings.has(noun.primaryDefinition)).toBe(true);
    expect(verbs.filter(({ primaryDefinition }) => meanings.has(primaryDefinition))).toHaveLength(
      1,
    );
  });

  it('keeps one order for the day, on every open', async () => {
    const kept = records();
    const first = await quizOf(await run(kept, monday));

    expect(first?.meanings).toHaveLength(3);
    expect(await quizOf(await run(kept, monday))).toEqual(first);
  });

  // Meanings are told apart by their Comparison Key for a Definition.
  it('takes meanings that differ only in case or spacing as one', async () => {
    const shouted = word('w_07', { primaryDefinition: yesterdays.primaryDefinition.toUpperCase() });
    const spaced = word('w_12', {
      primaryDefinition: ` ${noun.primaryDefinition.replace(' ', '   ')}`,
    });

    expect(
      await pageOf(
        await run(records({ recap: false }), monday, [yesterdays, shouted, noun, spaced]),
      ),
    ).toBeUndefined();
  });

  // ADR 0211: where several Definitions share a screen, a Word shows its Short Definition.
  it('shows the Short Definition of a Word that has one, right or Distractor, the primary Definition of the others, and keeps the primary Definition on the card', async () => {
    const asked = { ...yesterdays, shortDefinition: 'Yesterday’s, in short.' };
    const short = { ...noun, shortDefinition: 'A noun, in short.' };
    const plain = word('w_11');

    const page = await pageOf(await run(records({ recap: false }), monday, [asked, short, plain]));
    if (page?.notice !== 'yesterday') throw new Error('No Yesterday');

    expect(page.quiz.meanings[page.quiz.right]).toBe('Yesterday’s, in short.');
    expect([...page.quiz.meanings].sort()).toEqual(
      ['Yesterday’s, in short.', 'A noun, in short.', plain.primaryDefinition].sort(),
    );
    expect(page.word.primaryDefinition).toBe(yesterdays.primaryDefinition);
  });

  it('shows the primary Definition of a Word without a Short Definition among the Short Definitions of the others', async () => {
    const content = [
      yesterdays,
      { ...noun, shortDefinition: 'A noun, in short.' },
      word('w_11', { shortDefinition: 'Another noun, in short.' }),
    ];

    const quiz = await quizOf(await run(records(), monday, content));

    expect(quiz?.meanings[quiz.right]).toBe(yesterdays.primaryDefinition);
    expect([...(quiz?.meanings ?? [])].sort()).toEqual(
      [yesterdays.primaryDefinition, 'A noun, in short.', 'Another noun, in short.'].sort(),
    );
  });

  it('never gives two meanings alike by the text shown, nor the Short Definition of a Word that means the same', async () => {
    const asked = { ...yesterdays, shortDefinition: 'Short a.' };
    const content = [
      asked,
      // Shows the asked Word's shown text, as its Short or its primary Definition.
      word('w_07', { shortDefinition: 'SHORT  a.' }),
      word('w_08', { primaryDefinition: 'short a.' }),
      // Means what the asked Word means, whatever it shows.
      { ...sameMeaning, shortDefinition: 'A twin.' },
      word('w_09', { shortDefinition: yesterdays.primaryDefinition.toUpperCase() }),
      // Two Words that show one text.
      word('w_12', { shortDefinition: 'Short f.' }),
      word('w_13', { shortDefinition: 'short  F.' }),
      noun,
    ];

    const quiz = await quizOf(await run(records(), monday, content));

    expect(quiz?.meanings[quiz.right]).toBe('Short a.');
    expect(
      quiz?.meanings.map((meaning) => meaning.toLowerCase().replaceAll(/\s+/g, ' ')).sort(),
    ).toEqual(['short a.', 'short f.', noun.primaryDefinition.toLowerCase()]);
  });

  it('makes the quiz again once a read of the Words failed', async () => {
    let failing = true;
    const app = await run(records({ recap: false }), monday, words, (memory) => ({
      ...memory,
      listWords: () =>
        failing ? Promise.reject(new Error('The Language Pack is busy')) : memory.listWords(),
    }));
    await firstCards(app).catch(() => undefined);
    failing = false;

    expect((await quizOf(app))?.meanings).toHaveLength(3);
  });

  it('orders the meanings by the day’s randomness: the right one is not always in one place', async () => {
    const places = new Set<number>();
    // The days from the 11th to the 22nd of November, each with the Word archived the day before.
    for (let day = 11; day <= 22; day += 1) {
      const kept = new Map([
        [`wordOfTheDayArchive.2026-11-${String(day - 1)}`, JSON.stringify(yesterdays.id)],
      ]);
      const quiz = await quizOf(await run(kept, `2026-11-${String(day)}`));
      if (quiz === undefined) throw new Error('No quiz');
      places.add(quiz.right);
    }

    expect(places.size).toBeGreaterThan(1);
  });

  it('takes no meaning of a Word the reader hid', async () => {
    const app = await run(records(), monday);
    await app.hide({ kind: 'entry', entryId: noun.id });

    const quiz = await quizOf(app);

    expect(quiz?.meanings).toHaveLength(3);
    expect(quiz?.meanings).not.toContain(noun.primaryDefinition);
  });

  it('gives no Yesterday when no two other meanings exist', async () => {
    expect(await pageOf(await run(records({ recap: false }), monday, [yesterdays, noun]))).toBe(
      undefined,
    );
  });

  it('answered right, marks the Word Known, as «Знаю» does', async () => {
    const app = await run(records({ recap: false }), monday);
    const quiz = await quizOf(app);
    if (quiz === undefined) throw new Error('No quiz');

    expect(await app.feed.answerYesterday(1, quiz.right)).toBe('known');

    expect(app.knowledge.state.shown.get(yesterdays.id)).toBe('known');
    expect(await quizOf(app)).toMatchObject({ answered: quiz.right });
  });

  it('answered wrong, marks the Word Unknown, as «Не знаю» does: a Review starts', async () => {
    const app = await run(records(), monday);
    const quiz = await quizOf(app);
    if (quiz === undefined) throw new Error('No quiz');
    const wrong = (quiz.right + 1) % 3;

    expect(await app.feed.answerYesterday(1, wrong)).toBe('unknown');

    expect(app.knowledge.state.learning).toMatchObject([
      { entryId: yesterdays.id, daysUntilReview: 1 },
    ]);
    expect(await quizOf(app)).toMatchObject({ answered: wrong });
  });

  it('takes one answer', async () => {
    const app = await run(records({ recap: false }), monday);
    const quiz = await quizOf(app);
    if (quiz === undefined) throw new Error('No quiz');
    await app.feed.answerYesterday(1, quiz.right);

    expect(await app.feed.answerYesterday(1, (quiz.right + 1) % 3)).toBeUndefined();
    expect(app.knowledge.state.shown.get(yesterdays.id)).toBe('known');
  });

  it('comes no more that day once answered, also after a relaunch', async () => {
    const kept = records({ recap: false });
    const app = await run(kept, monday);
    const quiz = await quizOf(app);
    if (quiz === undefined) throw new Error('No quiz');

    await app.feed.answerYesterday(1, quiz.right);

    expect(await pageOf(await run(kept, monday))).toBeUndefined();
  });

  it('keeps the answer and the closing together: an answer the device fails to keep comes again', async () => {
    const kept = records({ recap: false });
    const memory = createMemoryUserStatePort(kept);
    // The device refuses every write that holds a Knowledge Mark.
    const refusingMarks: UserStatePort = {
      ...memory,
      write: (changes) =>
        [...changes.keys()].some((key) => key.startsWith('knowledge.'))
          ? Promise.reject(new Error('The disk is full'))
          : memory.write(changes),
    };
    const app = await run(kept, monday, words, undefined, refusingMarks);
    const quiz = await quizOf(app);
    if (quiz === undefined) throw new Error('No quiz');

    await expect(app.feed.answerYesterday(1, quiz.right)).rejects.toThrow('The disk is full');

    expect(await quizOf(await run(kept, monday))).toEqual(quiz);
  });

  it('answered under the Weekly Recap, leaves the week to come again without it', async () => {
    const kept = records();
    const app = await run(kept, monday);
    const quiz = await quizOf(app);
    if (quiz === undefined) throw new Error('No quiz');

    await app.feed.answerYesterday(1, quiz.right);

    expect(await pageOf(await run(kept, monday))).toMatchObject({
      notice: 'weeklyRecap',
      yesterday: undefined,
    });
  });

  it('answers nothing on a card that is no Yesterday', async () => {
    const app = await run(records(), monday);
    await firstCards(app);

    expect(await app.feed.answerYesterday(0, 0)).toBeUndefined();
    expect(await app.feed.answerYesterday(2, 0)).toBeUndefined();
  });
});

describe('«Готово» on the Weekly Recap', () => {
  it('folds the Weekly Recap away for its week, Yesterday staying on the page', async () => {
    const kept = records();
    const app = await run(kept, monday);
    await firstCards(app);

    expect(await app.feed.foldWeeklyRecap(1)).toBe(true);

    expect(app.feed.cards[1]).toMatchObject({ notice: 'weeklyRecap', folded: true });
    expect(await pageOf(await run(kept, monday))).toMatchObject({ notice: 'yesterday' });
  });

  it('«Повернути» brings it back', async () => {
    const kept = records();
    const app = await run(kept, monday);
    await firstCards(app);
    await app.feed.foldWeeklyRecap(1);

    expect(await app.feed.restoreWeeklyRecap()).toBe(true);

    expect(app.feed.cards[1]).toMatchObject({ notice: 'weeklyRecap', folded: false });
    expect(await pageOf(await run(kept, monday))).toMatchObject({
      notice: 'weeklyRecap',
      folded: false,
    });
  });

  it('folded with no Yesterday under it, leaves the Feed until «Повернути» brings it back', async () => {
    const app = await run(records({ yesterday: false }), monday);
    const cards = await firstCards(app);
    await app.feed.show(1);

    expect(await app.feed.foldWeeklyRecap(1)).toBe(true);

    expect(app.feed.cards).not.toContainEqual(expect.objectContaining({ notice: 'weeklyRecap' }));
    expect(app.feed.cards[1]).toBe(cards[2]);

    expect(await app.feed.restoreWeeklyRecap()).toBe(true);

    expect(app.feed.cards[1]).toMatchObject({ notice: 'weeklyRecap', folded: false });
    expect(app.feed.position).toBe(1);
  });

  it('folded after midnight, keeps the new day’s closed Feed Notices', async () => {
    const kept = new Map([
      ...records(),
      ['wordOfTheDayArchive.2026-10-26', JSON.stringify(yesterdays.id)],
    ]);
    const stale = await run(kept, monday);
    await firstCards(stale);
    // The next morning, another run swipes past Tuesday's Yesterday.
    const next = await run(kept, tuesday);
    expect(await pageOf(next)).toMatchObject({ notice: 'yesterday' });
    await next.feed.show(0);
    await next.feed.show(1);
    await next.feed.show(2);
    stale.advance(DAY_MS);

    expect(await stale.feed.foldWeeklyRecap(1)).toBe(true);

    expect(stale.feed.cards[1]).toMatchObject({ notice: 'weeklyRecap', folded: true });
    const cards = await firstCards(await run(kept, tuesday));
    expect(cards.filter((card) => card.kind === 'notice')).toEqual([]);
  });

  it('restores only a folded Weekly Recap, and folds only one shown', async () => {
    const app = await run(records(), monday);
    await firstCards(app);

    expect(await app.feed.restoreWeeklyRecap()).toBe(false);
    expect(await app.feed.foldWeeklyRecap(0)).toBe(false);
    await app.feed.foldWeeklyRecap(1);
    expect(await app.feed.foldWeeklyRecap(1)).toBe(false);
  });

  it('leaves the next Monday’s Weekly Recap to come as usual', async () => {
    const kept = records();
    const app = await run(kept, monday);
    await firstCards(app);
    await app.feed.foldWeeklyRecap(1);
    expect(await pageOf(await run(kept, tuesday))).toBeUndefined();

    kept.set('activeDays.2026-10-28', 'true');

    expect(await pageOf(await run(kept, nextMonday))).toMatchObject({
      notice: 'weeklyRecap',
      folded: false,
    });
  });
});
