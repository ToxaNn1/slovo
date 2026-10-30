import type { FeatureSwitch, Mood, Word } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, openUserState, type Random } from '../index';
import { createMoodDraw, type MoodDraw } from './mood-draw';
import { createMemoryContentPort } from '../testing';
import { seededRandom, testEdition, word } from '../test-support';

const moods: readonly Mood[] = [
  { id: 'calm', name: 'Calm', emoji: '😌' },
  { id: 'joyful', name: 'Joyful', emoji: '😊' },
  { id: 'sad', name: 'Sad', emoji: '😢' },
];

/** Calm Words in two Categories and of two rarities, one joyful Word and one Word without moods. */
const words: Word[] = [
  word('w_quiet', { moods: ['calm'] }),
  word('w_still', { moods: ['calm', 'joyful'] }),
  word('w_rare', { moods: ['calm'], rarity: 5 }),
  word('w_other', { moods: ['calm'], categoryId: 'other' }),
  word('w_old', { moods: ['calm'], retired: true }),
  word('w_glad', { moods: ['joyful'] }),
  word('w_plain'),
];

/** The mood draw over the Words and the user's records, with the Edition's Feature Switches on but those in `off`. */
async function open({
  records = {},
  random = seededRandom(7),
  off = [],
}: {
  records?: Readonly<Record<string, unknown>>;
  random?: Random;
  off?: readonly FeatureSwitch[];
} = {}): Promise<MoodDraw> {
  const port = createMemoryUserStatePort(
    new Map(Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)])),
  );
  return createMoodDraw({
    content: createMemoryContentPort({
      categories: [
        { id: 'test', displayName: 'Test' },
        { id: 'other', displayName: 'Other' },
      ],
      words,
      corrections: [],
    }),
    edition: testEdition({
      moods,
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: 'all',
          corrections: false,
          idioms: false,
          synonymRows: false,
          tips: false,
        },
      },
    }),
    userState: await openUserState({ port }),
    random,
  });
}

/** The Words a mood's draws land on, over many draws. */
async function landings(draw: MoodDraw, moodId: string): Promise<ReadonlySet<string>> {
  const landed = new Set<string>();
  for (let i = 0; i < 60; i += 1) {
    const roulette = await draw.draw(moodId);
    if (roulette !== undefined) landed.add(roulette.wordId);
  }
  return landed;
}

describe('the moods on offer', () => {
  it("lists the Edition's moods in its order, a mood with no Eligible Word refused", async () => {
    const draw = await open();

    expect(await draw.moods()).toEqual([
      { mood: moods[0], refusal: undefined },
      { mood: moods[1], refusal: undefined },
      { mood: moods[2], refusal: 'no-eligible-word' },
    ]);
  });

  it('refuses a mood whose every Word the Mix or the Hidden Entries leave out', async () => {
    const draw = await open({ records: { 'hidden.w_still': '2026-10-20T10:00:00.000Z' } });

    // w_glad is in the Mix: joyful stays on offer.
    expect((await draw.moods())[1]?.refusal).toBeUndefined();

    const hiddenAll = await open({
      records: {
        'hidden.w_still': '2026-10-20T10:00:00.000Z',
        'hidden.w_glad': '2026-10-20T10:00:00.000Z',
      },
    });
    expect((await hiddenAll.moods())[1]?.refusal).toBe('no-eligible-word');
  });

  it('lists no mood while the Edition turns moods off', async () => {
    const draw = await open({ off: ['moods'] });

    expect(await draw.moods()).toEqual([]);
  });
});

describe('the mood draw', () => {
  it('lands only on Eligible Words of the mood', async () => {
    const draw = await open();

    expect(await landings(draw, 'calm')).toEqual(
      new Set(['w_quiet', 'w_still', 'w_rare', 'w_other']),
    );
    expect(await landings(draw, 'joyful')).toEqual(new Set(['w_still', 'w_glad']));
  });

  it('applies the Mix: its Categories, its Rarity Floor and the Hidden Entries', async () => {
    const draw = await open({
      records: {
        'mix.categories.other': false,
        'mix.rarityFloor': 5,
        'hidden.w_quiet': '2026-10-20T10:00:00.000Z',
      },
    });

    expect(await landings(draw, 'calm')).toEqual(new Set(['w_rare']));
  });

  it('gives a roulette of the mood’s Lemmas that ends on the Lemma of the Word it lands on', async () => {
    const draw = await open();

    const roulette = await draw.draw('calm');

    expect(roulette?.lemmas.length).toBeGreaterThan(1);
    expect(roulette?.lemmas.at(-1)).toBe(roulette?.wordId.slice(2));
    for (const lemma of roulette?.lemmas ?? []) {
      expect(['quiet', 'still', 'rare', 'other']).toContain(lemma);
    }
    roulette?.lemmas.slice(1).forEach((lemma, index) => {
      expect(lemma).not.toBe(roulette.lemmas[index]);
    });
  });

  it('draws the same roulette for the same seed and others for other seeds', async () => {
    const drawn = async (seed: number) =>
      JSON.stringify(await (await open({ random: seededRandom(seed) })).draw('calm'));

    expect(await drawn(42)).toBe(await drawn(42));
    expect(new Set(await Promise.all([1, 2, 3, 4, 5].map(drawn))).size).toBeGreaterThan(1);
  });

  it('draws nothing for a mood with no Eligible Word, an unknown mood or with moods off', async () => {
    expect(await (await open()).draw('sad')).toBeUndefined();
    expect(await (await open()).draw('angry')).toBeUndefined();
    expect(await (await open({ off: ['moods'] })).draw('calm')).toBeUndefined();
  });

  it('writes nothing, so no Word is Seen', async () => {
    const records = new Map<string, string>();
    const draw = createMoodDraw({
      content: createMemoryContentPort({ words }),
      edition: testEdition({
        moods,
        isFeatureEnabled: () => true,
        userSettingDefaults: {
          mix: {
            categoryIds: 'all',
            corrections: false,
            idioms: false,
            synonymRows: false,
            tips: false,
          },
        },
      }),
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      random: seededRandom(3),
    });

    const before = new Map(records);

    expect(await draw.moods()).not.toEqual([]);
    expect((await draw.draw('calm'))?.wordId).toBeDefined();

    expect(records).toEqual(before);
  });
});
