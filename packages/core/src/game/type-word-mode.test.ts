import { describe, expect, it } from 'vitest';

import type { Correction, CorrectionType } from '@slovo/contracts';

import {
  buildGameReview,
  createMemoryUserStatePort,
  GAME_ROUNDS,
  openComposition,
  openUserState,
  type Composition,
  type CurrentGame,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { seededRandom } from '../test-support';

function correction(
  id: string,
  {
    correctionType = 'calque',
    nonStandardForm = `bad ${id.slice(2)}`,
    standardEquivalents = [`good ${id.slice(2)}`],
    sentence = `They said ${nonStandardForm} again.`,
  }: {
    correctionType?: CorrectionType;
    nonStandardForm?: string;
    standardEquivalents?: string[];
    sentence?: string;
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
    literaryUses: [],
    retired: false,
  };
}

/**
 * The 15 Corrections that play, one with an apostrophe in its standard form
 * and one whose sentence holds the form in other case, and a stress trap,
 * which never plays.
 */
const playing = [
  ...Array.from({ length: 13 }, (_, index) =>
    correction(`c_calque${String(index + 1).padStart(2, '0')}`),
  ),
  correction('c_surzhyk01', {
    correctionType: 'surzhyk',
    nonStandardForm: 'пірья',
    standardEquivalents: ['пірʼя'],
    sentence: 'Подушка з пірья.',
  }),
  correction('c_russian01', {
    correctionType: 'russianism',
    nonStandardForm: 'приймати міри',
    standardEquivalents: ['вживати заходів'],
    sentence: 'Місто Приймати Міри не поспішає.',
  }),
];

const stressTrap = correction('c_stress01', {
  correctionType: 'wrongStress',
  nonStandardForm: 'кві́тучий',
  standardEquivalents: ['квіту́чий'],
  sentence: 'Кві́тучий сад.',
});

const content = createMemoryContentPort({ corrections: [...playing, stressTrap] });

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
  correctionsInMix = true,
}: {
  seed?: number;
  off?: readonly string[];
  correctionsInMix?: boolean;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: [],
          correctionCategoryIds: 'all' as const,
          corrections: correctionsInMix,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: {
      now: () => new Date('2026-10-27T09:00:00+02:00'),
      timeZone: () => 'Europe/Kyiv',
    },
    random: seededRandom(seed),
  });
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

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

const typeWordOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'type-word');

/** The Correction the Round asks about, by its «people often say» sentence. */
function askedOf({ prompt }: Round): Correction {
  const asked = [...playing, stressTrap].find((c) => c.examplePair.nonStandard === prompt);
  if (asked === undefined) throw new Error(`No Correction says «${prompt}»`);
  return asked;
}

const standardOf = (asked: Correction) => asked.standardEquivalents[0] ?? '';

/** Starts «Впиши слово» and plays it to its end, always typing the standard form, keeping each answered Round. */
async function playGame(app: Composition): Promise<Round[]> {
  await app.game.start('type-word');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'typed', text: standardOf(askedOf(current(app).round)) });
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

/** Starts «Впиши слово» with seeds until its first Round asks about the Correction. */
async function startAt(id: string): Promise<Composition> {
  for (let seed = 1; seed < 200; seed += 1) {
    const app = await run({ seed });
    await app.game.start('type-word');
    if (askedOf(current(app).round).id === id) return app;
  }
  throw new Error(`No Game starts with «${id}»`);
}

