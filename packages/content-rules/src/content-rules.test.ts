import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  EditionConfigSchema,
  FeatureSwitchStateSchema,
  featureSwitchStates,
  STRESS_MARK,
  type CrosswordDay,
} from '@slovo/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  checkContentSet,
  checkRecord,
  checksumOf,
  contentSetOf,
  dateAfter,
  parseRecord,
  recordIdOf,
  type AuthoredRecord,
  type ContentSet,
  type RecordKind,
  type Refusal,
  type RuleName,
  plainText,
  wordKey,
} from './index';

type Json = Record<string, unknown>;

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

// The fixture states only the switches it turns off; the rest come on from the catalogue.
const raw = z
  .looseObject({ featureSwitches: z.record(z.string(), FeatureSwitchStateSchema) })
  .parse(fixture('edition.json'));
const config = EditionConfigSchema.parse({
  ...raw,
  featureSwitches: featureSwitchStates(raw.featureSwitches),
});
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
    ['curated-collection-pictogram', () => fixtureSet({ cc_fx0001: { pictogram: 'unknown' } })],
    [
      'crossword-day-entry',
      () => {
        const unknown = [day('2026-11-01', ['w_zzzzzz'])];
        return fixtureSet({}, [], {
          crosswordDays: unknown,
        });
      },
    ],
    [
      'crossword-days-gap',
      () => {
        const gap = [days[0], day('2026-11-03', ['w_fx0003'])].filter((d) => d !== undefined);
        return fixtureSet({}, [], {
          crosswordDays: gap,
        });
      },
    ],
    [
      'crossword-days-repeat',
      () => {
        const repeat = [days[0], day('2026-11-02', ['w_fx0002'])].filter((d) => d !== undefined);
        return fixtureSet({}, [], {
          crosswordDays: repeat,
        });
      },
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

  it('passes a Retired Curated Collection naming a Retired Entry', () => {
    expect(
      save(record('cc_fx0001', { entryIds: ['w_fx0001', 'c_fx0003'], retired: true })),
    ).toEqual([]);
  });

  it('passes a retire of an Entry only Retired Curated Collections name', () => {
    const retiredCollections = fixtureSet({
      cc_fx0001: { retired: true },
      cc_fx0002: { retired: true },
    });
    const retire = parsed(record('w_fx0003', { retired: true }));
    expect(checkRecord(config, retiredCollections, retire, { today })).toEqual([]);
  });

  it('refuses a bring-back of a Curated Collection naming a Retired Entry', () => {
    const retiredCollection = fixtureSet({
      cc_fx0001: { entryIds: ['w_fx0001', 'c_fx0003'], retired: true },
    });
    const bringBack = parsed(
      record('cc_fx0001', { entryIds: ['w_fx0001', 'c_fx0003'], retired: false }),
    );
    expect(checkRecord(config, retiredCollection, bringBack, { today })).toEqual([
      expect.objectContaining({
        rule: 'curated-collection-entry',
        entryId: 'cc_fx0001',
        field: 'entryIds.0',
      }),
    ]);
  });

  it('keeps refusals the set already had out of a save', () => {
    const broken = fixtureSet({ w_fx0003: { categoryId: 'unknown' } });
    const edit = parsed(record('w_fx0002', { primaryDefinition: 'Який дуже любить говорити.' }));
    expect(checkRecord(config, broken, edit, { today })).toEqual([]);
  });
});

describe('plainText', () => {
  it('keeps an entity past the last code point as it is written', () => {
    expect(plainText('a &#x110000; b &#1114112; &#x441;')).toBe('a &#x110000; b &#1114112; с');
  });
});

