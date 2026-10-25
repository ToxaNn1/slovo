import { type Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { historySections } from './history-screen';
import { historyText } from './history-text';
import { count, strings, ukrainian } from '../test-support';

/** The Language Pack's one Category, the test Words' own. */
const categoryId = 'nature-weather';

function word(id: string): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [],
    partOfSpeech: 'adverb',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
  };
}

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two'), word('w_three')],
  corrections: [
    {
      kind: 'correction',
      id: 'c_one',
      nonStandardForm: 'слідуючий',
      correctionType: 'russianism',
      standardEquivalents: ['наступний'],
      explanation: 'An explanation.',
      examplePair: { nonStandard: 'Так кажуть.', standard: 'Краще так.' },
      categoryId: 'everyday',
      sources: [{ title: 'Test source' }],
      retired: false,
    },
  ],
});

/** The Core composition at `now` in Kyiv, with History holding the Entries Seen at those instants. */
async function open(
  now: string,
  seen: readonly { entryId: string; at: string; wordOfTheDay?: boolean }[] = [],
): Promise<{ app: Composition; clock: Clock }> {
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  const records = new Map(
    seen.map(({ entryId, at, wordOfTheDay = false }) => [
      `history.${entryId}`,
      JSON.stringify({ seenAt: new Date(at).toISOString(), wordOfTheDay }),
    ]),
  );
  const app = await openComposition({
    content,
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
  return { app, clock };
}

const sectionsOf = (app: Composition, clock: Clock) =>
  historySections({
    history: app.history.list,
    text: historyText({ strings: strings.history, count, clock }),
    clock,
  });

describe('the «Історія» screen', () => {
  it('has no sections while History is empty', async () => {
    const { app, clock } = await open('2026-10-11T10:00:00+03:00');

    expect(sectionsOf(app, clock)).toEqual([]);
  });

  it('groups the Seen Entries under the day they were Seen, newest first, each section keyed by its date', async () => {
    const { app, clock } = await open('2026-10-11T10:00:00+03:00', [
      { entryId: 'w_one', at: '2026-09-30T12:00:00+03:00' },
      { entryId: 'c_one', at: '2026-10-10T21:40:00+03:00' },
      { entryId: 'w_two', at: '2026-10-11T08:02:00+03:00' },
      { entryId: 'w_three', at: '2026-10-11T09:55:00+03:00' },
    ]);

    const sections = sectionsOf(app, clock);

    expect(sections.map(({ key, title }) => ({ key, title }))).toEqual([
      { key: '2026-10-11', title: 'Сьогодні' },
      { key: '2026-10-10', title: 'Учора' },
      { key: '2026-9-30', title: '30 вересня' },
    ]);
    expect(sections.map(({ data }) => data.map(({ entryId }) => entryId))).toEqual([
      ['w_three', 'w_two'],
      ['c_one'],
      ['w_one'],
    ]);
  });

  it('says on each row what kind of Entry it was', async () => {
    const { app, clock } = await open('2026-10-11T10:00:00+03:00', [
      { entryId: 'w_one', at: '2026-10-11T07:00:00+03:00', wordOfTheDay: true },
      { entryId: 'c_one', at: '2026-10-11T08:00:00+03:00' },
      { entryId: 'w_two', at: '2026-10-11T09:00:00+03:00' },
    ]);

    const [today] = sectionsOf(app, clock);

    expect(today?.data.map(({ row, label }) => ({ title: row.title, label }))).toEqual([
      { title: 'two', label: 'слово' },
      { title: 'наступний', label: 'виправлення' },
      { title: 'one', label: 'слово дня' },
    ]);
  });
});
