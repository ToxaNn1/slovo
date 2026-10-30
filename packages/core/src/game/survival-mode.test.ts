import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

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
import { correction, optionsOf, seededRandom, testEdition, word } from '../test-support';

/** A Word with an Example that holds its Lemma, which «Вгадай слово» would ask with a gap in Rounds 6–10. */
const wordOf = (index: number): Word => {
  const lemma = `word${String(index).padStart(2, '0')}`;
  return word(`w_${lemma}`, { examples: [{ text: `They said ${lemma} here.` }] });
};

const correctionOf = (index: number): Correction => {
  const name = `fix${String(index).padStart(2, '0')}`;
  return correction(`c_${name}`, {
    standardEquivalents: [`good ${name}`],
    examplePair: { nonStandard: `They said bad ${name} again.`, standard: `They said ${name}.` },
    nonStandardForm: `bad ${name}`,
  });
};

/** More Words than Corrections, so a Game that mixes them half each doesn't draw them as they come. */
const allWords = Array.from({ length: 24 }, (_, index) => wordOf(index + 1));
const allCorrections = Array.from({ length: 8 }, (_, index) => correctionOf(index + 1));

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
  correctionsInMix = true,
  words = allWords,
  corrections = allCorrections,
}: {
  seed?: number;
  off?: readonly string[];
  correctionsInMix?: boolean;
  words?: readonly Word[];
  corrections?: readonly Correction[];
} = {}): Promise<Composition> {
  const app = await openComposition({
    content: createMemoryContentPort({ words: [...words], corrections: [...corrections] }),
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: { mix: { corrections: correctionsInMix } },
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

const survivalOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'survival');

/** The Entry the Round asks about, by its Definition or its «people often say» sentence. */
function askedOf({ prompt }: Round): Word | Correction {
  const asked =
    allWords.find((each) => each.primaryDefinition === prompt) ??
    allCorrections.find((each) => each.examplePair.nonStandard === prompt);
  if (asked === undefined) throw new Error(`No Entry asks «${prompt}»`);
  return asked;
}

function rightOf(round: Round): number {
  const asked = askedOf(round);
  const right = asked.kind === 'word' ? asked.lemma : asked.standardEquivalents[0];
  // A Word's option carries its Stress mark.
  return optionsOf(round).findIndex(({ text }) => text.replace('\u0301', '') === right);
}

const wrongOf = (round: Round) => (rightOf(round) + 1) % optionsOf(round).length;

/**
 * Plays the Game in play: each Round right, but those whose number is among
 * `wrong`, until it ends or `rounds` Rounds are answered. Returns each Round answered.
 */
async function play(
  app: Composition,
  { rounds = Infinity, wrong = [] }: { rounds?: number; wrong?: readonly number[] } = {},
): Promise<Round[]> {
  const answered: Round[] = [];
  while (current(app).status === 'playing' && answered.length < rounds) {
    const { round } = current(app);
    const option = wrong.includes(round.number) ? wrongOf(round) : rightOf(round);
    await app.game.answer({ form: 'pick', option });
    if (current(app).round.answer === undefined)
      throw new Error(`Round ${String(round.number)} took no answer`);
    answered.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return answered;
}

describe('«Виживання» on offer', () => {
  it('is offered when the Edition turns the mode on', async () => {
    const app = await run();

    expect(survivalOffer(app)).toEqual({
      modeId: 'survival',
      entryKind: 'correction',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameSurvival'] });

    expect(survivalOffer(app)).toBeUndefined();
  });

  it('is off when the Edition turns Corrections off, since it mixes Words and Corrections', async () => {
    const app = await run({ off: ['corrections'] });

    expect(survivalOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 eligible Words and Corrections", async () => {
    const app = await run({
      words: allWords.slice(0, 10),
      corrections: allCorrections.slice(0, 4),
    });

    expect(survivalOffer(app)).toEqual({
      modeId: 'survival',
      entryKind: 'correction',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('survival');

    expect(app.game.state.current).toBeUndefined();
  });

  it("can't start while Corrections are out of the Mix, says so, and can once they are back", async () => {
    const app = await run({ correctionsInMix: false });

    expect(survivalOffer(app)).toEqual({
      modeId: 'survival',
      entryKind: 'correction',
      canStart: false,
      refusal: 'corrections-out-of-mix',
    });

    await app.mix.setKind('correction', true);

    expect(survivalOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('a Game of «Виживання»', () => {
  it('starts with 3 Lives and ends on the third mistake', async () => {
    const app = await run();
    await app.game.start('survival');

    expect(current(app)).toMatchObject({ lives: 3, livesAtStart: 3, status: 'playing' });
    expect(current(app).roundLimit).toBeUndefined();

    const rounds = await play(app, { wrong: [2, 5, 9] });

    expect(rounds).toHaveLength(9);
    expect(current(app)).toMatchObject({ lives: 0, roundsPassed: 8, status: 'lost' });
  });

  it('mixes Words and Corrections about half each, every Word a Definition pick', async () => {
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });
      await app.game.start('survival');

      const rounds = await play(app, { rounds: GAME_ROUNDS });

      const words = rounds.filter((round) => round.entryKind === 'word');
      expect(words.length).toBeGreaterThanOrEqual(7);
      expect(words.length).toBeLessThanOrEqual(8);
      for (const round of rounds) {
        // A Word's Round shows its Definition, a Correction's its «people often say» sentence.
        expect(askedOf(round).kind).toBe(round.entryKind);
        expect(round.form).toBe('pick');
        expect(optionsOf(round)).toHaveLength(4);
      }
      for (const round of words) expect(round.highlight).toBeUndefined();
    }
  });

  it('has no Round limit: once it has asked about every eligible Entry, it asks them again, reshuffled', async () => {
    const eligible = allWords.length + allCorrections.length;
    const app = await run();
    await app.game.start('survival');

    const rounds = await play(app, { rounds: eligible + GAME_ROUNDS });

    expect(rounds).toHaveLength(eligible + GAME_ROUNDS);
    expect(current(app)).toMatchObject({ lives: 3, status: 'playing' });
    const ids = rounds.map((round) => askedOf(round).id);
    expect(new Set(ids.slice(0, eligible)).size).toBe(eligible);
    expect(ids.slice(eligible)).not.toEqual(ids.slice(0, GAME_ROUNDS));
  });

  it('asks first about the Words and Corrections the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['c_fix03', 'w_word07', 'w_word19'];
    for (const id of weak) await app.knowledge.tap(id, 'unknown');
    await app.game.start('survival');

    const rounds = await play(app, { rounds: weak.length });

    expect(rounds.map((round) => askedOf(round).id).sort()).toEqual(weak);
  });

  it('marks the Entry of a wrong pick «Не знаю», moves no Review and lists it in the Game Review', async () => {
    const app = await run();
    await app.game.start('survival');
    const { round } = current(app);
    const asked = askedOf(round);

    await app.game.answer({ form: 'pick', option: wrongOf(round) });

    expect(current(app).lives).toBe(2);
    expect(app.knowledge.state.shown.get(asked.id)).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)).toMatchObject([
      { number: 1, entryId: asked.id, right: false },
    ]);
  });

  it('keeps the Rounds passed as its Best result, with no upper bound', async () => {
    const app = await run();
    await app.game.start('survival');
    await play(app, { wrong: [1, 18, 20] });

    expect(app.game.state.bestResults['survival']).toBe(19);
    expect(survivalOffer(app)).toEqual({
      modeId: 'survival',
      entryKind: 'correction',
      best: { result: 19 },
      canStart: true,
    });

    await app.game.start('survival');
    await play(app, { wrong: [1, 2, 3] });

    expect(app.game.state.bestResults['survival']).toBe(19);
  });
});