describe('the Entry rules', () => {
  const check = (set: ContentSet, edition = config) => checkContentSet(edition, set, { today });
  const withRule = (rule: RuleName, refusals: readonly Refusal[]) =>
    refusals.filter((refusal) => refusal.rule === rule);
  const withTraits = (traits: Partial<typeof config.languageTraits>) => ({
    ...config,
    languageTraits: { ...config.languageTraits, ...traits },
  });

  it('names the file the id was first used in', () => {
    const copy = parsed(record('w_fx0002', { lemma: 'балакуча' }), 'x.json');
    expect(check(fixtureSet({}, [copy]))).toEqual([
      {
        rule: 'duplicate-id',
        file: 'x.json',
        entryId: 'w_fx0002',
        field: 'id',
        message: 'Duplicate id, already used in w_fx0002.json',
      },
    ]);
  });

  it('refuses a Word authored twice under one id as a duplicate id only', () => {
    const copy = parsed(record('w_fx0002'), 'x.json');
    expect(rules(check(fixtureSet({}, [copy])))).toEqual(['duplicate-id']);
  });

  it.each([
    [
      'балакучийß',
      '"ß" (U+00DF) is not a letter of the alphabet or punctuation the Edition allows',
    ],
    [
      'балакучи́й',
      'Holds the combining mark U+0301: mark Stress in the stress field and write every letter whole',
    ],
  ])('refuses the stray character of the Lemma "%s", naming it', (lemma, message) => {
    expect(withRule('stray-character', check(fixtureSet({ w_fx0002: { lemma } })))).toEqual([
      {
        rule: 'stray-character',
        file: 'w_fx0002.json',
        entryId: 'w_fx0002',
        field: 'lemma',
        message,
      },
    ]);
  });

  it('takes a letter written with two characters in a Lemma and an expression', () => {
    const letter = 'и̇';
    const edition = withTraits({ alphabet: [...config.languageTraits.alphabet, letter] });
    const set = fixtureSet({
      w_fx0002: { lemma: `балакуч${letter}й` },
      i_fx0001: { expression: `б${letter}ти байдики` },
    });
    expect(rules(check(set, edition))).not.toContain('stray-character');
  });

  it('names the live Word of the same Lemma and primary Definition', () => {
    const copy = parsed(record('w_fx0002', { id: 'w_fx0009' }));
    expect(check(fixtureSet({}, [copy]))).toEqual([
      {
        rule: 'unique-lemma',
        file: 'w_fx0009.json',
        entryId: 'w_fx0009',
        field: 'primaryDefinition',
        message:
          'Same Lemma and primary Definition as w_fx0002 in w_fx0002.json: author it once, or retire one of them',
      },
    ]);
  });

  it('tells a Word by its Lemma and its trimmed primary Definition', () => {
    expect(wordKey('слово', 'Одиниця мови. ')).toBe(wordKey('слово', 'Одиниця мови.'));
  });

  it('passes a Retired Word of the Lemma and primary Definition of a live one', () => {
    const copy = parsed(record('w_fx0002', { id: 'w_fx0009', retired: true }));
    expect(check(fixtureSet({}, [copy]))).toEqual([]);
  });

  it.each([
    [
      { correctionIds: ['c_fx0002', 'c_zzzzzz'] },
      'word-correction',
      'correctionIds.1',
      'Unknown Correction "c_zzzzzz"',
    ],
    [{ categoryId: 'unknown' }, 'word-category', 'categoryId', 'Unknown Category "unknown"'],
    [
      { origin: 'latin' },
      'word-origin',
      'origin',
      'Unknown origin language "latin": the Edition\'s originLanguages list no such code',
    ],
    [{ stress: [] }, 'marks-stress', 'stress', 'Required: the Edition marks Stress'],
    [{ stress: [1, 2] }, 'stress', 'stress.1', 'Position 2 is "л", not a vowel'],
    [{ stress: [20] }, 'stress', 'stress.0', 'Position 20 is out of range for the 9-letter Lemma'],
  ])('refuses a Word with %j, naming the field', (changes, rule, field, message) => {
    expect(check(fixtureSet({ w_fx0002: changes }))).toEqual([
      { rule, file: 'w_fx0002.json', entryId: 'w_fx0002', field, message },
    ]);
  });

  it('names the Category that requires history, and passes a Word that has it', () => {
    const edition = { ...config, categoriesRequiringHistory: ['speech'] };
    const history = 'Тестова історія слова.';
    expect(check(fixtureSet({ w_fx0002: { history } }), edition)).toEqual([
      {
        rule: 'category-history',
        file: 'w_fx0003.json',
        entryId: 'w_fx0003',
        field: 'history',
        message: 'Required: Category "speech" requires history',
      },
    ]);
  });

  it('refuses a Stress mark and a wrong-stress Correction where the Edition marks no Stress', () => {
    const edition = withTraits({ stress: { marked: false } });
    const refusals = check(fixtureSet({ w_fx0002: { stress: [] } }), edition);
    expect(withRule('marks-stress', refusals)).toEqual([
      {
        rule: 'marks-stress',
        file: 'w_fx0001.json',
        entryId: 'w_fx0001',
        field: 'stress',
        message: 'Not allowed: the Edition does not mark Stress',
      },
      {
        rule: 'marks-stress',
        file: 'w_fx0003.json',
        entryId: 'w_fx0003',
        field: 'stress',
        message: 'Not allowed: the Edition does not mark Stress',
      },
      {
        rule: 'marks-stress',
        file: 'c_fx0005.json',
        entryId: 'c_fx0005',
        field: 'correctionType',
        message: 'Not allowed: the Edition does not mark Stress',
      },
    ]);
  });

  it('refuses the stray character of an expression, naming it', () => {
    expect(check(fixtureSet({ i_fx0001: { expression: 'бити байдики7' } }))).toEqual([
      {
        rule: 'stray-character',
        file: 'i_fx0001.json',
        entryId: 'i_fx0001',
        field: 'expression',
        message:
          '"7" (U+0037) is not a letter of the alphabet, punctuation or space the Edition allows',
      },
    ]);
  });

  it('names the live Idiom of the same expression, and passes a Retired one', () => {
    const copy = parsed(record('i_fx0001', { id: 'i_fx0009', expression: 'Бити байдики' }));
    const retired = parsed(record('i_fx0001', { id: 'i_fx0008', retired: true }));
    expect(check(fixtureSet({}, [copy, retired]))).toEqual([
      {
        rule: 'unique-expression',
        file: 'i_fx0009.json',
        entryId: 'i_fx0009',
        field: 'expression',
        message:
          'Same expression as i_fx0001 in i_fx0001.json: author it once, or retire one of them',
      },
    ]);
  });

  it('refuses an Idiom authored twice under one id as a duplicate id only', () => {
    const copy = parsed(record('i_fx0001'), 'x.json');
    expect(rules(check(fixtureSet({}, [copy])))).toEqual(['duplicate-id']);
  });

  it('names an unknown Correction Category', () => {
    expect(check(fixtureSet({ c_fx0004: { categoryId: 'unknown' } }))).toEqual([
      {
        rule: 'correction-category',
        file: 'c_fx0004.json',
        entryId: 'c_fx0004',
        field: 'categoryId',
        message: 'Unknown Category "unknown"',
      },
    ]);
  });

  it('refuses a Stress mark in each text of a Correction that is not a stress trap', () => {
    const marked = (text: string) => `${text}${STRESS_MARK}`;
    const { examplePair } = record('c_fx0001') as { examplePair: Record<string, string> };
    const set = fixtureSet({
      c_fx0001: {
        nonStandardForm: marked('всігда'),
        standardEquivalents: [marked('завжди')],
        explanation: marked('Тестове пояснення.'),
        examplePair: {
          nonStandard: marked(examplePair['nonStandard'] ?? ''),
          standard: marked(examplePair['standard'] ?? ''),
        },
      },
    });
    const message = 'Not allowed: only a wrong-stress Correction writes Stress marks';
    expect(withRule('wrong-stress', check(set))).toEqual(
      [
        'nonStandardForm',
        'standardEquivalents.0',
        'explanation',
        'examplePair.nonStandard',
        'examplePair.standard',
      ].map((field) => ({
        rule: 'wrong-stress',
        file: 'c_fx0001.json',
        entryId: 'c_fx0001',
        field,
        message,
      })),
    );
  });

  it('passes a stress trap whose explanation and example pair carry no Stress mark', () => {
    const set = fixtureSet({
      c_fx0005: {
        nonStandardForm: 'Черго́вий',
        explanation: 'Наголос падає на закінчення.',
        examplePair: {
          nonStandard: 'Сьогодні черговий Андрій.',
          standard: '**Сьогодні черговий Андрій**.',
        },
      },
    });
    expect(check(set)).toEqual([]);
  });

  it.each([
    [
      { nonStandardForm: 'черговий' },
      'nonStandardForm',
      'Required: a wrong-stress Correction writes a Stress mark in each form',
    ],
    [
      { nonStandardForm: 'черѓовий' },
      'nonStandardForm',
      'The Stress mark follows "г", not a vowel',
    ],
    [
      { standardEquivalents: ['́черговий'] },
      'standardEquivalents.0',
      'The Stress mark follows "", not a vowel',
    ],
    [
      { standardEquivalents: ['чергова́'] },
      'standardEquivalents.0',
      "A wrong-stress Correction's forms differ only in their Stress marks",
    ],
  ])('refuses a stress trap with %j, naming the field', (changes, field, message) => {
    expect(withRule('wrong-stress', check(fixtureSet({ c_fx0005: changes })))).toEqual([
      { rule: 'wrong-stress', file: 'c_fx0005.json', entryId: 'c_fx0005', field, message },
    ]);
  });

  const mixed = (definition: string) =>
    check(fixtureSet({ w_fx0002: { primaryDefinition: definition } })).map(({ field, message }) => [
      field,
      message,
    ]);

  it('refuses a one-letter word in another script than the words around it', () => {
    expect(mixed('Який любить i говорити.')).toEqual([
      [
        'primaryDefinition',
        'The word "i" stands in Latin between Cyrillic words ("i" U+0069): write each word in one script',
      ],
    ]);
  });

  it.each([
    'i любить говорити.',
    'Який любить i.',
    'Який любить i hello.',
    'Який hello говорити.',
    'Який 中文 говорити.',
    'X.',
  ])('passes the words of one script each in "%s"', (definition) => {
    expect(mixed(definition)).toEqual([]);
  });

  it('names the first letter of another script, past a combining mark and an unknown script', () => {
    expect(mixed('Який го́вoрит中.')).toEqual([
      [
        'primaryDefinition',
        'The word "го́вoрит中" mixes Cyrillic and Latin letters ("o" U+006F): write each word in one script',
      ],
    ]);
  });

  it('names the nested field of a mixed-script word, and leaves the etymology out', () => {
    const set = fixtureSet({
      w_fx0002: { examples: [{ text: 'Він гoворить.' }] },
      i_fx0001: { etymology: 'Від праслов. *světъ.' },
    });
    expect(check(set).map(({ entryId, field }) => [entryId, field])).toEqual([
      ['w_fx0002', 'examples.0.text'],
    ]);
  });
});

