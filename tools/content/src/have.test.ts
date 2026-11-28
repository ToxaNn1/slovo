import { describe, expect, it } from 'vitest';

import { ukrainianSnapshot } from '@slovo/language-pack/test-support';

import { counts, have } from './have';
import { backend, fakeIo, refused } from './test-support';

describe('have', () => {
  const seed = ukrainianSnapshot();
  const [first, second] = seed.words;
  if (first === undefined || second === undefined) throw new Error('The seed has too few Words');
  const snapshot = { ...seed, words: [first, { ...second, retired: true }] };
  const served = () => backend({}, { content: { snapshot: () => snapshot } });

  it('prints one tab-separated line per live record of every kind', async () => {
    const { io, printed } = fakeIo();

    expect(await have(served().api, { editionId: 'uk', kind: undefined }, io)).toBe(0);

    expect(printed).toContain(`${first.id}\tword\t${first.lemma}`);
    expect(printed.some((line) => line.startsWith(`${second.id}\t`))).toBe(false);
    const idiom = seed.idioms.find(({ retired }) => !retired);
    expect(printed).toContain(`${idiom?.id ?? ''}\tidiom\t${idiom?.expression ?? ''}`);
    const tip = seed.tips[0];
    expect(printed).toContain(`${tip?.id ?? ''}\ttip\t${tip?.title ?? ''}`);
    const row = seed.synonymRows[0];
    expect(printed).toContain(`${row?.id ?? ''}\tsynonymRow\t${row?.dominant.text ?? ''}`);
  });

  it('prints only the kind it names', async () => {
    const { io, printed } = fakeIo();

    expect(await have(served().api, { editionId: 'uk', kind: 'word' }, io)).toBe(0);

    expect(printed).toEqual([`${first.id}\tword\t${first.lemma}`]);
  });

  it('leaves a Retired Curated Collection out', async () => {
    const [live, gone] = seed.curatedCollections;
    if (live === undefined || gone === undefined)
      throw new Error('The seed has too few collections');
    const withRetired = { ...seed, curatedCollections: [live, { ...gone, retired: true }] };
    const { api } = backend({}, { content: { snapshot: () => withRetired } });
    const { io, printed } = fakeIo();

    expect(await have(api, { editionId: 'uk', kind: 'curatedCollection' }, io)).toBe(0);

    expect(printed).toEqual([`${live.id}\tcuratedCollection\t${live.name}`]);
  });

  it('exits 1 with the API refusal when there is no snapshot', async () => {
    const { api } = backend(
      {},
      {
        content: {
          snapshot: ({ errors }) => {
            throw errors.NOT_FOUND();
          },
        },
      },
    );
    const { io, printed, problems } = fakeIo();

    expect(await have(api, { editionId: 'uk', kind: undefined }, io)).toBe(1);

    expect(printed).toEqual([]);
    expect(problems).toEqual(['uk: NOT_FOUND: Not found']);
  });
});

describe('counts', () => {
  const report = {
    words: 12,
    retiredWords: 1,
    wordsPerCategory: [
      { categoryId: 'nature', displayName: 'Природа', words: 10 },
      { categoryId: 'home', displayName: 'Дім', words: 2 },
    ],
    rarity: [{ rarity: 3, words: 12 }],
    coverage: { examples: 11, synonyms: 4, etymology: 2, stress: 12, region: 0 },
    corrections: 3,
    retiredCorrections: 0,
    correctionsPerType: [{ correctionType: 'wrongStress', corrections: 3 }],
    correctionsPerCategory: [{ categoryId: 'nature', displayName: 'Природа', corrections: 3 }],
    idioms: 2,
    retiredIdioms: 1,
    idiomsPerType: [{ idiomType: 'idiom', idioms: 2 }],
    media: { withoutRecording: [], withoutIllustration: 0 },
  };

  it('prints the report as padded tables and each missed content target', async () => {
    const { api } = backend({
      report: () => ({
        contentVersion: 9,
        report,
        targets: {},
        missed: [{ target: 'words', message: '12 of 300 Words' }],
        quoteCheck: { unverified: 0, failed: 0 },
      }),
    });
    const { io, printed } = fakeIo();

    expect(await counts(api, { editionId: 'uk' }, io)).toBe(0);

    expect(printed).toEqual([
      'Content version 9',
      '',
      'Words: 12 (retired 1)',
      'Category  words',
      'nature    10',
      'home      2',
      'Rarity  words',
      'r3      12',
      'Coverage   words',
      'examples   11',
      'synonyms   4',
      'etymology  2',
      'stress     12',
      'region     0',
      '',
      'Corrections: 3 (retired 0)',
      'Category  corrections',
      'nature    3',
      'Type         corrections',
      'wrongStress  3',
      '',
      'Idioms: 2 (retired 1)',
      'Type   idioms',
      'idiom  2',
      '',
      'Missed targets:',
      '  words: 12 of 300 Words',
    ]);
  });

  it('says every target is met when none is missed', async () => {
    const { api } = backend({
      report: () => ({
        contentVersion: 9,
        report,
        targets: {},
        missed: [],
        quoteCheck: { unverified: 0, failed: 0 },
      }),
    });
    const { io, printed } = fakeIo();

    expect(await counts(api, { editionId: 'uk' }, io)).toBe(0);

    expect(printed.at(-1)).toBe('Every content target is met');
  });

  it('exits 1 with the API refusal', async () => {
    const { api } = backend({
      report: () => {
        throw refused('FORBIDDEN', 403);
      },
    });
    const { io, printed, problems } = fakeIo();

    expect(await counts(api, { editionId: 'uk' }, io)).toBe(1);

    expect(printed).toEqual([]);
    expect(problems).toEqual([expect.stringMatching(/^uk: FORBIDDEN: /)]);
  });
});
