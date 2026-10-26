import { describe, expect, it } from 'vitest';

import type { SynonymRow, SynonymRowMember, Word } from '@slovo/contracts';

import { buildSynonymRowCard, createEntries } from '../index';
import { createMemoryContentPort } from '../testing';
import { word } from '../test-support';

/** A member of the row, stressed on its first letter unless a test says otherwise. */
const member = (text: string, overrides: Partial<SynonymRowMember> = {}): SynonymRowMember => ({
  text,
  stress: [0],
  ...overrides,
});

/** A row of five members without links or notes; each test adds what it needs. */
function row(overrides: Partial<SynonymRow> = {}): SynonymRow {
  return {
    kind: 'synonymRow',
    id: 'r_ity',
    dominant: { text: 'іти', stress: [2] },
    meaning: 'Рухатися пішки.',
    members: [
      member('простувати', { stress: [7] }),
      member('чимчикувати', { stress: [4] }),
      member('шкандибати', { stress: [7] }),
      member('дибати', { stress: [1] }),
      member('чалапати', { stress: [3] }),
    ],
    sources: [{ title: 'Test source' }],
    retired: false,
    ...overrides,
  };
}

const build = (from: SynonymRow, words: readonly Word[] = []) =>
  buildSynonymRowCard({
    synonymRow: from,
    entries: createEntries({
      content: createMemoryContentPort({ words }),
      edition: { isFeatureEnabled: () => true },
    }),
  });

describe('the Synonym Row card', () => {
  it('shows the dominant, the meaning, every member with its Stress, link and shade note, the example and the sources', async () => {
    const card = await build(
      row({
        dominant: { text: 'іти', stress: [2], wordId: 'w_ity' },
        members: [
          member('простувати', { stress: [7], wordId: 'w_prostuvaty' }),
          member('чимчикувати', { stress: [4], shadeNote: 'дрібними кроками' }),
          member('шкандибати', { stress: [7], shadeNote: 'кульгаючи' }),
          member('дибати', { stress: [1] }),
          member('чалапати', { stress: [3] }),
        ],
        example: { text: 'Простує він полем.', author: 'Test author' },
        sources: [{ title: 'Словник синонімів' }, { title: 'Горох' }],
      }),
      [word('w_ity'), word('w_prostuvaty')],
    );

    expect(card).toEqual({
      kind: 'synonymRow',
      synonymRowId: 'r_ity',
      dominant: { text: 'іти́', stressedVowels: ['и'], wordId: 'w_ity' },
      meaning: 'Рухатися пішки.',
      members: [
        {
          text: 'простува́ти',
          stressedVowels: ['а'],
          wordId: 'w_prostuvaty',
          shadeNote: undefined,
        },
        {
          text: 'чимчи́кувати',
          stressedVowels: ['и'],
          wordId: undefined,
          shadeNote: 'дрібними кроками',
        },
        {
          text: 'шкандиба́ти',
          stressedVowels: ['а'],
          wordId: undefined,
          shadeNote: 'кульгаючи',
        },
        { text: 'ди́бати', stressedVowels: ['и'], wordId: undefined, shadeNote: undefined },
        { text: 'чала́пати', stressedVowels: ['а'], wordId: undefined, shadeNote: undefined },
      ],
      example: { text: 'Простує він полем.', author: 'Test author' },
      sourceTitles: ['Словник синонімів', 'Горох'],
    });
  });

  it('shows every Stress of a word with more than one', async () => {
    const card = await build(row({ dominant: { text: 'говорити', stress: [3, 5] } }));

    expect(card.dominant).toMatchObject({ text: 'гово́ри́ти', stressedVowels: ['о', 'и'] });
  });

  it('leaves out the example of a row without one', async () => {
    expect((await build(row())).example).toBeUndefined();
  });

  it('keeps the members in their order, each without a link when it has no Word id', async () => {
    const card = await build(row());

    expect(card.members.map(({ text, wordId }) => [text, wordId])).toEqual([
      ['простува́ти', undefined],
      ['чимчи́кувати', undefined],
      ['шкандиба́ти', undefined],
      ['ди́бати', undefined],
      ['чала́пати', undefined],
    ]);
  });

  it('links no member or dominant to a Retired Word, and keeps its text', async () => {
    const card = await build(
      row({
        dominant: { text: 'іти', stress: [2], wordId: 'w_ity' },
        members: [
          member('простувати', { stress: [7], wordId: 'w_prostuvaty' }),
          ...row().members.slice(1),
        ],
      }),
      [word('w_ity', { retired: true }), word('w_prostuvaty', { retired: true })],
    );

    expect(card.dominant).toEqual({ text: 'іти́', stressedVowels: ['и'], wordId: undefined });
    expect(card.members[0]).toMatchObject({ text: 'простува́ти', wordId: undefined });
  });

  it('links no member to a Word the Language Pack does not have', async () => {
    const card = await build(
      row({ members: [member('простувати', { wordId: 'w_gone' }), ...row().members.slice(1)] }),
    );

    expect(card.members[0]?.wordId).toBeUndefined();
  });

  it('links a member to a live Word even when other members link Retired ones', async () => {
    const card = await build(
      row({
        members: [
          member('простувати', { wordId: 'w_prostuvaty' }),
          member('чимчикувати', { wordId: 'w_chymchykuvaty' }),
          ...row().members.slice(2),
        ],
      }),
      [word('w_prostuvaty', { retired: true }), word('w_chymchykuvaty')],
    );

    expect(card.members.slice(0, 2).map(({ wordId }) => wordId)).toEqual([
      undefined,
      'w_chymchykuvaty',
    ]);
  });
});