describe('the rules of the other records', () => {
  const check = (set: ContentSet) => checkContentSet(config, set, { today });
  const members = () => (record('r_fx0001') as { members: Json[] }).members;

  it('names an unknown Word and a Stress off a vowel in a Synonym Row', () => {
    const [first, second, ...rest] = members();
    const set = fixtureSet({
      r_fx0001: {
        dominant: { text: 'тихо', stress: [0, 20] },
        members: [first, { ...second, wordId: 'w_zzzzzz', stress: [0] }, ...rest],
      },
    });
    const refusal = (rule: RuleName, field: string, message: string) => ({
      rule,
      file: 'r_fx0001.json',
      entryId: 'r_fx0001',
      field,
      message,
    });
    expect(check(set)).toEqual([
      refusal('stress', 'dominant.stress.0', 'Position 0 is "т", not a vowel'),
      refusal('stress', 'dominant.stress.1', 'Position 20 is out of range for the 4-letter text'),
      refusal('synonym-row-word', 'members.1.wordId', 'Unknown Word "w_zzzzzz"'),
      refusal('stress', 'members.1.stress.0', 'Position 0 is "м", not a vowel'),
    ]);
  });

  it('names the member a Synonym Row already holds', () => {
    const all = members();
    const set = fixtureSet({
      r_fx0001: { members: [...all.slice(0, -1), { ...all[0], text: 'Глухо' }] },
    });
    expect(check(set)).toEqual([
      {
        rule: 'unique-synonym-text',
        file: 'r_fx0001.json',
        entryId: 'r_fx0001',
        field: 'members.6.text',
        message: 'Same text as members.0: a row names each word once',
      },
    ]);
  });

  it('names the answer a Game question already gives, and the exception already named', () => {
    const { gameQuestion } = record('t_fx0001') as {
      gameQuestion: Json & { wrongAnswers: string[] };
    };
    const [, ...rest] = gameQuestion.wrongAnswers;
    const set = fixtureSet({
      t_fx0001: {
        gameQuestion: { ...gameQuestion, wrongAnswers: ['він із походження', ...rest] },
        exceptions: { explanation: 'Слова поза правилом.', words: ['буряк', 'Буряк'] },
      },
    });
    expect(check(set)).toEqual([
      {
        rule: 'unique-tip-answers',
        file: 't_fx0001.json',
        entryId: 't_fx0001',
        field: 'gameQuestion.wrongAnswers.0',
        message: 'Same answer as rightAnswer: a Game question gives four different answers',
      },
      {
        rule: 'unique-tip-exceptions',
        file: 't_fx0001.json',
        entryId: 't_fx0001',
        field: 'exceptions.words.1',
        message:
          '"Буряк" is the standard form or an exception already: each exception is another word',
      },
    ]);
  });

  it('frees a literary use on 1 January of the 71st year after the death, in Kyiv', () => {
    const use = (authorDeathYear: number) => ({
      author: 'Автор',
      work: 'Твір',
      authorDeathYear,
      text: 'Текст.',
    });
    const set = fixtureSet({ c_fx0001: { literaryUses: [use(1955), use(1956)] } });
    expect(check(set)).toEqual([
      {
        rule: 'public-domain',
        file: 'c_fx0001.json',
        entryId: 'c_fx0001',
        field: 'literaryUses.1.authorDeathYear',
        message: 'Not in the public domain until 1 January 2027',
      },
    ]);
  });

  it('names a Curated Collection id used twice, an unknown Entry and a Retired one', () => {
    const copy = parsed(record('cc_fx0001', { entryIds: ['w_zzzzzz', 'w_fx0001'] }), 'x.json');
    const refusal = (rule: RuleName, field: string, message: string) => ({
      rule,
      file: 'x.json',
      entryId: 'cc_fx0001',
      field,
      message,
    });
    expect(check(fixtureSet({}, [copy]))).toEqual([
      refusal('duplicate-id', 'id', 'Duplicate Curated Collection id: also in cc_fx0001.json'),
      refusal('curated-collection-entry', 'entryIds.0', 'No Entry w_zzzzzz in this Edition'),
      refusal(
        'curated-collection-entry',
        'entryIds.1',
        'w_fx0001 is a Retired Entry: a Curated Collection names live Entries only',
      ),
    ]);
  });

  it('takes a Correction Category as a pictogram and names an unknown one', () => {
    const set = fixtureSet({
      cc_fx0001: { pictogram: 'work' },
      cc_fx0002: { pictogram: 'unknown' },
    });
    expect(check(set)).toEqual([
      {
        rule: 'curated-collection-pictogram',
        file: 'cc_fx0002.json',
        entryId: 'cc_fx0002',
        field: 'pictogram',
        message: 'The pictogram unknown is no Category or Correction Category of the Edition',
      },
    ]);
  });
});

