import { describe, expect, it } from 'vitest';

import type { Correction, CorrectionType } from '@slovo/contracts';

import {
  buildGameReview,
  GAME_ROUNDS,
  openComposition,
  type Composition,
  type CurrentGame,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { optionsOf, seededRandom, testEdition } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

function correction(id: string, correctionType: CorrectionType): Correction {
  const name = id.slice(2);
  return {
    kind: 'correction',
    id,
    nonStandardForm: `bad ${name}`,
    correctionType,
    standardEquivalents: [`good ${name}`],
    explanation: `Why ${name} reads better.`,
    examplePair: { nonStandard: `They said bad ${name} again.`, standard: `They said ${name}.` },
    categoryId: 'everyday',
    sources: [{ title: 'Test source' }],
    literaryUses: [],
    retired: false,
  };
}

/** The 15 anglicisms, just enough for a Game. */
const anglicisms = Array.from({ length: GAME_ROUNDS }, (_, index) =>
  correction(`c_anglicism${String(index + 1).padStart(2, '0')}`, 'anglicism'),
);

/** Corrections of other Correction Types, which the mode never asks about nor offers. */
const others = [
  ...Array.from({ length: 10 }, (_, index) => correction(`c_calque${String(index + 1)}`, 'calque')),
  correction('c_surzhyk1', 'surzhyk'),
];

const corrections = [...anglicisms, ...others];

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
    content: createMemoryContentPort({ corrections }),
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: { mix: { categoryIds: [], corrections: correctionsInMix } },
    }),
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

const anglicismOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'anglicism');

/** The Correction the Round asks about, by its «people often say» sentence. */
function askedOf({ prompt }: Round): Correction {
  const asked = corrections.find((c) => c.examplePair.nonStandard === prompt);
  if (asked === undefined) throw new Error(`No Correction says «${prompt}»`);
  return asked;
}

const rightOf = (round: Round) =>
  optionsOf(round).findIndex(({ text }) => text === askedOf(round).standardEquivalents[0]);

/** Starts «Англіцизми» and plays it to its end, always right, keeping each answered Round. */
async function playGame(app: Composition): Promise<Round[]> {
  await app.game.start('anglicism');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'pick', option: rightOf(current(app).round) });
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

describe('«Англіцизми» on offer', () => {
  it('is offered when the Edition turns the mode on', async () => {
    const app = await run();

    expect(anglicismOffer(app)).toEqual({
      modeId: 'anglicism',
      entryKind: 'correction',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameAnglicism'] });

    expect(anglicismOffer(app)).toBeUndefined();
  });

  it('is off when the Edition turns Corrections off', async () => {
    const app = await run({ off: ['corrections'] });

    expect(anglicismOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 anglicisms, other Corrections not counted", async () => {
    const app = await run();
    await app.hide({ kind: 'entry', entryId: 'c_anglicism01' });

    expect(anglicismOffer(app)).toEqual({
      modeId: 'anglicism',
      entryKind: 'correction',
      canStart: false,
      refusal: 'too-few-entries',
    });
    expect(app.game.state.modes.find(({ modeId }) => modeId === 'correction')).toMatchObject({
      canStart: true,
    });

    await app.game.start('anglicism');

    expect(app.game.state.current).toBeUndefined();
  });

  it("can't start while Corrections are out of the Mix, says so, and can once they are back", async () => {
    const app = await run({ correctionsInMix: false });

    expect(anglicismOffer(app)).toEqual({
      modeId: 'anglicism',
      entryKind: 'correction',
      canStart: false,
      refusal: 'corrections-out-of-mix',
    });

    await app.mix.setKind('correction', true);

    expect(anglicismOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('a Round of «Англіцизми»', () => {
  it('asks about every anglicism once, with only anglicisms as options', async () => {
    const standards = new Set(anglicisms.map(({ standardEquivalents }) => standardEquivalents[0]));
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });
      const rounds = await playGame(app);

      expect(rounds).toHaveLength(GAME_ROUNDS);
      expect(new Set(rounds.map((round) => askedOf(round).id))).toEqual(
        new Set(anglicisms.map(({ id }) => id)),
      );
      for (const round of rounds) {
        const asked = askedOf(round);
        expect(round).toMatchObject({
          form: 'pick',
          entryKind: 'correction',
          prompt: asked.examplePair.nonStandard,
          highlight: { start: 10, end: 10 + asked.nonStandardForm.length },
        });
        expect(optionsOf(round)).toHaveLength(4);
        for (const { text } of optionsOf(round)) expect(standards.has(text)).toBe(true);
      }
      expect(current(app)).toMatchObject({ lives: 5, status: 'won' });
    }
  });

  it('marks the anglicism of a wrong pick «Не знаю», moves no Review and shows the explanation', async () => {
    const app = await run();
    await app.game.start('anglicism');
    const { round } = current(app);
    const asked = askedOf(round);

    await app.game.answer({ form: 'pick', option: (rightOf(round) + 1) % optionsOf(round).length });

    expect(current(app).lives).toBe(4);
    expect(current(app).round.answer).toMatchObject({
      right: false,
      sheet: {
        answer: { text: asked.standardEquivalents[0], stressedVowels: [] },
        explanation: asked.explanation,
      },
    });
    expect(app.knowledge.state.shown.get(asked.id)).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)).toMatchObject([
      { number: 1, entryId: asked.id, right: false },
    ]);
  });

  it('asks first about the anglicisms the reader marked «Не знаю», never about other weak Corrections', async () => {
    const app = await run();
    const weak = ['c_anglicism03', 'c_anglicism07', 'c_anglicism12'];
    for (const id of [...weak, 'c_calque1', 'c_surzhyk1']) await app.knowledge.tap(id, 'unknown');

    const rounds = await playGame(app);

    expect(
      rounds
        .slice(0, weak.length)
        .map((round) => askedOf(round).id)
        .sort(),
    ).toEqual(weak);
  });
});
