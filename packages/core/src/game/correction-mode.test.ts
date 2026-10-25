import { describe, expect, it } from 'vitest';

import type { Correction, CorrectionType, Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  GAME_ROUNDS,
  openComposition,
  openUserState,
  userStateRecords,
  type Composition,
  type ContentReadPort,
  type CurrentGame,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { seededRandom } from '../test-support';

function correction(
  id: string,
  correctionType: CorrectionType,
  {
    nonStandardForm = `bad ${id.slice(2)}`,
    standardEquivalents = [`good ${id.slice(2)}`],
    sentence = `They said ${nonStandardForm} again.`,
    retired = false,
  }: {
    nonStandardForm?: string;
    standardEquivalents?: string[];
    sentence?: string;
    retired?: boolean;
  } = {},
): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType,
    standardEquivalents,
    explanation: `Why ${id.slice(2)} reads better.`,
    examplePair: { nonStandard: sentence, standard: `They said ${id.slice(2)} right.` },
    categoryId: 'everyday',
    sources: [{ title: 'Test source' }],
    retired,
  };
}

const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);

/**
 * The pack's Corrections: 8 calques, 6 surzhyk, 3 officialese and a lone
 * russianism, and a Retired calque. One calque has a second equivalent that
 * is another calque's main one, and two surzhyk share their main equivalent.
 * Two sentences hold the form as written, in other case; one holds it
 * inflected.
 */
const corrections = [
  ...numbered('c_calque', 8).map((id) =>
    id === 'c_calque01'
      ? correction(id, 'calque', {
          nonStandardForm: 'на протязі',
          standardEquivalents: ['протягом', 'good calque02'],
          sentence: 'На протязі року нічого не змінилося.',
        })
      : correction(id, 'calque'),
  ),
  ...numbered('c_surzhyk', 6).map((id) =>
    id === 'c_surzhyk01' || id === 'c_surzhyk02'
      ? correction(id, 'surzhyk', { standardEquivalents: ['наступний'] })
      : id === 'c_surzhyk03'
        ? correction(id, 'surzhyk', {
            nonStandardForm: 'получати',
            standardEquivalents: ['отримувати'],
            sentence: 'Щомісяця вона получає пенсію.',
          })
        : correction(id, 'surzhyk'),
  ),
  ...numbered('c_official', 3).map((id) => correction(id, 'officialese')),
  correction('c_russian01', 'russianism', {
    nonStandardForm: 'ПРИЙМАТИ МІРИ',
    standardEquivalents: ['вживати заходів'],
    sentence: 'Місто приймати міри не поспішає, кажуть приймати Міри.',
  }),
  correction('c_retired', 'calque', { retired: true }),
];

const word: Word = {
  kind: 'word',
  id: 'w_one',
  lemma: 'one',
  stress: [0],
  partOfSpeech: 'noun',
  primaryDefinition: 'The meaning of one.',
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
};

const content = createMemoryContentPort({ words: [word], corrections });

/** The Correction a Round asks about: the one whose "people often say" sentence is its prompt. */
function askedOf(round: Round): Correction {
  const asked = corrections.find((c) => c.examplePair.nonStandard === round.prompt);
  if (asked === undefined) throw new Error(`No Correction says «${round.prompt}»`);
  return asked;
}

/** The option that is the asked Correction's main standard equivalent. */
const rightOf = (round: Round) =>
  round.options.findIndex(({ text }) => text === askedOf(round).standardEquivalents[0]);

/** The live Corrections whose main standard equivalent an option is. */
const offeringOf = (text: string) =>
  corrections.filter((c) => !c.retired && c.standardEquivalents[0] === text);

/** Waits until the Game has planned its offers, which it does once the composition is open. */
async function offersPlanned(app: Composition): Promise<Composition> {
  const planning = () => app.game.state.modes.some((offer) => 'planning' in offer);
  if (planning()) {
    await new Promise<void>((resolve) => {
      const stop = app.game.subscribe(() => {
        if (planning()) return;
        stop();
        resolve();
      });
    });
  }
  return app;
}

/** The Core composition of one app run over the records. */
async function run({
  records = new Map<string, string>(),
  seed = 7,
  withCorrections = true,
  correctionsInMix = true,
  pack = content,
}: {
  records?: Map<string, string>;
  seed?: number;
  withCorrections?: boolean;
  correctionsInMix?: boolean;
  pack?: ContentReadPort;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content: pack,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => feature === 'game' || withCorrections,
      userSettingDefaults: {
        mix: {
          categoryIds: ['nature'],
          correctionCategoryIds: 'all' as const,
          corrections: correctionsInMix,
          idioms: true,
        },
        notificationTimes: [],
      },
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: {
      now: () => new Date('2026-10-15T09:00:00+03:00'),
      timeZone: () => 'Europe/Kyiv',
    },
    random: seededRandom(seed),
  });
  return offersPlanned(app);
}