describe('the crossword days', () => {
  const FILE = 'snapshot:crosswordDays';
  const check = (crosswordDays: readonly CrosswordDay[]) =>
    checkContentSet(config, fixtureSet({}, [], { crosswordDays }), { today });
  /** `count` days in a row from 2026-11-01, the word in the first and the last only. */
  const run = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      day(dateAfter('2026-11-01', i), i === 0 || i === count - 1 ? ['w_fx0002'] : []),
    );

  it('takes a word back 20 days later and refuses it 19 days later, naming the day', () => {
    expect(check(run(21))).toEqual([]);
    expect(check(run(20))).toEqual([
      {
        rule: 'crossword-days-repeat',
        file: FILE,
        field: '19.words.0.entryId',
        message:
          'w_fx0002 is also in the day of 2026-11-01: a word comes back only 20 days or more later',
      },
    ]);
  });

  it('names the day a gap expects, and takes a word back past it', () => {
    const gap = [day('2026-11-01', ['w_fx0002']), day('2026-11-25', ['w_fx0002'])];
    expect(check(gap)).toEqual([
      {
        rule: 'crossword-days-gap',
        file: FILE,
        field: '1.date',
        message: 'Expected 2026-11-02, the day after the one before: the days run without a gap',
      },
    ]);
  });

  it('names the word no Word or Correction stands behind', () => {
    expect(
      check([day('2026-11-01', ['w_fx0002']), day('2026-11-02', ['w_fx0003', 'w_zzzzzz'])]),
    ).toEqual([
      {
        rule: 'crossword-day-entry',
        file: FILE,
        field: '1.words.1.entryId',
        message: 'No Word or Correction w_zzzzzz in the Edition',
      },
    ]);
  });
});

