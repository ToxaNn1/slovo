import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, openComposition, openUserState } from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, countingReads, fakeClock, idiom, word } from '../test-support';
import { buildEntryRow } from './entry-row';

const words = Array.from({ length: 40 }, (_, place) => word(`w_${String(place).padStart(2, '0')}`));
const corrections = Array.from({ length: 10 }, (_, place) => correction(`c_${String(place)}`));
const content = createMemoryContentPort({
  words: [...words, word('w_old', { retired: true })],
  corrections: [...corrections, correction('c_old', { retired: true })],
});

const at = '2026-10-11T06:00:00.000Z';

/** The records of a user who keeps the Entries in Favorites, History, a Collection and the Knowledge Marks. */
function keeping(entryIds: readonly string[]): Map<string, string> {
  const records = new Map<string, string>([
    ['collections.c1', JSON.stringify({ name: 'Mine', createdAt: at })],
  ]);
  for (const entryId of entryIds) {
    records.set(`favorites.${entryId}`, JSON.stringify(at));
    records.set(`history.${entryId}`, JSON.stringify({ seenAt: at, wordOfTheDay: false }));
    records.set(`collectionEntries.c1.${entryId}`, JSON.stringify(at));
    records.set(
      `knowledge.${entryId}`,
      JSON.stringify({ mark: 'known', step: null, reviewDay: null, learned: false }),
    );
  }
  return records;
}

/** The composition open over the records, and how many reads of the pack it made to open. */
async function open(records: Map<string, string>) {
  const { content: counted, reads } = countingReads(content);
  const app = await openComposition({
    content: counted,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => feature === 'corrections' || feature === 'knowledge',
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: { categoryIds: ['test'], correctionCategoryIds: 'all' as const, corrections: true, idioms: true },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock().clock,
    random: { next: () => 0.25 },
  });
  return { app, reads: reads() };
}

describe('the rows of the Entries the user keeps', () => {
  it('are read together when the composition opens, however many Entries the user keeps', async () => {
    const few = ['w_00', 'c_0'];
    const many = [
      ...words.map(({ id }) => id),
      ...corrections.map(({ id }) => id),
      'w_old',
      'c_old',
      'w_missing',
    ];

    const kept = await open(keeping(many));

    expect(kept.reads).toBe((await open(keeping(few))).reads);
    // Every Entry the pack has, Retired or not, and not the one it lacks.
    expect(kept.app.favorites.list).toHaveLength(52);
    expect(kept.app.history.list).toHaveLength(52);
    expect(kept.app.collections.entries('c1')).toHaveLength(52);
    expect(kept.app.knowledge.state).toMatchObject({
      known: { word: 41, correction: 11 },
    });
  });
});

describe('the row of an Entry', () => {
  it('leads a Word with its Lemma and Stress over its primary Definition, and says «слово»', () => {
    const row = buildEntryRow(
      word('w_veremiia', {
        lemma: 'веремія',
        stress: [5],
        primaryDefinition: 'Метушня, що́ зчинилася.',
      }),
    );

    expect(row).toMatchObject({
      kind: 'word',
      entryId: 'w_veremiia',
      title: 'веремі́я',
      secondLine: 'Метушня, що́ зчинилася.',
      labelKey: 'word',
      // VoiceOver reads whole words: the voices break a word at the Stress mark.
      spoken: 'веремія, Метушня, що зчинилася.',
    });
  });

  it('leads a Correction with its main standard equivalent over the form it replaces, and says «виправлення»', () => {
    const row = buildEntryRow(
      correction('c_protiahom', {
        nonStandardForm: 'на протязі року',
        standardEquivalents: ['протягом року', 'упродовж року'],
      }),
    );

    expect(row).toMatchObject({
      kind: 'correction',
      entryId: 'c_protiahom',
      title: 'протягом року',
      secondLine: 'на протязі року',
      labelKey: 'correction',
      spoken: 'протягом року, на протязі року',
    });
  });

  it('leads an Idiom with its expression over its primary Definition, and says «фразеологізм»', () => {
    const row = buildEntryRow(
      idiom('i_baidyky', { expression: 'бити байдики', primaryDefinition: 'Ледарювати.' }),
    );

    expect(row).toMatchObject({
      kind: 'idiom',
      entryId: 'i_baidyky',
      title: 'бити байдики',
      secondLine: 'Ледарювати.',
      labelKey: 'idiom',
      spoken: 'бити байдики, Ледарювати.',
    });
  });

  it('says «топонім» for a place name, which otherwise reads as an Idiom', () => {
    const row = buildEntryRow(
      idiom('i_berdychiv', {
        expression: 'Бердичів',
        idiomType: 'placeName',
        primaryDefinition: 'Місто на Житомирщині.',
        etymology: 'Від імені Бердич.',
      }),
    );

    expect(row).toMatchObject({
      kind: 'idiom',
      title: 'Бердичів',
      secondLine: 'Місто на Житомирщині.',
      labelKey: 'placeName',
      spoken: 'Бердичів, Місто на Житомирщині.',
    });
  });
});
