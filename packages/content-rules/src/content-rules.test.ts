import { readFileSync } from 'node:fs';

import { EditionConfigSchema, type CrosswordDay } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  checkContentSet,
  checkRecord,
  checksumOf,
  parseRecord,
  type AuthoredRecord,
  type ContentSet,
  type RecordKind,
  type Refusal,
  type RuleName,
} from './index';

type Json = Record<string, unknown>;

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

const config = EditionConfigSchema.parse(fixture('edition.json'));
const content = fixture('content.json') as { records: Json[]; curatedCollections: Json[] };
const today = new Date(2026, 10, 8);

const KINDS: readonly (readonly [prefix: string, kind: RecordKind])[] = [
  ['cc_', 'curatedCollection'],
  ['w_', 'word'],
  ['c_', 'correction'],
  ['i_', 'idiom'],
  ['r_', 'synonymRow'],
  ['t_', 'tip'],
];

function kindOf(id: string): RecordKind {
  const found = KINDS.find(([prefix]) => id.startsWith(prefix));
  if (found === undefined) throw new Error(`No kind for ${id}`);
  return found[1];
}

/** A record of the fixture parsed as its kind, from the file of its id. */
function parsed(json: Json, file = `${String(json['id'])}.json`): AuthoredRecord {
  const result = parseRecord(kindOf(String(json['id'])), file, json);
  if (!result.ok) throw new Error(JSON.stringify(result.refusals));
  return result.record;
}

function record(id: string, changes: Json = {}): Json {
  const found = [...content.records, ...content.curatedCollections].find((r) => r['id'] === id);
  if (found === undefined) throw new Error(`No fixture record ${id}`);
  return { ...structuredClone(found), ...changes };
}

const EMPTY: ContentSet = {
  words: [],
  corrections: [],
  idioms: [],
  synonymRows: [],
  tips: [],
  curatedCollections: [],
};

function setOf(records: readonly AuthoredRecord[], extra: Partial<ContentSet> = {}): ContentSet {
  const set = {
    words: records.flatMap((r) => (r.kind === 'word' ? [r] : [])),
    corrections: records.flatMap((r) => (r.kind === 'correction' ? [r] : [])),
    idioms: records.flatMap((r) => (r.kind === 'idiom' ? [r] : [])),
    synonymRows: records.flatMap((r) => (r.kind === 'synonymRow' ? [r] : [])),
    tips: records.flatMap((r) => (r.kind === 'tip' ? [r] : [])),
    curatedCollections: records.flatMap((r) => (r.kind === 'curatedCollection' ? [r] : [])),
  };
  return { ...EMPTY, ...set, ...extra };
}

/** The fixture set with some records changed by id and others added. */
function fixtureSet(
  changes: Record<string, Json> = {},
  added: readonly AuthoredRecord[] = [],
  extra: Partial<ContentSet> = {},
): ContentSet {
  const records = [...content.records, ...content.curatedCollections].map((json) =>
    parsed({ ...json, ...changes[String(json['id'])] }),
  );
  return setOf([...records, ...added], extra);
}

const rules = (refusals: readonly Refusal[]) => [...new Set(refusals.map(({ rule }) => rule))];

const day = (date: string, entryIds: readonly string[]): CrosswordDay => ({
  date,
  words: entryIds.map((entryId, row) => ({
    entryId,
    answer: 'слово',
    clue: 'Підказка.',
    row,
    column: 0,
    direction: 'across',
  })),
});

const days = [day('2026-11-01', ['w_fx0002', 'c_fx0001']), day('2026-11-02', ['w_fx0003'])];

