import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import { openComposition, type Composition, type FeedCard } from '../index';
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
): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({ words: content }),
    edition: testEdition({
      isFeatureEnabled: (feature) => everySwitch.includes(feature),
      userSettingDefaults: {
        mix: { kinds: { correction: false, idiom: false, synonymRow: false, tip: false } },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(kept) }),
    clock: fakeClock(`${on}T09:00:00+02:00`).clock,
    random: randomOf(0.25),
  });
}

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

// Spec #1842, ADR 0130: the board XFeed f5.
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

    expect(await quizOf(await run(kept, monday))).toEqual(first);
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

    expect(await app.feed.restoreWeeklyRecap(1)).toBe(true);

    expect(app.feed.cards[1]).toMatchObject({ notice: 'weeklyRecap', folded: false });
    expect(await pageOf(await run(kept, monday))).toMatchObject({
      notice: 'weeklyRecap',
      folded: false,
    });
  });

  it('restores only a folded Weekly Recap, and folds only one shown', async () => {
    const app = await run(records(), monday);
    await firstCards(app);

    expect(await app.feed.restoreWeeklyRecap(1)).toBe(false);
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
