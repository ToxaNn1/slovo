import { describe, expect, it } from 'vitest';

import type { Idiom } from '@slovo/contracts';

import {
  buildGameReview,
  GAME_ROUNDS,
  openComposition,
  type Composition,
  type CurrentGame,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { idiom, seededRandom, testEdition } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/**
 * The pack's expressions that play, of 2 to 8 words: idioms and proverbs,
 * some with a comma or a dash, one with a hyphen inside a word, some with
 * equal words and one with the same word in two cases.
 */
const playingIdioms = [
  'бити байдики',
  'як дві краплі води',
  'ні се ні те',
  'раз у раз',
  'Око за око',
  'тяп-ляп і готово',
  'кров з молоком',
  'пекти раків',
  'точити ляси',
  'ловити ґав',
  'на всі заставки',
  'як з гуски вода',
] as const;

const playingProverbs = [
  'хто посіє впору, той матиме хліба гору',
  'не все те золото, що блищить',
  'Тиха вода — греблі рве',
  'бачили очі, що купували, тепер їжте, хоч повилазьте',
] as const;

const playing: readonly string[] = [...playingIdioms, ...playingProverbs];

/** The expressions that never play: of 1 word, of 9 words, a place name. */
const notPlaying = ['тю-тю', 'не так сталося, як гадалося, а як Бог дав', 'Біла Церква'] as const;

const ids = new Map(
  [...playing, ...notPlaying].map((expression, at) => [expression, `i_${String(at)}`]),
);

const idOf = (expression: string): string => {
  const id = ids.get(expression);
  if (id === undefined) throw new Error(`No Idiom «${expression}»`);
  return id;
};

const typeOf = (expression: string): Idiom['idiomType'] => {
  if (expression === 'Біла Церква') return 'placeName';
  const proverbs: readonly string[] = [...playingProverbs, notPlaying[1]];
  return proverbs.includes(expression) ? 'proverb' : 'idiom';
};

const idioms: Idiom[] = [...playing, ...notPlaying].map((expression) =>
  idiom(idOf(expression), {
    expression,
    idiomType: typeOf(expression),
    primaryDefinition: `The meaning of ${expression}.`,
    examples: [{ text: `An Example of ${expression}.` }],
    ...(typeOf(expression) === 'placeName' ? { etymology: 'A story.' } : {}),
  }),
);

const content = createMemoryContentPort({ idioms });

/** The expression a Round asks about, read from its meaning. */
function expressionOf({ prompt }: Round): string {
  const expression = /^The meaning of (.+)\.$/.exec(prompt)?.[1];
  if (expression === undefined || !playing.includes(expression)) {
    throw new Error(`No playing expression has the meaning «${prompt}»`);
  }
  return expression;
}

/** The words of an expression that are chips, in order: no comma, no dash. */
const wordsOf = (expression: string): string[] =>
  expression
    .split(' ')
    .map((word) => word.replaceAll(/[,—]/g, ''))
    .filter((word) => word !== '');

const folded = (words: readonly string[]) => words.map((word) => word.toLowerCase());

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

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
  idiomsInMix = true,
}: { seed?: number; off?: readonly string[]; idiomsInMix?: boolean } = {}): Promise<Composition> {
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: { mix: { idioms: idiomsInMix } },
      languageTraits: { expressionPunctuation: [',', '—'] },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: {
      now: () => new Date('2026-10-26T09:00:00+02:00'),
      timeZone: () => 'Europe/Kyiv',
    },
    random: seededRandom(seed),
  });
  return offersPlanned(app);
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

function chipsOf(round: Round): readonly string[] {
  if (round.form !== 'chips') throw new Error(`A Round of the form ${round.form}`);
  return round.chips;
}

/**
 * The places of the chips that say the expression in order, case ignored;
 * of equal words, the last one shown first when `swapEqual`.
 */
function tapsFor(round: Round, swapEqual = false): number[] {
  const left = chipsOf(round).map((chip, place) => ({ chip, place }));
  if (swapEqual) left.reverse();
  return folded(wordsOf(expressionOf(round))).map((word) => {
    const at = left.findIndex(({ chip }) => chip.toLowerCase() === word);
    const [found] = left.splice(at, 1);
    if (found === undefined) throw new Error(`No chip «${word}» is left`);
    return found.place;
  });
}

const buildIdiomOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'build-idiom');

/** Starts «Склади вислів» and plays it to its end, every Round right, keeping each answered Round. */
async function playGame(app: Composition, swapEqual = false): Promise<Round[]> {
  await app.game.start('build-idiom');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'chips', chips: tapsFor(current(app).round, swapEqual) });
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

/** Every Round of one Game per seed, each answered right. */
async function roundsOf(seeds: readonly number[], swapEqual = false): Promise<Round[]> {
  const rounds: Round[] = [];
  for (const seed of seeds) rounds.push(...(await playGame(await run({ seed }), swapEqual)));
  return rounds;
}