/** History records of the Entries, as the Feed would have kept them. */
function historyOf(ids: readonly string[]): Map<string, string> {
  return new Map(
    ids.flatMap((id, index) => [
      ...userStateRecords.history.record(id).change({
        seenAt: new Date(Date.UTC(2026, 9, 1, 9, index)).toISOString(),
        wordOfTheDay: false,
      }),
    ]) as [string, string][],
  );
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** Starts «Обери правильне» and plays it to its end, always right, keeping each answered Round. */
async function playGame(app: Composition): Promise<Round[]> {
  await app.game.start('correction');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    void app.game.answer(rightOf(current(app).round));
    rounds.push(current(app).round);
    await app.game.next();
  }
  return rounds;
}

/** Every Round of a full Game for each of the seeds. */
async function roundsOfSeeds(seeds: readonly number[]): Promise<Round[]> {
  const rounds: Round[] = [];
  for (const seed of seeds) rounds.push(...(await playGame(await run({ seed }))));
  return rounds;
}

describe('«Обери правильне» on offer', () => {
  it('is offered after «Вгадай слово» when the Edition turns Corrections on', async () => {
    const app = await run({ withCorrections: true });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
      { modeId: 'correction', entryKind: 'correction', canStart: true },
    ]);
  });

  it('is off when the Edition turns Corrections off', async () => {
    const app = await run({ withCorrections: false });

    expect(app.game.state.modes.map(({ modeId }) => modeId)).toEqual(['guess-word']);
  });

  it("can't start while Corrections are out of the Mix, says so, and can once they are back", async () => {
    const app = await run({ correctionsInMix: false });
    expect(app.game.state.modes[1]).toEqual({
      modeId: 'correction',
      entryKind: 'correction',
      canStart: false,
      refusal: 'corrections-out-of-mix',
    });

    await app.game.start('correction');

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes[1]).toMatchObject({ refusal: 'corrections-out-of-mix' });

    await app.mix.setKind('correction', true);

    expect(app.game.state.modes[1]).toEqual({
      modeId: 'correction',
      entryKind: 'correction',
      canStart: true,
    });
  });

  it('reads each Correction of the pack once a session, however often the offers are planned', async () => {
    const read: string[] = [];
    const pack: ContentReadPort = {
      ...content,
      getEntries(ids) {
        read.push(...ids.filter((id) => id.startsWith('c_')));
        return content.getEntries(ids);
      },
    };
    const app = await run({ pack });

    await app.mix.setKind('correction', false);
    await app.mix.setKind('correction', true);
    await app.game.start('correction');

    expect(current(app).status).toBe('playing');
    expect(read.length).toBeGreaterThan(GAME_ROUNDS);
    expect(new Set(read).size).toBe(read.length);
  });

  it("says it can't start with fewer than 15 eligible Corrections", async () => {
    const app = await run();
    for (const id of numbered('c_calque', 4)) await app.hide({ kind: 'entry', entryId: id });

    expect(app.game.state.modes[1]).toEqual({
      modeId: 'correction',
      entryKind: 'correction',
      canStart: false,
      refusal: 'too-few-entries',
    });
  });
});

