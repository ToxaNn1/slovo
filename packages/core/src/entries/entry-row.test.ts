import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
} from '../index';
import { correction, countingReads, fakeClock, word } from '../test-support';

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
        mix: { categoryIds: ['test'], corrections: true },
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
    expect(kept.app.knowledge.state).toMatchObject({ knownWords: 41, knownCorrections: 11 });
  });
});