describe('checkRecord of every kind', () => {
  const current = fixtureSet();
  const save = (json: Json, set = current) => checkRecord(config, set, parsed(json), { today });

  it.each(['c_fx0002', 'i_fx0001', 'r_fx0001', 't_fx0001'])('passes a valid save of %s', (id) => {
    expect(save(record(id))).toEqual([]);
  });

  it.each([
    ['c_fx0002', { categoryId: 'unknown' }, 'correction-category'],
    ['i_fx0001', { expression: 'бити байдики7' }, 'stray-character'],
    ['r_fx0001', { dominant: { text: 'тихо', stress: [0] } }, 'stress'],
    [
      't_fx0001',
      { exceptions: { explanation: 'Слова поза правилом.', words: ['буряк', 'Буряк'] } },
      'unique-tip-exceptions',
    ],
  ])('refuses a broken save of %s in its place in the set', (id, changes, rule) => {
    expect(rules(save(record(id, changes)))).toEqual([rule]);
  });

  it("keeps the saved record's own refusals, though the set already had them", () => {
    const broken = fixtureSet({ w_fx0002: { correctionIds: ['c_zzzzzz'] } });
    expect(rules(save(record('w_fx0002', { correctionIds: ['c_zzzzzz'] }), broken))).toEqual([
      'word-correction',
    ]);
  });

  it('keeps the refusals of other records the set already had out, and names the new ones', () => {
    const broken = fixtureSet({ cc_fx0002: { entryIds: ['c_fx0004', 'w_fx0003', 'w_zzzzzz'] } });
    expect(save(record('w_fx0003', { retired: true }), broken)).toEqual([
      expect.objectContaining({
        rule: 'curated-collection-entry',
        entryId: 'cc_fx0001',
        field: 'entryIds.0',
      }),
      expect.objectContaining({
        rule: 'curated-collection-entry',
        entryId: 'cc_fx0002',
        field: 'entryIds.1',
      }),
    ]);
  });

  describe('a Crossword day', () => {
    const days = [day('2026-11-10', ['w_fx0002']), day('2026-11-11', ['w_fx0003'])];
    const set = fixtureSet({}, [], { crosswordDays: days });
    const saveDay = (saved: CrosswordDay, options: { editionDate?: string } = {}) =>
      checkRecord(
        config,
        set,
        { kind: 'crosswordDay', file: 'd.json', entry: saved },
        {
          today: new Date(Date.UTC(2026, 10, 8, 23)),
          ...options,
        },
      );
    const refusal = (rule: RuleName, field: string, message: string) => ({
      rule,
      file: 'd.json',
      field,
      message,
    });

    it('passes a day after the last, and an edit of a day to come', () => {
      expect(saveDay(day('2026-11-12', ['c_fx0001']))).toEqual([]);
      expect(saveDay(day('2026-11-11', ['w_fx0003', 'c_fx0001']))).toEqual([]);
    });

    it("refuses a day on or before today, the UTC date when the Edition's is not given", () => {
      expect(saveDay(day('2026-11-08', ['c_fx0001']))).toEqual([
        refusal(
          'crossword-days-immutable',
          'date',
          'The day of 2026-11-08 is published: a day on or before today never changes',
        ),
      ]);
      expect(
        rules(saveDay(day('2026-11-09', ['c_fx0001']), { editionDate: '2026-11-09' })),
      ).toEqual(['crossword-days-immutable']);
    });

    it('names the day a gap expects on either side', () => {
      expect(saveDay(day('2026-11-13', ['c_fx0001']))).toEqual([
        refusal(
          'crossword-days-gap',
          'date',
          'Expected 2026-11-12, the day after the one before: the days run without a gap',
        ),
      ]);
      expect(saveDay(day('2026-11-09', ['c_fx0001']), { editionDate: '2026-11-08' })).toEqual([]);
      const later = fixtureSet({}, [], { crosswordDays: [day('2026-11-12', ['w_fx0002'])] });
      expect(
        checkRecord(
          config,
          later,
          { kind: 'crosswordDay', file: 'd.json', entry: day('2026-11-10', ['c_fx0001']) },
          {
            today: new Date(Date.UTC(2026, 10, 8)),
          },
        ),
      ).toEqual([
        refusal(
          'crossword-days-gap',
          'date',
          'Expected 2026-11-11, the day before the one after: the days run without a gap',
        ),
      ]);
    });

    it('names an unknown word and a word within 20 days of another day of it', () => {
      expect(saveDay(day('2026-11-12', ['w_zzzzzz', 'w_fx0003', 'c_fx0001']))).toEqual([
        refusal(
          'crossword-day-entry',
          'words.0.entryId',
          'No Word or Correction w_zzzzzz in the Edition',
        ),
        refusal(
          'crossword-days-repeat',
          'words.1.entryId',
          'w_fx0003 is also in the day of 2026-11-11: a word comes back only 20 days or more apart',
        ),
      ]);
    });

    it('takes a word back 20 days apart on either side, not 19', () => {
      const far = [
        day('2026-11-10', ['w_fx0002']),
        day('2026-11-11', ['w_fx0003']),
        ...Array.from({ length: 18 }, (_, i) => day(dateAfter('2026-11-12', i), [])),
        day('2026-11-30', ['c_fx0001']),
        day('2026-12-01', ['c_fx0002']),
      ];
      const farSet = fixtureSet({}, [], { crosswordDays: far });
      const saved = day('2026-11-30', ['w_fx0002', 'w_fx0003']);
      const result = checkRecord(
        config,
        farSet,
        { kind: 'crosswordDay', file: 'd.json', entry: saved },
        {
          today: new Date(Date.UTC(2026, 10, 8)),
        },
      );
      expect(result.map(({ field, message }) => [field, message.slice(0, 41)])).toEqual([
        ['words.1.entryId', 'w_fx0003 is also in the day of 2026-11-11'],
      ]);
      const back = day('2026-11-11', ['c_fx0001', 'c_fx0002']);
      const resultBack = checkRecord(
        config,
        farSet,
        { kind: 'crosswordDay', file: 'd.json', entry: back },
        {
          today: new Date(Date.UTC(2026, 10, 8)),
        },
      );
      expect(resultBack.map(({ field, message }) => [field, message.slice(0, 41)])).toEqual([
        ['words.0.entryId', 'c_fx0001 is also in the day of 2026-11-30'],
      ]);
    });
  });
});

