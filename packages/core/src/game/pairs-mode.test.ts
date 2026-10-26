import { describe, expect, it } from 'vitest';

import type { Category, Word } from '@slovo/contracts';

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
import { seededRandom, word } from '../test-support';

const test: Category = { id: 'test', displayName: 'Test' };
const crafts: Category = { id: 'crafts', displayName: 'Crafts' };

const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);

/**
 * The pack: 13 nouns in Test, among them two homonyms «коса» and «вирій»,
 * whose primary Definition is the one of `w_n01`, and 6 verbs in Crafts. No
 * Word carries Stress, so each shows as its Lemma.
 */
const words: Word[] = [
  ...numbered('w_n', 10).map((id) => word(id, { stress: [] })),
  word('w_коса1', { lemma: 'коса', stress: [], primaryDefinition: 'A braid.' }),
  word('w_коса2', { lemma: 'коса', stress: [], primaryDefinition: 'A scythe.' }),
  word('w_вирій', { stress: [], primaryDefinition: 'The meaning of n01.' }),
  ...numbered('w_v', 6).map((id) =>
    word(id, { stress: [], partOfSpeech: 'verb', categoryId: 'crafts' }),
  ),
];

const content = createMemoryContentPort({ categories: [test, crafts], words });

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
}: { seed?: number; off?: readonly string[] } = {}): Promise<Composition> {
  const app = await openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: ['test', 'crafts'],
          correctionCategoryIds: 'all' as const,
          corrections: true,
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
      now: () => new Date('2026-10-26T09:00:00+02:00'),
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

const pairsOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'pairs');

type Grid = Extract<Round, { form: 'pairs' }>;

function gridOf(round: Round): Grid {
  if (round.form !== 'pairs') throw new Error(`A «${round.form}» Round is no pairs grid`);
  return round;
}

/** The Words a grid's Word may be: one, or a homonym, which never meets the other in a grid. */
const wordsShownAs = (text: string) => words.filter(({ lemma }) => lemma === text);

/** The place of the Definition among the grid's that belongs to its Word at `place`. */
function rightDefinition(grid: Grid, place: number): number {
  const text = grid.words[place]?.shown.text ?? '';
  const definitions = new Set(wordsShownAs(text).map(({ primaryDefinition }) => primaryDefinition));
  const right = grid.definitions.findIndex(({ shown }) => definitions.has(shown));
  if (right === -1) throw new Error(`The grid has no Definition of «${text}»`);
  return right;
}

/** The first Word of the grid not gone. */
const firstLeft = (grid: Grid) => grid.words.findIndex(({ gone }) => !gone);

/** Starts «Пари» and matches every pair right, keeping the grid of each Round as it was shown. */
async function playGame(app: Composition): Promise<Grid[]> {
  await app.game.start('pairs');
  const grids: Grid[] = [];
  while (current(app).status === 'playing') {
    const grid = gridOf(current(app).round);
    grids.push(grid);
    const word = firstLeft(grid);
    await app.game.answer({ form: 'pairs', word, definition: rightDefinition(grid, word) });
    if (current(app).round.answer?.right !== true) throw new Error('The pair was not right');
    if (current(app).status === 'answered') await app.game.next();
  }
  return grids;
}

/** The grids of a Game, one per first Round of each, as it was first shown. */
const gridsOf = (shown: readonly Grid[]) =>
  shown.filter((grid) => grid.words.every(({ gone }) => !gone));