describe('«Впиши слово» on offer', () => {
  it('is offered when the Edition turns the mode on', async () => {
    const app = await run();

    expect(typeWordOffer(app)).toEqual({
      modeId: 'type-word',
      entryKind: 'correction',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameTypeWord'] });

    expect(typeWordOffer(app)).toBeUndefined();
  });

  it('is off when the Edition turns Corrections off', async () => {
    const app = await run({ off: ['corrections'] });

    expect(typeWordOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 Corrections that play, a stress trap not counted", async () => {
    const app = await run();
    await app.hide({ kind: 'entry', entryId: 'c_calque01' });

    expect(typeWordOffer(app)).toEqual({
      modeId: 'type-word',
      entryKind: 'correction',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('type-word');

    expect(app.game.state.current).toBeUndefined();
  });

  it("can't start while Corrections are out of the Mix, says so, and can once they are back", async () => {
    const app = await run({ correctionsInMix: false });

    expect(typeWordOffer(app)).toEqual({
      modeId: 'type-word',
      entryKind: 'correction',
      canStart: false,
      refusal: 'corrections-out-of-mix',
    });

    await app.mix.setKind('correction', true);

    expect(typeWordOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('a Round of «Впиши слово»', () => {
  it("shows a Correction's sentence with its non-standard form marked, and takes the standard form typed", async () => {
    const app = await run();
    const rounds = await playGame(app);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    for (const round of rounds) {
      const asked = askedOf(round);
      const start = asked.examplePair.nonStandard
        .toLowerCase()
        .indexOf(asked.nonStandardForm.toLowerCase());
      expect(round).toMatchObject({
        form: 'typed',
        entryKind: 'correction',
        prompt: asked.examplePair.nonStandard,
        highlight: { start, end: start + asked.nonStandardForm.length },
        blanks: undefined,
        canOpenLetter: false,
      });
      expect(round.answer).toMatchObject({
        form: 'typed',
        expected: standardOf(asked),
        right: true,
      });
    }
    expect(current(app)).toMatchObject({ lives: 5, status: 'won' });
  });

  it('marks the non-standard form where the sentence holds it in other case', async () => {
    const app = await startAt('c_russian01');

    expect(current(app).round.highlight).toEqual({ start: 6, end: 19 });
  });

  it('never asks about a stress trap', async () => {
    const asked = new Set<string>();
    for (const seed of [1, 2, 3]) {
      for (const round of await playGame(await run({ seed }))) asked.add(askedOf(round).id);
    }

    expect(asked.has(stressTrap.id)).toBe(false);
    expect(asked.size).toBe(playing.length);
  });

  it('accepts the standard form in another case, with a Stress mark or another apostrophe', async () => {
    const app = await startAt('c_surzhyk01');

    await app.game.answer({ form: 'typed', text: ' ПІ́Р’Я ' });

    expect(current(app).round.answer).toMatchObject({ right: true });
    expect(current(app).lives).toBe(5);
  });

  it('costs a Life for a wrong form and shows the standard form with the explanation', async () => {
    const app = await startAt('c_surzhyk01');

    await app.game.answer({ form: 'typed', text: 'пірья' });

    expect(current(app).round.answer).toEqual({
      form: 'typed',
      typed: 'пірья',
      expected: 'пірʼя',
      right: false,
      sheet: {
        answer: { text: 'пірʼя', stressedVowels: [] },
        example: undefined,
        explanation: 'Why surzhyk01 reads better.',
      },
    });
    expect(current(app).lives).toBe(4);
  });

  it('marks the Correction of a wrong form «Не знаю», moves no Review and lists the text typed', async () => {
    const app = await startAt('c_surzhyk01');

    await app.game.answer({ form: 'typed', text: 'пірья' });

    expect(app.knowledge.state.shown.get('c_surzhyk01')).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)).toEqual([
      {
        number: 1,
        entryId: 'c_surzhyk01',
        title: { text: 'пірья', stressedVowels: [] },
        right: false,
        picked: { text: 'пірья', stressedVowels: [] },
        details: {
          kind: 'correction',
          standardForm: 'пірʼя',
          explanation: 'Why surzhyk01 reads better.',
        },
      },
    ]);
  });

  it('asks first about the Corrections the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['c_calque03', 'c_calque07', 'c_russian01'];
    for (const id of weak) await app.knowledge.tap(id, 'unknown');

    const rounds = await playGame(app);

    expect(
      rounds
        .slice(0, weak.length)
        .map((round) => askedOf(round).id)
        .sort(),
    ).toEqual([...weak].sort());
  });
});