describe('contentSetOf', () => {
  it('locates each record by its kind and id, and puts the crossword days in date order', () => {
    const set = fixtureSet();
    const entries = <T>(authored: readonly { entry: T }[]) => authored.map(({ entry }) => entry);
    const later = day('2026-11-02', ['w_fx0003']);
    const earlier = day('2026-11-01', ['w_fx0002']);
    const records = {
      word: entries(set.words),
      correction: entries(set.corrections),
      idiom: entries(set.idioms),
      synonymRow: entries(set.synonymRows),
      tip: entries(set.tips),
      curatedCollection: entries(set.curatedCollections),
      crosswordDay: [later, earlier],
    };
    const located = contentSetOf(records);
    expect(located.crosswordDays).toEqual([earlier, later]);
    expect(
      [
        located.words,
        located.corrections,
        located.idioms,
        located.synonymRows,
        located.tips,
        located.curatedCollections,
      ].map((authored) => authored[0]?.file),
    ).toEqual([
      'word/w_fx0001',
      'correction/c_fx0001',
      'idiom/i_fx0001',
      'synonymRow/r_fx0001',
      'tip/t_fx0001',
      'curatedCollection/cc_fx0001',
    ]);
    expect(located.words.map(({ entry }) => entry)).toEqual(records.word);
    expect(contentSetOf(records, (kind, id) => `${id}.${kind}`).tips[0]?.file).toBe('t_fx0001.tip');
  });
});