describe('checkContentSet', () => {
  it('passes the valid fixture under every rule', () => {
    const set = fixtureSet({}, [], {
      crosswordDays: days,
      recordedCrosswordDaysChecksum: checksumOf(days),
    });
    expect(checkContentSet(config, set, { today })).toEqual([]);
  });

  const broken: readonly (readonly [RuleName, () => ContentSet])[] = [
    [
      'duplicate-id',
      () => fixtureSet({}, [parsed(record('w_fx0002', { lemma: 'балакуча' }), 'x.json')]),
    ],
    [
      'mixed-script',
      () => fixtureSet({ w_fx0002: { primaryDefinition: 'Який любить гoворити.' } }),
    ],
    ['stray-character', () => fixtureSet({ w_fx0002: { lemma: 'балакучий7' } })],
    ['unique-lemma', () => fixtureSet({}, [parsed(record('w_fx0002', { id: 'w_fx0009' }))])],
    ['unique-expression', () => fixtureSet({}, [parsed(record('i_fx0001', { id: 'i_fx0009' }))])],
    [
      'unique-synonym-text',
      () => {
        const row = record('r_fx0001') as { members: Json[] };
        return fixtureSet({ r_fx0001: { members: [row.members[0], ...row.members.slice(0, -1)] } });
      },
    ],
    ['stress', () => fixtureSet({ w_fx0002: { stress: [0] } })],
    ['marks-stress', () => fixtureSet({ w_fx0002: { stress: [] } })],
    ['wrong-stress', () => fixtureSet({ c_fx0005: { standardEquivalents: ['черговий'] } })],
    [
      'public-domain',
      () =>
        fixtureSet({
          c_fx0001: {
            literaryUses: [
              { author: 'Автор', work: 'Твір', authorDeathYear: 2000, text: 'Текст.' },
            ],
          },
        }),
    ],
    [
      'unique-tip-answers',
      () => {
        const { gameQuestion } = record('t_fx0001') as {
          gameQuestion: Json & { wrongAnswers: string[] };
        };
        const wrongAnswers = [gameQuestion['rightAnswer'], ...gameQuestion.wrongAnswers.slice(1)];
        return fixtureSet({ t_fx0001: { gameQuestion: { ...gameQuestion, wrongAnswers } } });
      },
    ],
    [
      'unique-tip-exceptions',
      () =>
        fixtureSet({
          t_fx0001: {
            exceptions: { explanation: 'Слова поза правилом.', words: ['буряк', 'Буряк'] },
          },
        }),
    ],
    ['word-category', () => fixtureSet({ w_fx0002: { categoryId: 'unknown' } })],
    ['correction-category', () => fixtureSet({ c_fx0001: { categoryId: 'unknown' } })],
    ['word-correction', () => fixtureSet({ w_fx0002: { correctionIds: ['c_zzzzzz'] } })],
    ['word-origin', () => fixtureSet({ w_fx0002: { origin: 'latin' } })],
    [
      'synonym-row-word',
      () => {
        const { dominant } = record('r_fx0001') as { dominant: Json };
        return fixtureSet({ r_fx0001: { dominant: { ...dominant, wordId: 'w_zzzzzz' } } });
      },
    ],
    [
      'curated-collection-entry',
      () => fixtureSet({ cc_fx0001: { entryIds: ['w_fx0001', 'c_fx0003'] } }),
    ],
    [
      'crossword-day-entry',
      () => {
        const unknown = [day('2026-11-01', ['w_zzzzzz'])];
        return fixtureSet({}, [], {
          crosswordDays: unknown,
          recordedCrosswordDaysChecksum: checksumOf(unknown),
        });
      },
    ],
    [
      'crossword-days-gap',
      () => {
        const gap = [days[0], day('2026-11-03', ['w_fx0003'])].filter((d) => d !== undefined);
        return fixtureSet({}, [], {
          crosswordDays: gap,
          recordedCrosswordDaysChecksum: checksumOf(gap),
        });
      },
    ],
    [
      'crossword-days-repeat',
      () => {
        const repeat = [days[0], day('2026-11-02', ['w_fx0002'])].filter((d) => d !== undefined);
        return fixtureSet({}, [], {
          crosswordDays: repeat,
          recordedCrosswordDaysChecksum: checksumOf(repeat),
        });
      },
    ],
    [
      'crossword-days-immutable',
      () =>
        fixtureSet({}, [], {
          crosswordDays: days.slice(0, 1),
          recordedCrosswordDaysChecksum: checksumOf(days),
        }),
    ],
  ];

  it.each(broken)('refuses a fixture that breaks %s, naming the rule', (rule, set) => {
    expect(rules(checkContentSet(config, set(), { today }))).toEqual([rule]);
  });

  it.each([
    ['a Synonym Row', 'r_fx0001', { meaning: 'Який любить гoворити.' }],
    ['a Tip', 't_fx0001', { explanation: 'Кажуть гoворити.' }],
  ])('refuses mixed scripts in %s', (_kind, id, changes) => {
    const refusals = checkContentSet(config, fixtureSet({ [id]: changes }), { today });
    expect(refusals.map(({ rule, entryId }) => [rule, entryId])).toEqual([['mixed-script', id]]);
  });

  it("refuses a Tip exception that is the Tip's own standard form", () => {
    const { standardForm } = record('t_fx0001') as { standardForm: string };
    const exceptions = { explanation: 'Слова поза правилом.', words: ['буряк', standardForm] };
    const refusals = checkContentSet(config, fixtureSet({ t_fx0001: { exceptions } }), { today });
    expect(refusals.map(({ rule, field }) => [rule, field])).toEqual([
      ['unique-tip-exceptions', 'exceptions.words.1'],
    ]);
  });

  it('refuses a Lemma that differs from another only in case', () => {
    const { lemma } = record('w_fx0002') as { lemma: string };
    const capital = `${lemma.charAt(0).toLocaleUpperCase('uk')}${lemma.slice(1)}`;
    const set = fixtureSet({}, [parsed(record('w_fx0002', { id: 'w_fx0009', lemma: capital }))]);
    expect(rules(checkContentSet(config, set, { today }))).toEqual(['unique-lemma']);
  });

  it('refuses a repeated word in a day that follows a gap', () => {
    const gap = [day('2026-11-01', ['w_fx0002']), day('2026-11-03', ['w_fx0002'])];
    const set = fixtureSet({}, [], {
      crosswordDays: gap,
      recordedCrosswordDaysChecksum: checksumOf(gap),
    });
    expect(rules(checkContentSet(config, set, { today }))).toEqual([
      'crossword-days-gap',
      'crossword-days-repeat',
    ]);
  });

  it('refuses a fixture that breaks category-history, naming the rule', () => {
    const edition = { ...config, categoriesRequiringHistory: ['speech'] };
    expect(rules(checkContentSet(edition, fixtureSet(), { today }))).toEqual(['category-history']);
  });

  it.each([
    ['мoxo', 'Latin and Cyrillic'],
    ['мoxм', 'Cyrillic and Latin'],
    ['oммo', 'Latin and Cyrillic'],
  ])('names the script most letters of "%s" are in, the first letter’s on a tie', (word, mix) => {
    const set = fixtureSet({ w_fx0002: { primaryDefinition: `Який любить ${word}.` } });
    const refusals = checkContentSet(config, set, { today });
    expect(
      refusals.map(({ rule, message }) => [rule, /mixes (\w+ and \w+)/.exec(message)?.[1]]),
    ).toEqual([['mixed-script', mix]]);
  });
});