describe('«Склади вислів» on offer', () => {
  it('is offered with its Feature Switch on', async () => {
    const app = await run();

    expect(buildIdiomOffer(app)).toEqual({
      modeId: 'build-idiom',
      entryKind: 'idiom',
      group: 'idioms',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off, or with Idioms off', async () => {
    expect(buildIdiomOffer(await run({ off: ['gameBuildIdiom'] }))).toBeUndefined();
    expect(buildIdiomOffer(await run({ off: ['idioms'] }))).toBeUndefined();
  });

  it("says it can't start with fewer than 15 expressions of 2–8 words", async () => {
    const app = await run();
    for (const expression of ['пекти раків', 'точити ляси']) {
      await app.hide({ kind: 'entry', entryId: idOf(expression) });
    }

    expect(buildIdiomOffer(app)).toEqual({
      modeId: 'build-idiom',
      entryKind: 'idiom',
      group: 'idioms',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('build-idiom');

    expect(app.game.state.current).toBeUndefined();
  });

  it("says it can't start with Idioms out of the Mix", async () => {
    const app = await run({ idiomsInMix: false });

    expect(buildIdiomOffer(app)).toEqual({
      modeId: 'build-idiom',
      entryKind: 'idiom',
      group: 'idioms',
      canStart: false,
      refusal: 'idioms-out-of-mix',
    });
  });
});

describe('a Round of «Склади вислів»', () => {
  it("shows the expression's meaning and its words as shuffled chips, the words in order right", async () => {
    const rounds = await roundsOf([1, 2, 3]);

    expect(rounds).toHaveLength(3 * GAME_ROUNDS);
    for (const round of rounds) {
      const words = wordsOf(expressionOf(round));
      expect(round).toMatchObject({ form: 'chips', highlight: undefined, fixed: [] });
      expect([...chipsOf(round)].sort()).toEqual([...words].sort());
      expect(folded(chipsOf(round))).not.toEqual(folded(words));
      expect(round.answer).toMatchObject({ form: 'chips', expected: words, right: true });
      expect(round.answer?.sheet).toEqual({
        answer: { text: expressionOf(round), stressedVowels: [] },
        example: { text: `An Example of ${expressionOf(round)}.` },
      });
    }
  });

  it('asks only about idioms and proverbs of 2–8 words, never a place name', async () => {
    const asked = new Set((await roundsOf([1, 2, 3, 4, 5, 6])).map(expressionOf));

    expect(asked).toEqual(new Set(playing));
  });

  it('drops a comma or a dash and keeps a hyphen inside a word', async () => {
    const rounds = await roundsOf([1, 2, 3]);
    const chipsOfExpression = (expression: string) => {
      const round = rounds.find((played) => expressionOf(played) === expression);
      if (round === undefined) throw new Error(`No Round asked about «${expression}»`);
      return [...chipsOf(round)].sort();
    };

    expect(chipsOfExpression('Тиха вода — греблі рве')).toEqual(
      ['Тиха', 'вода', 'греблі', 'рве'].sort(),
    );
    expect(chipsOfExpression('не все те золото, що блищить')).toEqual(
      ['не', 'все', 'те', 'золото', 'що', 'блищить'].sort(),
    );
    expect(chipsOfExpression('тяп-ляп і готово')).toEqual(['тяп-ляп', 'і', 'готово'].sort());
  });

  it('takes equal words in either order, case ignored', async () => {
    const rounds = (await roundsOf([1, 2, 3], true)).filter((round) =>
      ['ні се ні те', 'раз у раз', 'Око за око'].includes(expressionOf(round)),
    );

    expect(new Set(rounds.map(expressionOf))).toEqual(
      new Set(['ні се ні те', 'раз у раз', 'Око за око']),
    );
    for (const round of rounds) expect(round.answer).toMatchObject({ right: true });
  });

  it('costs a Life for words in the wrong order, marks the Idiom «Не знаю», moves no Review and lists the words tapped in the Game Review', async () => {
    const app = await run();
    await app.game.start('build-idiom');
    const asked = expressionOf(current(app).round);
    const taps = tapsFor(current(app).round);
    const wrong = [...taps.slice(1), ...taps.slice(0, 1)];

    await app.game.answer({ form: 'chips', chips: wrong });

    expect(current(app).round.answer).toMatchObject({ form: 'chips', chosen: wrong, right: false });
    expect(current(app).lives).toBe(4);
    expect(app.knowledge.state.shown.get(idOf(asked))).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    const tapped = wrong.map((place) => chipsOf(current(app).round)[place]).join(' ');
    expect(buildGameReview(current(app).played)[0]).toMatchObject({
      entryId: idOf(asked),
      title: { text: asked },
      right: false,
      picked: { text: tapped },
    });
  });

  it('leaves the Knowledge Marks as they were after right answers', async () => {
    const app = await run();

    await playGame(app);

    expect(app.knowledge.state.shown.size).toBe(0);
  });

  it('asks first about the expressions the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['пекти раків', 'Око за око', 'не все те золото, що блищить'];
    for (const expression of weak) await app.knowledge.tap(idOf(expression), 'unknown');

    const rounds = await playGame(app);

    expect(rounds.slice(0, weak.length).map(expressionOf).sort()).toEqual([...weak].sort());
  });
});