describe('checksumOf', () => {
  it('is the SHA-256 of the JSON with keys sorted and undefined fields left out', () => {
    const sha = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
    expect(checksumOf({ b: 1, a: [2, { d: undefined, c: 'x', ab: null }] })).toBe(
      sha('{"a":[2,{"ab":null,"c":"x"}],"b":1}'),
    );
    expect(checksumOf([1, 2])).not.toBe(checksumOf([2, 1]));
    expect(checksumOf({ c: 1, a: 2, d: 4, b: 3 })).toBe(sha('{"a":2,"b":3,"c":1,"d":4}'));
  });
});

describe('parseRecord without an id to name', () => {
  it.each([null, 'w_fx0002', { id: '' }, { id: 7 }, { lemma: 'слово' }])(
    'names no Entry for %j',
    (json) => {
      const result = parseRecord('word', 'x.json', json);
      expect(result.ok ? [] : result.refusals.map(({ entryId }) => entryId)).not.toEqual([]);
      expect(
        result.ok ? ['ok'] : result.refusals.filter((refusal) => 'entryId' in refusal),
      ).toEqual([]);
    },
  );

  it('names no field for the record itself, and the dotted path for a nested one', () => {
    const whole = parseRecord('word', 'x.json', null);
    expect(whole.ok ? [] : whole.refusals.map(({ message: _, ...located }) => located)).toEqual([
      { rule: 'schema', file: 'x.json' },
    ]);
    const result = parseRecord('word', 'x.json', record('w_fx0002', { sources: [{ title: 1 }] }));
    expect(result.ok ? [] : result.refusals.map(({ field }) => field)).toEqual(['sources.0.title']);
  });

  it('parses a Crossword day', () => {
    const word = (entryId: string, row: number, column: number, direction: 'across' | 'down') => ({
      entryId,
      answer: 'ааааа',
      clue: 'Підказка.',
      row,
      column,
      direction,
    });
    const frame = {
      date: '2026-11-01',
      words: [
        word('w_fx0002', 0, 0, 'across'),
        word('w_fx0003', 4, 0, 'across'),
        word('c_fx0001', 0, 0, 'down'),
        word('c_fx0002', 0, 4, 'down'),
      ],
    };
    const result = parseRecord('crosswordDay', 'd.json', frame);
    expect(result).toEqual({
      ok: true,
      record: { kind: 'crosswordDay', file: 'd.json', entry: frame },
    });
    expect(result.ok ? recordIdOf(result.record) : '').toBe('2026-11-01');
    expect(recordIdOf(parsed(record('w_fx0002')))).toBe('w_fx0002');
  });

  it('names no Entry for the refusals of a Crossword day', () => {
    const valid = day('2026-11-01', ['w_fx0002']);
    const result = parseRecord('crosswordDay', 'd.json', { ...valid, id: 'w_fx0002', date: 'x' });
    expect(result.ok ? ['ok'] : result.refusals.filter((refusal) => 'entryId' in refusal)).toEqual(
      [],
    );
  });
});