describe('parseRecord', () => {
  it('refuses a record its kind schema does not hold, naming the field', () => {
    expect(
      parseRecord('word', 'w_fx0002.json', record('w_fx0002', { rarity: 9, extra: 1 })),
    ).toEqual({
      ok: false,
      refusals: [
        expect.objectContaining({
          rule: 'schema',
          file: 'w_fx0002.json',
          entryId: 'w_fx0002',
          field: 'rarity',
        }),
        expect.objectContaining({ rule: 'schema', field: 'extra', message: 'Unknown field' }),
      ],
    });
  });
});

describe('checkRecord', () => {
  const current = fixtureSet();
  const save = (json: Json) => checkRecord(config, current, parsed(json), { today });

  it('passes a valid edit of a record of the set', () => {
    expect(save(record('w_fx0002', { primaryDefinition: 'Який дуже любить говорити.' }))).toEqual(
      [],
    );
  });

  it('refuses a duplicate live Lemma', () => {
    expect(save(record('w_fx0002', { id: 'w_fx0009' }))).toEqual([
      expect.objectContaining({ rule: 'unique-lemma', file: 'w_fx0009.json', entryId: 'w_fx0009' }),
    ]);
  });

  it('refuses a Stress off a vowel', () => {
    expect(save(record('w_fx0002', { stress: [0] }))).toEqual([
      expect.objectContaining({ rule: 'stress', entryId: 'w_fx0002', field: 'stress.0' }),
    ]);
  });

  it('refuses an unknown Category', () => {
    expect(save(record('w_fx0002', { categoryId: 'unknown' }))).toEqual([
      expect.objectContaining({ rule: 'word-category', entryId: 'w_fx0002', field: 'categoryId' }),
    ]);
  });

  it('refuses a Curated Collection pointing at a Retired Entry', () => {
    expect(save(record('cc_fx0001', { entryIds: ['w_fx0001', 'c_fx0003'] }))).toEqual([
      expect.objectContaining({
        rule: 'curated-collection-entry',
        entryId: 'cc_fx0001',
        field: 'entryIds.0',
      }),
    ]);
  });

  it('refuses a retire that leaves a Curated Collection naming a Retired Entry', () => {
    expect(save(record('w_fx0003', { retired: true }))).toEqual([
      expect.objectContaining({ rule: 'curated-collection-entry', entryId: 'cc_fx0001' }),
      expect.objectContaining({ rule: 'curated-collection-entry', entryId: 'cc_fx0002' }),
    ]);
  });

  it('keeps refusals the set already had out of a save', () => {
    const broken = fixtureSet({ w_fx0003: { categoryId: 'unknown' } });
    const edit = parsed(record('w_fx0002', { primaryDefinition: 'Який дуже любить говорити.' }));
    expect(checkRecord(config, broken, edit, { today })).toEqual([]);
  });
});
