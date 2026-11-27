import { describe, expect, it } from 'vitest';

import type { Category, Word } from '@slovo/contracts';

import {
  buildGameReview,
  GAME_ROUNDS,
  openComposition,
  type Composition,
  type CurrentGame,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const test: Category = { id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' };
const crafts: Category = {
  id: 'crafts',
  displayName: 'Crafts',
  description: 'Crafts.',
  tone: 'loud',
};

const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);

/**
 * The pack: 13 nouns in Test, among them two homonyms «коса» and «вирій»,
 * whose primary Definition is the one of `w_n01`, and 6 verbs in Crafts. No
 * Word carries Stress, so each shows as its Lemma. «n02» lists «n03» as a
 * synonym, and «n05» has the Definition of «n04» as an extra one.
 */
const words: Word[] = [
  ...numbered('w_n', 10).map((id) =>
    word(id, {
      stress: [],
      synonyms: id === 'w_n02' ? ['n03'] : [],
      extraDefinitions: id === 'w_n05' ? ['The meaning of n04.'] : [],
    }),
  ),
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
  pack = content,
}: {
  seed?: number;
  off?: readonly string[];
  pack?: typeof content;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content: pack,
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: { mix: { categoryIds: ['test', 'crafts'] } },
    }),
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

/** The first Word of the grid still open. */
const firstLeft = (grid: Grid) => grid.words.findIndex(({ state }) => state === 'open');

/** Starts «Пари» and matches every pair right, keeping the grid of each Round as it was shown. */
async function playGame(app: Composition): Promise<Grid[]> {
  await app.game.start('pairs');
  const grids: Grid[] = [];
  while (current(app).status === 'playing') {
    const grid = gridOf(current(app).round);
    grids.push(grid);
    const word = firstLeft(grid);
    await app.game.answer({ form: 'pairs', word, definition: rightDefinition(grid, word) });
    if (current(app).played.at(-1)?.right !== true) throw new Error('The pair was not right');
    await app.game.next();
  }
  return grids;
}

/** The grids of a Game, one per first Round of each, as it was first shown. */
const gridsOf = (shown: readonly Grid[]) =>
  shown.filter((grid) => grid.words.every(({ state }) => state === 'open'));

describe('«Пари» on offer', () => {
  it('is offered with its Feature Switch on', async () => {
    const app = await run();

    expect(pairsOffer(app)).toEqual({
      modeId: 'pairs',
      entryKind: 'word',
      group: 'meaning',
      canStart: true,
    });
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
      group: 'meaning',
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
        // A grid has no question of its own to show.
        expect(grid.prompt).toBe('');
        expect(grid.definitions).toHaveLength(grid.words.length);
        const texts = grid.words.map(({ shown: { text } }) => text);
        expect(new Set(texts).size).toBe(texts.length);
        const places = texts.map((_, place) => rightDefinition(grid, place));
        expect(new Set(places).size).toBe(texts.length);
      }
    }
  });

  it('marks a right pair found in the grid and keeps the others', async () => {
    const app = await run();
    await app.game.start('pairs');
    const grid = gridOf(current(app).round);
    const definition = rightDefinition(grid, 2);

    await app.game.answer({ form: 'pairs', word: 2, definition });
    await app.game.next();

    const after = gridOf(current(app).round);
    expect(after.words.map(({ state }) => state)).toEqual(['open', 'open', 'found', 'open']);
    expect(after.definitions.filter(({ state }) => state !== 'open')).toEqual([
      { shown: grid.definitions[definition]?.shown, state: 'found' },
    ]);
    expect(after.words.map(({ shown }) => shown)).toEqual(grid.words.map(({ shown }) => shown));
  });

  it('waits for «Далі» after a pair', async () => {
    const app = await run();
    await app.game.start('pairs');
    const grid = gridOf(current(app).round);

    await app.game.answer({ form: 'pairs', word: 0, definition: rightDefinition(grid, 0) });

    expect(current(app)).toMatchObject({ status: 'answered' });
  });

  it('fills a grid with Words of one part of speech', async () => {
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
    expect(game.played[0]?.answer).toMatchObject({
      form: 'pairs',
      word: 0,
      correct: right,
      right: false,
    });
    expect(game.lives).toBe(2);
    const tapped = game.played[0]?.entry.id ?? '';
    expect(wordsShownAs(grid.words[0]?.shown.text ?? '').map(({ id }) => id)).toContain(tapped);
    expect(app.knowledge.state.shown.get(tapped)).toBe('unknown');
    for (const { id } of wordsShownAs(grid.words[other]?.shown.text ?? '')) {
      expect(app.knowledge.state.shown.get(id)).toBeUndefined();
    }
    expect(buildGameReview(game.played)).toEqual([expect.objectContaining({ right: false })]);
  });

  it('gives each pair its own row of the Game Review, ✓ or ✗ and the Word tapped', async () => {
    const app = await run();
    await app.game.start('pairs');
    const grid = gridOf(current(app).round);
    const right = rightDefinition(grid, 1);

    await app.game.answer({ form: 'pairs', word: 1, definition: right });
    await app.game.next();
    const taken = [right, rightDefinition(grid, 0)];
    const wrong = [0, 1, 2, 3].find((place) => !taken.includes(place)) ?? -1;
    await app.game.answer({ form: 'pairs', word: 0, definition: wrong });

    const rows = buildGameReview(current(app).played);
    expect(rows.map(({ number, right: rightRow, word }) => [number, rightRow, word.text])).toEqual([
      [1, true, grid.words[1]?.shown.text],
      [2, false, grid.words[0]?.shown.text],
    ]);
  });

  // The weak Entries take places drawn at random among the first 15 Rounds.
  it('never puts in one grid two Words of which one fits the Definition of the other: synonyms, or an extra Definition', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const grids = gridsOf(await playGame(await run({ seed })));

      for (const grid of grids) {
        const texts = grid.words.map(({ shown: { text } }) => text);
        expect(['n02', 'n03'].filter((lemma) => texts.includes(lemma)).length).toBeLessThan(2);
        expect(['n04', 'n05'].filter((lemma) => texts.includes(lemma)).length).toBeLessThan(2);
      }
    }
  });

  it('puts the Words the reader marked «Не знаю» in grids drawn anew for each Game, not always the first', async () => {
    const weak = ['w_n03', 'w_n07', 'w_n09'];
    const places: number[] = [];
    for (const seed of [1, 2, 3, 4]) {
      const app = await run({ seed });
      for (const id of weak) await app.knowledge.tap(id, 'unknown');

      const shown = (await playGame(app)).map((grid) =>
        grid.words.map(({ shown: { text } }) => text),
      );

      places.push(...weak.map((id) => shown.findIndex((texts) => texts.includes(id.slice(2)))));
    }

    expect(places.every((place) => place >= 0)).toBe(true);
    expect(places.some((place) => place >= 4)).toBe(true);
  });

  it('keeps the primary Definition of a Word that has a Short Definition (ADR 0210)', async () => {
    const short = words.map((entry) => ({
      ...entry,
      shortDefinition: `${entry.lemma}, in short.`,
    }));
    const pack = createMemoryContentPort({ categories: [test, crafts], words: short });

    const grids = gridsOf(await playGame(await run({ pack })));

    expect(grids).toHaveLength(4);
    const primary = new Set(words.map(({ primaryDefinition }) => primaryDefinition));
    for (const { definitions } of grids) {
      for (const { shown } of definitions) expect(primary).toContain(shown);
    }
  });
});
