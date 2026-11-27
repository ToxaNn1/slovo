import { describe, expect, it } from 'vitest';

import type { SynonymRow } from '@slovo/contracts';

import type { AskableEntry } from '../entries/entries';
import { seededRandom, synonymRow, testComparison, testEdition, tip, word } from '../test-support';
import type { RoundContent } from './game-mode';
import { guessWord } from './guess-word';

/** Seeds far apart, so their first draws differ. */
const SEEDS = Array.from({ length: 12 }, (_, index) => 1 + index * 104_729);

/** The content «Вгадай слово» builds for the answer at the Round given. */
const roundFor = (
  answer: AskableEntry,
  eligible: readonly AskableEntry[],
  { round = 1, seed = 1 }: { round?: number; seed?: number } = {},
): RoundContent | undefined =>
  guessWord.buildRound({
    answer,
    eligible,
    next: [],
    upTo: 1,
    round,
    random: seededRandom(seed),
    edition: testEdition(),
    comparison: testComparison,
  });

function pickOf(content: RoundContent | undefined): RoundContent & { form: 'pick' } {
  if (content?.form !== 'pick') throw new Error(`No pick Round but ${String(content?.form)}`);
  return content;
}

const textsOf = (content: RoundContent | undefined) =>
  pickOf(content).options.map(({ text }) => text);

const fillers = ['вирій', 'оброк', 'ослін', 'бекеш'].map((lemma) => word(`w_${lemma}`));

describe('a Word Round of «Вгадай слово»', () => {
  const kobza = word('w_кобза', {
    examples: [{ text: 'Грала кобза, а кобзар мовчав.' }],
    primaryDefinition: 'A string instrument.',
  });
  const bandura = word('w_бандура', { primaryDefinition: 'A string instrument.' });
  const eligible = [kobza, bandura, ...fillers];

  it('puts a gap in an Example where the Lemma comes again only inside a longer word', () => {
    expect(roundFor(kobza, eligible, { round: 6 })).toMatchObject({
      form: 'pick',
      prompt: 'Грала …, а кобзар мовчав.',
      labelKind: 'gap',
    });
  });

  it.each([11, 12, 15])(
    'asks a Word whose Definition another shares by that Definition in Round %i, with no gap',
    (round) => {
      const content = pickOf(roundFor(kobza, eligible, { round }));

      expect(content.prompt).toBe('A string instrument.');
      expect(content.highlight).toBeUndefined();
    },
  );

  it("never offers a homonym's Lemma beside the answer's", () => {
    const braid = word('w_коса1', { lemma: 'коса', primaryDefinition: 'A braid.' });
    const scythe = word('w_коса2', { lemma: 'коса', primaryDefinition: 'A scythe.' });
    const shown = SEEDS.map((seed) =>
      textsOf(roundFor(braid, [braid, scythe, ...fillers.slice(0, 3)], { seed })),
    );

    for (const texts of shown) expect(new Set(texts).size).toBe(4);
  });
});

describe('a Synonym Row Round of «Вгадай слово»', () => {
  const rowOf = (id: string, members: readonly string[]): SynonymRow =>
    synonymRow(id, {
      dominant: { text: id.slice(2), stress: [0] },
      members: members.map((text) => ({ text, stress: [0] })),
    });
  const asked = rowOf('r_walk', ['stroll', 'stride', 'amble']);

  it('says it asks a Synonym Row', () => {
    const rows = [
      asked,
      rowOf('r_run', ['dash']),
      rowOf('r_eat', ['dine']),
      rowOf('r_say', ['tell']),
    ];

    expect(roundFor(asked, rows)).toMatchObject({ form: 'pick', labelKind: 'synonymRow' });
  });

  it('asks nothing when the other rows give fewer than three members the row lacks', () => {
    const rows = [
      asked,
      rowOf('r_go', ['stroll', 'amble']),
      rowOf('r_eat', ['dine']),
      rowOf('r_say', ['tell']),
    ];

    for (const seed of SEEDS) expect(roundFor(asked, rows, { seed })).toBeUndefined();
  });

  it('never offers one text twice, though two other rows share it', () => {
    const rows = [
      asked,
      rowOf('r_run', ['dash']),
      rowOf('r_rush', ['dash']),
      rowOf('r_eat', ['dine']),
      rowOf('r_say', ['tell']),
    ];

    for (const seed of SEEDS)
      expect(new Set(textsOf(roundFor(asked, rows, { seed }))).size).toBe(4);
  });
});

describe('a Tip Round of «Вгадай слово»', () => {
  it('says it asks a Tip', () => {
    const asked = tip('t_time');

    expect(roundFor(asked, [asked])).toMatchObject({ form: 'pick', labelKind: 'tip' });
  });
});
