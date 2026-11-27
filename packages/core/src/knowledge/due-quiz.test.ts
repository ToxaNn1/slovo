import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import { openComposition, type Composition } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const nouns: readonly Word[] = Array.from({ length: 6 }, (_, index) => word(`w_n${String(index)}`));
const verbs: readonly Word[] = Array.from({ length: 6 }, (_, index) =>
  word(`w_v${String(index)}`, { partOfSpeech: 'verb' }),
);
const words = [...nouns, ...verbs];

/** 09:00 in Kyiv on the local day `date` (`YYYY-MM-DD`). */
const morningOf = (date: string) => `${date}T09:00:00+03:00`;

/** The Core composition of one app run on the day, over the records, so the user state survives between runs. */
async function run({
  records,
  on,
  content = words,
  switches = ['knowledge', 'dueQuiz'],
}: {
  records: Map<string, string>;
  on: string;
  content?: readonly Word[];
  switches?: readonly FeatureSwitch[];
}): Promise<Composition> {
  const { clock } = fakeClock(morningOf(on));
  return openComposition({
    content: createMemoryContentPort({ words: content }),
    edition: testEdition({ isFeatureEnabled: (feature) => switches.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
  });
}

/** Marks the Words Unknown on 1 May, so their Review is due on 2 May. */
async function learning(records: Map<string, string>, ids: readonly string[], content = words) {
  const app = await run({ records, on: '2026-05-01', content });
  for (const id of ids) await app.knowledge.set(id, 'unknown');
}

describe('the Due Quiz', () => {
  it('asks the Words due for Review today, in the «Вчу» order, and no Word due later', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1', 'w_v2']);
    const app = await run({ records, on: '2026-05-02' });
    await app.knowledge.set('w_n3', 'unknown');

    const questions = await app.dueQuiz.questions();

    expect(questions.map(({ wordId, lemma }) => [wordId, lemma])).toEqual([
      ['w_n1', 'n1'],
      ['w_v2', 'v2'],
    ]);
  });

  it('asks nothing while nothing is due', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);

    const app = await run({ records, on: '2026-05-01' });

    expect(await app.dueQuiz.questions()).toEqual([]);
  });

  it('asks nothing with the dueQuiz Feature Switch off', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);

    const app = await run({ records, on: '2026-05-02', switches: ['knowledge'] });

    expect(await app.dueQuiz.questions()).toEqual([]);
  });

  it('gives three distinct meanings, the Word’s own at `right`, of its part of speech first', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);
    const app = await run({ records, on: '2026-05-02' });

    const [question] = await app.dueQuiz.questions();

    expect(question?.meanings).toHaveLength(3);
    expect(new Set(question?.meanings).size).toBe(3);
    expect(question?.meanings[question.right]).toBe('The meaning of n1.');
    const nounMeanings = new Set(nouns.map((noun) => noun.primaryDefinition));
    expect(question?.meanings.every((meaning) => nounMeanings.has(meaning))).toBe(true);
  });

  it('never gives the same meaning twice, nor a homonym’s', async () => {
    const content = [
      word('w_a1', { lemma: 'коса' }),
      word('w_a2', { lemma: 'коса', primaryDefinition: 'A spit of land.' }),
      word('w_b', { primaryDefinition: 'The meaning of коса.' }),
      word('w_c'),
      word('w_d'),
    ];
    const records = new Map<string, string>();
    await learning(records, ['w_a1'], content);
    const app = await run({ records, on: '2026-05-02', content });

    const [question] = await app.dueQuiz.questions();

    expect(question?.meanings).toHaveLength(3);
    expect(question?.meanings).not.toContain('A spit of land.');
    expect(question?.meanings.filter((meaning) => meaning === 'The meaning of коса.')).toHaveLength(
      1,
    );
  });

  it('leaves out a Word without two more meanings', async () => {
    const content = [word('w_a'), word('w_b')];
    const records = new Map<string, string>();
    await learning(records, ['w_a', 'w_b'], content);

    const app = await run({ records, on: '2026-05-02', content });

    expect(await app.dueQuiz.questions()).toEqual([]);
  });

  it('keeps the same Distractors in the same order all the day, after a relaunch too', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1', 'w_v2']);

    const first = await (await run({ records, on: '2026-05-02' })).dueQuiz.questions();
    const again = await (await run({ records, on: '2026-05-02' })).dueQuiz.questions();

    expect(again).toEqual(first);
  });

  it('marks the Word Known on the right meaning, so it is no longer due today', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1', 'w_v2']);
    const app = await run({ records, on: '2026-05-02' });
    const [question] = await app.dueQuiz.questions();
    if (question === undefined) throw new Error('no question');

    expect(await app.dueQuiz.answer(question, question.right)).toBe('known');

    expect(app.knowledge.state.shown.get('w_n1')).toBe('known');
    expect(app.knowledge.state.due).not.toContain('w_n1');
    expect((await app.dueQuiz.questions()).map(({ wordId }) => wordId)).toEqual(['w_v2']);
  });

  it('marks the Word Unknown on another meaning, its Review again in 1 day', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);
    const app = await run({ records, on: '2026-05-02' });
    const [question] = await app.dueQuiz.questions();
    if (question === undefined) throw new Error('no question');

    expect(await app.dueQuiz.answer(question, (question.right + 1) % 3)).toBe('unknown');

    expect(app.knowledge.state.shown.get('w_n1')).toBe('unknown');
    expect(app.knowledge.state.learning).toMatchObject([{ entryId: 'w_n1', daysUntilReview: 1 }]);
    expect(await app.dueQuiz.questions()).toEqual([]);
  });

  it('takes one answer per Word and no option outside its meanings', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);
    const app = await run({ records, on: '2026-05-02' });
    const [question] = await app.dueQuiz.questions();
    if (question === undefined) throw new Error('no question');

    expect(await app.dueQuiz.answer(question, 3)).toBeUndefined();
    expect(app.knowledge.state.due).toContain('w_n1');
    await app.dueQuiz.answer(question, (question.right + 1) % 3);

    expect(await app.dueQuiz.answer(question, question.right)).toBeUndefined();
    expect(app.knowledge.state.shown.get('w_n1')).toBe('unknown');
  });

  it('takes no Hidden Word as a Distractor', async () => {
    const content = [word('w_a'), word('w_b'), word('w_c')];
    const records = new Map<string, string>();
    await learning(records, ['w_a'], content);
    const app = await run({ records, on: '2026-05-02', content });

    await app.hiddenEntries.hide('w_c');

    expect(await app.dueQuiz.questions()).toEqual([]);
  });

  it('leaves out a due Word that is no longer eligible, outside the Rarity Range', async () => {
    const content = [
      word('w_a', { rarity: 3 }),
      word('w_b', { rarity: 4 }),
      word('w_c', { rarity: 4 }),
      word('w_d', { rarity: 4 }),
    ];
    const records = new Map<string, string>();
    await learning(records, ['w_a', 'w_b'], content);
    const switches: readonly FeatureSwitch[] = ['knowledge', 'dueQuiz', 'rarityCeiling'];
    const app = await run({ records, on: '2026-05-02', content, switches });

    await app.rarityRange.set({ from: 4, to: 5 });

    expect((await app.dueQuiz.questions()).map(({ wordId }) => wordId)).toEqual(['w_b']);
  });

  it('orders a Word’s meanings afresh on another local day', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);
    const days = ['2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06'];
    const asked = new Set<string>();
    for (const on of days) {
      const [question] = await (await run({ records, on })).dueQuiz.questions();
      asked.add(JSON.stringify(question));
    }

    expect(asked.size).toBeGreaterThan(1);
  });

  it('takes the first meaning as an answer, and no option that is negative or not whole', async () => {
    const records = new Map<string, string>();
    await learning(records, ['w_n1']);
    const app = await run({ records, on: '2026-05-02' });
    const [question] = await app.dueQuiz.questions();
    if (question === undefined) throw new Error('no question');

    expect(await app.dueQuiz.answer(question, -1)).toBeUndefined();
    expect(await app.dueQuiz.answer(question, 0.5)).toBeUndefined();
    expect(app.knowledge.state.due).toContain('w_n1');

    expect(await app.dueQuiz.answer(question, 0)).toBe(question.right === 0 ? 'known' : 'unknown');
  });

  // ADR 0211: where several Definitions share a screen, a Word shows its Short Definition.
  it('shows the Short Definition of a Word that has one, right or Distractor, and the primary Definition of the others', async () => {
    const content = [
      word('w_a', { shortDefinition: 'A, in short.' }),
      word('w_b'),
      word('w_c', { shortDefinition: 'C, in short.' }),
    ];
    const records = new Map<string, string>();
    await learning(records, ['w_a', 'w_b'], content);
    const app = await run({ records, on: '2026-05-02', content });

    const questions = await app.dueQuiz.questions();

    const shown = ['A, in short.', 'The meaning of b.', 'C, in short.'];
    expect(questions.map(({ wordId, meanings, right }) => [wordId, meanings[right]])).toEqual([
      ['w_a', 'A, in short.'],
      ['w_b', 'The meaning of b.'],
    ]);
    for (const { meanings } of questions) expect([...meanings].sort()).toEqual([...shown].sort());
  });

  it('never gives two meanings alike by the text shown, nor the Short Definition of a Word that means the same', async () => {
    const asked = word('w_a', { shortDefinition: 'Short a.' });
    const content = [
      asked,
      // Shows the asked Word's shown text, as its Short or its primary Definition.
      word('w_b', { shortDefinition: 'SHORT  a.' }),
      word('w_c', { primaryDefinition: 'short a.' }),
      // Means what the asked Word means, whatever it shows.
      word('w_d', { primaryDefinition: asked.primaryDefinition, shortDefinition: 'A twin.' }),
      word('w_e', { shortDefinition: asked.primaryDefinition.toUpperCase() }),
      // Two Words that show one text.
      word('w_f', { shortDefinition: 'Short f.' }),
      word('w_g', { shortDefinition: 'short  F.' }),
      word('w_h'),
    ];
    const records = new Map<string, string>();
    await learning(records, ['w_a'], content);
    const app = await run({ records, on: '2026-05-02', content });

    const [question] = await app.dueQuiz.questions();

    expect(question?.meanings[question.right]).toBe('Short a.');
    expect(
      question?.meanings.map((meaning) => meaning.toLowerCase().replaceAll(/\s+/g, ' ')).sort(),
    ).toEqual(['short a.', 'short f.', 'the meaning of h.']);
  });
});
