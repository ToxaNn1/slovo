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

const test: Category = { id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' };
const crafts: Category = {
  id: 'crafts',
  displayName: 'Crafts',
  description: 'Crafts.',
  tone: 'loud',
};

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

/** The Core composition of one app run, every Feature Switch on but those turned off: letter tiles unless named. */
async function run({
  seed = 7,
  off = ['letterTiles'],
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

/** The test Edition's alphabet, where decoys come from. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** The letters of a Word that are tiles: every character but those that stay in place. */
const lettersOf = (lemma: string): string[] => Array.from(lemma).filter((c) => !/['ʼ-]/.test(c));

/** The chips Round in play, which must be letter tiles. */
function tilesOf(app: Composition): Extract<Round, { form: 'chips' }> {
  const { round } = current(app);
  if (round.form !== 'chips') throw new Error(`The Round is a ${round.form} Round`);
  return round;
}

/** The places of the tiles that spell the letters, each tile once. */
function placesOf(chips: readonly string[], letters: readonly string[]): number[] {
  const used = new Set<number>();
  return letters.map((letter) => {
    const place = chips.findIndex((chip, at) => chip === letter && !used.has(at));
    if (place < 0) throw new Error(`No tile «${letter}» left`);
    used.add(place);
    return place;
  });
}

/** Starts «За буквами» with letter tiles and plays it to its end, keeping each Round before its answer. */
async function playTiles(app: Composition): Promise<Round[]> {
  await app.game.start('by-letters');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    const round = tilesOf(app);
    rounds.push(round);
    const chips = placesOf(round.chips, lettersOf(lemmaOf(round)));
    await app.game.answer({ form: 'chips', chips });
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

describe('«За буквами» with letter tiles', () => {
  it("shows the Word's letters plus decoys from the alphabet, at least 8 tiles in a multiple of 4", async () => {
    const rounds = await playTiles(await run({ off: [] }));

    expect(rounds).toHaveLength(GAME_ROUNDS);
    for (const round of rounds) {
      if (round.form !== 'chips') throw new Error('Not a tiles Round');
      const letters = lettersOf(lemmaOf(round));
      const decoys = [...round.chips];
      for (const letter of letters) decoys.splice(decoys.indexOf(letter), 1);

      expect(round).toMatchObject({ layout: 'tiles', chipKind: 'letter', slots: letters.length });
      expect(round.chips).toHaveLength(Math.max(8, Math.ceil(letters.length / 4) * 4));
      expect(round.chips.length - decoys.length).toBe(letters.length);
      for (const decoy of decoys) {
        expect(ALPHABET).toContain(decoy);
        expect(letters).not.toContain(decoy);
      }
    }
  });

  it('keeps an apostrophe in place, no tile, and shows the same tiles for the same seed', async () => {
    const first = await run({ off: [] });
    const again = await run({ off: [] });
    await first.game.start('by-letters');
    await again.game.start('by-letters');

    expect(tilesOf(again).chips).toEqual(tilesOf(first).chips);

    const rounds = await playTiles(await run({ off: [] }));
    const withApostrophe = rounds.find((round) => lemmaOf(round) === 'пірʼя');
    expect(withApostrophe).toMatchObject({ fixed: [{ at: 3, text: 'ʼ' }], slots: 4 });
    expect(withApostrophe?.form === 'chips' && withApostrophe.chips).not.toContain('ʼ');
  });

  it('answers right when the slots spell the Word and takes a Life for a decoy among them', async () => {
    const app = await run({ off: [] });
    await app.game.start('by-letters');
    const round = tilesOf(app);
    const letters = lettersOf(lemmaOf(round));
    const right = placesOf(round.chips, letters);
    const decoy = round.chips.findIndex((_, place) => !right.includes(place));
    const lives = current(app).lives;

    await app.game.answer({ form: 'chips', chips: [...right.slice(0, -1), decoy] });
    expect(current(app)).toMatchObject({ status: 'answered', round: { answer: { right: false } } });
    expect(current(app).lives).not.toEqual(lives);

    await app.game.next();
    const next = tilesOf(app);
    await app.game.answer({
      form: 'chips',
      chips: placesOf(next.chips, lettersOf(lemmaOf(next))),
    });
    expect(current(app)).toMatchObject({ round: { answer: { right: true } } });
  });

  it('types the Word with letter tiles off', async () => {
    const app = await run({ off: ['letterTiles'] });
    await app.game.start('by-letters');

    expect(current(app).round.form).toBe('typed');
  });
});
