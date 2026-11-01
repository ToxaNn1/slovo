import { describe, expect, it } from 'vitest';

import type { Category, Word } from '@slovo/contracts';

import {
  buildGameReview,
  GAME_ROUNDS,
  openComposition,
  type Composition,
  type ContentReadPort,
  type CurrentGame,
  type Round,
  type RoundBlank,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const test: Category = { id: 'test', displayName: 'Test' };
const crafts: Category = { id: 'crafts', displayName: 'Crafts' };

/**
 * The 16 Words that play, one with an apostrophe and one with a hyphen, the
 * last two in Crafts, and «буйна голова», whose space never plays.
 */
const playing = [
  'каганець',
  'веремія',
  'вирій',
  'оброк',
  'верес',
  'кобза',
  'ослін',
  'бекеш',
  'пугач',
  'хоругва',
  'кирея',
  'жупан',
  'опічок',
  'пірʼя',
  'будь-що',
  'ринва',
];

const idOf = (lemma: string) => `w_${lemma}`;

const words: Word[] = [
  ...playing.map((lemma, place) =>
    word(idOf(lemma), {
      lemma,
      stress: [1],
      categoryId: place >= playing.length - 2 ? 'crafts' : 'test',
    }),
  ),
  word(idOf('буйна голова'), { lemma: 'буйна голова', stress: [1] }),
];

const content = createMemoryContentPort({ categories: [test, crafts], words });

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
  words = content,
}: { seed?: number; off?: readonly string[]; words?: ContentReadPort } = {}): Promise<Composition> {
  const app = await openComposition({
    content: words,
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

/** The blanks of the current Round, which must be typed. */
function blanksOf(app: Composition): readonly RoundBlank[] | undefined {
  const { round } = current(app);
  if (round.form !== 'typed') throw new Error(`The Round is a ${round.form} Round`);
  return round.blanks;
}

const byLettersOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'by-letters');

/** The blanks of a Word, each character a blank but those that stay in place, which are marks. */
const blanksIn = (lemma: string): RoundBlank[] =>
  Array.from(lemma, (character): RoundBlank =>
    /['ʼ-]/.test(character) ? { mark: character } : {},
  );

/** The Word the Round asks about, by its Definition. */
function lemmaOf({ prompt }: Round): string {
  const asked = playing.find((lemma) => `The meaning of ${lemma}.` === prompt);
  if (asked === undefined) throw new Error(`No playing Word has the Definition «${prompt}»`);
  return asked;
}

/** Starts «За буквами» and plays it to its end, typing what `type` makes of each Word, keeping each answered Round. */
async function playGame(
  app: Composition,
  type: (lemma: string) => string = (lemma) => lemma,
): Promise<Round[]> {
  await app.game.start('by-letters');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'typed', text: type(lemmaOf(current(app).round)) });
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

/** Starts «За буквами» with seeds until its first Round asks about the Word. */
async function startAt(lemma: string): Promise<Composition> {
  for (let seed = 1; seed < 200; seed += 1) {
    const app = await run({ seed });
    await app.game.start('by-letters');
    if (lemmaOf(current(app).round) === lemma) return app;
  }
  throw new Error(`No Game starts with «${lemma}»`);
}

describe('«За буквами» on offer', () => {
  it('is offered when the Edition turns the mode on', async () => {
    const app = await run();

    expect(byLettersOffer(app)).toEqual({
      modeId: 'by-letters',
      entryKind: 'word',
      group: 'words',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameByLetters'] });

    expect(byLettersOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 Words without a space", async () => {
    const app = await run();
    await app.hide({ kind: 'entry', entryId: idOf('каганець') });
    await app.hide({ kind: 'entry', entryId: idOf('веремія') });

    expect(byLettersOffer(app)).toEqual({
      modeId: 'by-letters',
      entryKind: 'word',
      group: 'words',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('by-letters');

    expect(app.game.state.current).toBeUndefined();
  });

  it("says it can't start with a Category of its Words out of the Mix, and can once it is back", async () => {
    const app = await run();
    await app.mix.takeOut('crafts');

    expect(byLettersOffer(app)).toMatchObject({ canStart: false, refusal: 'too-few-entries' });

    await app.mix.putBack('crafts');

    expect(byLettersOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('a Round of «За буквами»', () => {
  it('shows the primary Definition and a blank for each letter, and takes the Word typed', async () => {
    const app = await run();
    const rounds = await playGame(app);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    for (const round of rounds) {
      const lemma = lemmaOf(round);
      expect(round).toMatchObject({
        form: 'typed',
        prompt: `The meaning of ${lemma}.`,
        blanks: blanksIn(lemma),
      });
      expect(round.answer).toMatchObject({ form: 'typed', expected: lemma, right: true });
    }
    expect(current(app)).toMatchObject({ lives: 5, status: 'won' });
  });

  it('keeps an apostrophe and a hyphen in place, never a blank', async () => {
    expect((await startAt('пірʼя')).game.state.current?.round).toMatchObject({
      blanks: [{}, {}, {}, { mark: 'ʼ' }, {}],
    });
    expect((await startAt('будь-що')).game.state.current?.round).toMatchObject({
      blanks: [{}, {}, {}, {}, { mark: '-' }, {}, {}],
    });
  });

  it('draws an apostrophe of any kind and a hyphen as a mark in place, never a letter', async () => {
    const marked = ["п'ять", 'м’ята', 'пірʼя', 'будь-що'];
    const lemmas = [...playing.slice(0, GAME_ROUNDS - marked.length), ...marked];
    const app = await run({
      words: createMemoryContentPort({
        categories: [test],
        words: lemmas.map((lemma) => word(idOf(lemma), { lemma, stress: [1], categoryId: 'test' })),
      }),
    });
    await app.game.start('by-letters');
    const blanks = new Map<string, readonly RoundBlank[] | undefined>();
    while (current(app).status === 'playing') {
      const { round } = current(app);
      const lemma = lemmas.find((asked) => `The meaning of ${asked}.` === round.prompt) ?? '';
      blanks.set(lemma, round.form === 'typed' ? round.blanks : undefined);
      await app.game.answer({ form: 'typed', text: lemma });
      await app.game.next();
    }

    expect(Object.fromEntries(marked.map((lemma) => [lemma, blanks.get(lemma)]))).toEqual({
      "п'ять": [{}, { mark: "'" }, {}, {}, {}],
      'м’ята': [{}, { mark: '’' }, {}, {}, {}],
      пірʼя: [{}, {}, {}, { mark: 'ʼ' }, {}],
      'будь-що': [{}, {}, {}, {}, { mark: '-' }, {}, {}],
    });
    expect(blanks.get('кобза')).toEqual([{}, {}, {}, {}, {}]);
  });

  it('never asks about a Word with a space', async () => {
    const asked = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const round of await playGame(await run({ seed }))) asked.add(round.prompt);
    }

    expect(asked.has('The meaning of буйна голова.')).toBe(false);
    expect(asked.size).toBe(playing.length);
  });

  it('accepts the Word in another case, with a Stress mark or another apostrophe', async () => {
    const app = await startAt('пірʼя');

    await app.game.answer({ form: 'typed', text: ' ПІ́Р’Я ' });

    expect(current(app).round.answer).toMatchObject({ right: true });
    expect(current(app).lives).toBe(5);
  });

  it('costs a Life for a wrong Word, marks it «Не знаю», moves no Review and lists the text typed', async () => {
    const app = await startAt('кобза');

    await app.game.answer({ form: 'typed', text: 'кобзар' });

    expect(current(app).round.answer).toMatchObject({
      form: 'typed',
      typed: 'кобзар',
      expected: 'кобза',
      right: false,
    });
    expect(current(app).lives).toBe(4);
    expect(app.knowledge.state.shown.get(idOf('кобза'))).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)[0]).toMatchObject({
      entryId: idOf('кобза'),
      right: false,
    });
  });

  it('asks first about the Words the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['кобза', 'ослін', 'пугач'];
    for (const lemma of weak) await app.knowledge.tap(idOf(lemma), 'unknown');

    const rounds = await playGame(app);

    expect(rounds.slice(0, weak.length).map(lemmaOf).sort()).toEqual([...weak].sort());
  });
});

describe('«Відкрити літеру» in «За буквами»', () => {
  it('opens one letter at a time from the start, until one is left, at no cost', async () => {
    const app = await startAt('пірʼя');
    const blanks = () => blanksOf(app);

    expect(current(app).round).toMatchObject({ canOpenLetter: true });

    app.game.openLetter();
    expect(blanks()).toEqual([{ letter: 'п' }, {}, {}, { mark: 'ʼ' }, {}]);
    app.game.openLetter();
    app.game.openLetter();
    expect(blanks()).toEqual([
      { letter: 'п' },
      { letter: 'і' },
      { letter: 'р' },
      { mark: 'ʼ' },
      {},
    ]);
    expect(current(app).round).toMatchObject({ canOpenLetter: false });

    const before = app.game.state;
    app.game.openLetter();
    expect(app.game.state).toBe(before);

    await app.game.answer({ form: 'typed', text: 'пірʼя' });
    expect(current(app).round.answer).toMatchObject({ right: true });
    expect(current(app).lives).toBe(5);
    expect(buildGameReview(current(app).played)[0]).toMatchObject({ right: true });
  });

  it('opens nothing once the Round is answered, and the next Round starts with every letter blank', async () => {
    const app = await startAt('кобза');
    await app.game.answer({ form: 'typed', text: 'кобза' });
    const answered = app.game.state;

    app.game.openLetter();
    expect(app.game.state).toBe(answered);

    await app.game.next();
    expect(blanksOf(app)?.every((blank) => !('letter' in blank))).toBe(true);
    expect(current(app).round).toMatchObject({ canOpenLetter: true });
  });
});