describe('a Round of «Обери правильне»', () => {
  it("asks a Correction's «people often say» sentence, with its main standard equivalent among four", async () => {
    const rounds = await roundsOfSeeds([1, 2]);

    expect(rounds).toHaveLength(2 * GAME_ROUNDS);
    for (const round of rounds) {
      const asked = askedOf(round);
      expect(round.options).toHaveLength(4);
      expect(round.options[rightOf(round)]).toEqual({
        text: asked.standardEquivalents[0],
        stressedVowels: [],
      });
      expect(round.answer?.correct).toBe(rightOf(round));
    }
  });

  it('highlights the first occurrence of the non-standard form, whatever its case', async () => {
    const rounds = await roundsOfSeeds([1, 2, 3, 4, 5]);
    const highlighted = (id: string) =>
      rounds
        .filter((round) => askedOf(round).id === id)
        .map(({ prompt, highlight }) => ({
          highlight,
          text: highlight === undefined ? undefined : prompt.slice(highlight.start, highlight.end),
        }));

    expect(highlighted('c_calque01')[0]).toEqual({
      highlight: { start: 0, end: 10 },
      text: 'На протязі',
    });
    expect(highlighted('c_russian01')[0]).toEqual({
      highlight: { start: 6, end: 19 },
      text: 'приймати міри',
    });
    expect(highlighted('c_calque05')[0]).toEqual({
      highlight: { start: 10, end: 22 },
      text: 'bad calque05',
    });
  });

  it('highlights nothing when the sentence holds the form inflected', async () => {
    const rounds = (await roundsOfSeeds([1, 2, 3, 4, 5])).filter(
      (round) => askedOf(round).id === 'c_surzhyk03',
    );

    expect(rounds.length).toBeGreaterThan(0);
    for (const round of rounds) expect(round.highlight).toBeUndefined();
  });

  it('offers the main equivalents of other Corrections of the same Correction Type first', async () => {
    for (const round of await roundsOfSeeds([1, 2, 3])) {
      const asked = askedOf(round);
      const distractors = round.options.filter((_, place) => place !== rightOf(round));
      const sameType = distractors.filter(({ text }) =>
        offeringOf(text).some(
          (c) => c.id !== asked.id && c.correctionType === asked.correctionType,
        ),
      );
      // A lone russianism tops up with other Types; three officialese have two others;
      // the pack holds no anglicism, no stress trap and no paronym.
      const expected = {
        russianism: 0,
        officialese: 2,
        calque: 3,
        surzhyk: 3,
        anglicism: 0,
        wrongStress: 0,
        paronym: 0,
      }[asked.correctionType];
      expect(sameType).toHaveLength(expected);
    }
  });

  it("never offers one of the asked Correction's own equivalents, nor two options alike", async () => {
    const rounds = await roundsOfSeeds([1, 2, 3, 4, 5, 6]);
    const askingCalque01 = rounds.filter((round) => askedOf(round).id === 'c_calque01');
    expect(askingCalque01.length).toBeGreaterThan(0);

    for (const round of rounds) {
      const texts = round.options.map(({ text }) => text);
      expect(new Set(texts).size).toBe(4);
      const own = askedOf(round).standardEquivalents;
      expect(texts.filter((text) => own.includes(text))).toEqual([own[0]]);
      expect(texts).not.toContain('good retired');
    }
  });

  it("shows the main standard equivalent and the Correction's explanation once answered", async () => {
    const app = await run();
    await app.game.start('correction');
    const { round } = current(app);
    const wrong = (rightOf(round) + 1) % 4;

    void app.game.answer(wrong);

    const asked = askedOf(round);
    expect(current(app).round.answer).toEqual({
      chosen: wrong,
      correct: rightOf(round),
      sheet: {
        answer: { text: asked.standardEquivalents[0], stressedVowels: [] },
        example: undefined,
        explanation: `Why ${asked.id.slice(2)} reads better.`,
      },
    });
  });
});

describe('the Corrections a Game asks about', () => {
  const met = [...numbered('c_calque', 8), ...numbered('c_surzhyk', 6), 'c_official01'];

  it('asks only Corrections in History once 15 eligible ones are there', async () => {
    const app = await run({ records: historyOf([...met, 'w_one']) });

    const rounds = await playGame(app);

    expect(rounds.map((round) => askedOf(round).id).toSorted()).toEqual(met.toSorted());
  });

  it('asks every eligible Correction while fewer than 15 eligible ones are in History', async () => {
    const app = await run({ records: historyOf(met) });
    await app.hide({ kind: 'entry', entryId: 'c_calque08' });

    const rounds = await playGame(app);

    expect(rounds.some((round) => !met.includes(askedOf(round).id))).toBe(true);
    expect(rounds.some((round) => askedOf(round).id === 'c_calque08')).toBe(false);
  });
});

// Spec #461, ADR 0043: a wrong answer marks the Entry «Не знаю», in every Game Mode.
describe('the Knowledge Marks «Обери правильне» leaves', () => {
  it('marks the Correction of a wrong answer «Не знаю», due for Review tomorrow', async () => {
    const app = await run();
    await app.game.start('correction');
    const { round } = current(app);

    void app.game.answer((rightOf(round) + 1) % round.options.length);
    await app.game.next();

    expect(app.knowledge.state.shown.get(askedOf(round).id)).toBe('unknown');
    expect(
      app.knowledge.state.learning.map(({ entryId, daysUntilReview }) => [
        entryId,
        daysUntilReview,
      ]),
    ).toEqual([[askedOf(round).id, 1]]);
  });
});