describe('«Пари» on offer', () => {
  it('is offered with its Feature Switch on', async () => {
    const app = await run();

    expect(pairsOffer(app)).toEqual({ modeId: 'pairs', entryKind: 'word', canStart: true });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gamePairs'] });

    expect(pairsOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 Words", async () => {
    const app = await run();
    for (const id of ['w_n01', 'w_n02', 'w_n03', 'w_n04', 'w_n05']) {
      await app.hide({ kind: 'entry', entryId: id });
    }

    expect(pairsOffer(app)).toEqual({
      modeId: 'pairs',
      entryKind: 'word',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('pairs');

    expect(app.game.state.current).toBeUndefined();
  });

  it("says it can't start with a Category of its Words out of the Mix, and can once it is back", async () => {
    const app = await run();
    await app.mix.takeOut('crafts');

    expect(pairsOffer(app)).toMatchObject({ canStart: false, refusal: 'too-few-entries' });

    await app.mix.putBack('crafts');

    expect(pairsOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('the grids of «Пари»', () => {
  it('asks 15 pairs over four grids of 4, 4, 4 and 3, each Word with its own Definition', async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const app = await run({ seed });
      const shown = await playGame(app);

      expect(shown).toHaveLength(GAME_ROUNDS);
      expect(current(app)).toMatchObject({ status: 'won', roundsPassed: GAME_ROUNDS });
      const grids = gridsOf(shown);
      expect(grids.map((grid) => grid.words.length)).toEqual([4, 4, 4, 3]);
      for (const grid of grids) {
        expect(grid.definitions).toHaveLength(grid.words.length);
        const texts = grid.words.map(({ shown: { text } }) => text);
        expect(new Set(texts).size).toBe(texts.length);
        const places = texts.map((_, place) => rightDefinition(grid, place));
        expect(new Set(places).size).toBe(texts.length);
      }
    }
  });

  it('takes a right pair out of the grid and keeps the others', async () => {
    const app = await run();
    await app.game.start('pairs');
    const grid = gridOf(current(app).round);
    const definition = rightDefinition(grid, 2);

    await app.game.answer({ form: 'pairs', word: 2, definition });
    await app.game.next();

    const after = gridOf(current(app).round);
    expect(after.words.map(({ gone }) => gone)).toEqual([false, false, true, false]);
    expect(after.definitions.filter(({ gone }) => gone)).toEqual([
      { shown: grid.definitions[definition]?.shown, gone: true },
    ]);
    expect(after.words.map(({ shown }) => shown)).toEqual(grid.words.map(({ shown }) => shown));
  });

  it('fills a grid with Words of one part of speech, by the Distractor rule', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const app = await run({ seed });
      await app.game.start('pairs');
      const grid = gridOf(current(app).round);

      const kinds = grid.words.map(({ shown: { text } }) => wordsShownAs(text)[0]?.partOfSpeech);
      expect(new Set(kinds).size).toBe(1);
    }
  });

  it('costs a Life for a wrong pair, marks «Не знаю» the Word tapped, not the one of the Definition, and lists it in the Game Review', async () => {
    const app = await run();
    await app.game.start('pairs');
    const grid = gridOf(current(app).round);
    const right = rightDefinition(grid, 0);
    const wrong = right === 0 ? 1 : 0;
    const other = grid.words.findIndex((_, place) => rightDefinition(grid, place) === wrong);

    await app.game.answer({ form: 'pairs', word: 0, definition: wrong });

    const game = current(app);
    expect(game.round.answer).toMatchObject({
      form: 'pairs',
      word: 0,
      correct: right,
      right: false,
    });
    expect(game.lives).toBe(4);
    const tapped = game.played[0]?.entry.id ?? '';
    expect(wordsShownAs(grid.words[0]?.shown.text ?? '').map(({ id }) => id)).toContain(tapped);
    expect(app.knowledge.state.shown.get(tapped)).toBe('unknown');
    for (const { id } of wordsShownAs(grid.words[other]?.shown.text ?? '')) {
      expect(app.knowledge.state.shown.get(id)).toBeUndefined();
    }
    expect(buildGameReview(game.played)).toEqual([
      expect.objectContaining({ entryId: tapped, right: false }),
    ]);
  });

  it('puts the Words the reader marked «Не знаю» in the first grid', async () => {
    const weak = ['w_n03', 'w_n07', 'w_n09'];
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });
      for (const id of weak) await app.knowledge.tap(id, 'unknown');

      await app.game.start('pairs');
      const texts = gridOf(current(app).round).words.map(({ shown: { text } }) => text);

      expect(texts).toEqual(expect.arrayContaining(weak.map((id) => id.slice(2))));
    }
  });
});
