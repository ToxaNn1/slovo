import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

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

/**
 * The pack's Words that play, of 4 to 9 letters: one with an apostrophe, one
 * with a hyphen, two with equal letters and one starting with a capital.
 */
const playing = [
  'каганець',
  'веремія',
  'вирій',
  'оброк',
  'кобза',
  'ослін',
  'бекеш',
  'пугач',
  'хоругва',
  'кирея',
  'жупан',
  'опічок',
  'ринва',
  'колобок',
  'вʼязанка',
  'будь-що',
  'Купала',
] as const;

/** The Words that never play: of 3 letters, of 10, with a space. */
const notPlaying = ['кий', 'перелесник', 'на розхрист'] as const;

const idOf = (lemma: string) => `w_${lemma}`;

const words: Word[] = [...playing, ...notPlaying].map((lemma) =>
  word(idOf(lemma), { lemma, stress: [1] }),
);

const content = createMemoryContentPort({ words });

/** The characters of a Word that stay in place and are no chips. */
const inPlace = new Set(['ʼ', '-']);

/** The Word a Round asks about, read from its Definition. */
function lemmaOf({ prompt }: Round): string {
  const lemma = /^The meaning of (.+)\.$/.exec(prompt)?.[1];
  if (lemma === undefined || !(playing as readonly string[]).includes(lemma)) {
    throw new Error(`No playing Word has the Definition «${prompt}»`);
  }
  return lemma;
}

/** The letters of a Word that are chips, in order. */
const lettersOf = (lemma: string) => Array.from(lemma).filter((letter) => !inPlace.has(letter));

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
}: { seed?: number; off?: readonly string[] } = {}): Promise<Composition> {
  const app = await openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: ['test'],
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
 * The places of the chips that spell the Word in order; of equal letters,
 * the last one shown first when `swapEqual`.
 */
function tapsFor(round: Round, swapEqual = false): number[] {
  const left = chipsOf(round).map((chip, place) => ({ chip, place }));
  if (swapEqual) left.reverse();
  return lettersOf(lemmaOf(round)).map((letter) => {
    const at = left.findIndex(({ chip }) => chip === letter);
    const [found] = left.splice(at, 1);
    if (found === undefined) throw new Error(`No chip «${letter}» is left`);
    return found.place;
  });
}

const anagramOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'anagram');

/** Starts «Анаграми» and plays it to its end, every Round right, keeping each answered Round. */
async function playGame(app: Composition, swapEqual = false): Promise<Round[]> {
  await app.game.start('anagram');
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

describe('«Анаграми» on offer', () => {
  it('is offered with its Feature Switch on', async () => {
    const app = await run();

    expect(anagramOffer(app)).toEqual({ modeId: 'anagram', entryKind: 'word', canStart: true });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameAnagram'] });

    expect(anagramOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 Words of 4–9 letters", async () => {
    const app = await run();
    for (const lemma of ['ринва', 'жупан', 'кирея']) {
      await app.hide({ kind: 'entry', entryId: idOf(lemma) });
    }

    expect(anagramOffer(app)).toEqual({
      modeId: 'anagram',
      entryKind: 'word',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('anagram');

    expect(app.game.state.current).toBeUndefined();
  });
});

describe('a Round of «Анаграми»', () => {
  it("shows the Word's Definition and its letters as shuffled chips, the Word in order right", async () => {
    const rounds = await roundsOf([1, 2, 3]);

    expect(rounds).toHaveLength(3 * GAME_ROUNDS);
    for (const round of rounds) {
      const letters = lettersOf(lemmaOf(round));
      expect(round).toMatchObject({ form: 'chips', highlight: undefined });
      expect([...chipsOf(round)].sort()).toEqual([...letters].sort());
      expect(chipsOf(round)).not.toEqual(letters);
      expect(round.answer).toMatchObject({ form: 'chips', expected: letters, right: true });
      expect(round.answer?.sheet.answer.text).toBe(
        `${lemmaOf(round).slice(0, 2)}́${lemmaOf(round).slice(2)}`,
      );
    }
  });

  it('asks only about Words of 4–9 letters with no space', async () => {
    const asked = new Set((await roundsOf([1, 2, 3, 4, 5, 6])).map(lemmaOf));

    expect(asked).toEqual(new Set(playing));
  });

  it('keeps an apostrophe or a hyphen in place, never a chip', async () => {
    const rounds = (await roundsOf([1, 2, 3, 4, 5, 6])).filter((round) =>
      ['вʼязанка', 'будь-що'].includes(lemmaOf(round)),
    );

    expect(new Set(rounds.map(lemmaOf))).toEqual(new Set(['вʼязанка', 'будь-що']));
    for (const round of rounds) {
      expect(chipsOf(round)).toHaveLength(lemmaOf(round) === 'вʼязанка' ? 7 : 6);
      expect(round).toMatchObject({
        fixed: lemmaOf(round) === 'вʼязанка' ? [{ at: 1, text: 'ʼ' }] : [{ at: 4, text: '-' }],
      });
    }
  });

  it('takes equal letters in either order', async () => {
    const rounds = (await roundsOf([1, 2, 3], true)).filter(
      (round) => lemmaOf(round) === 'колобок',
    );

    expect(rounds.length).toBeGreaterThan(0);
    for (const round of rounds) expect(round.answer).toMatchObject({ right: true });
  });

  it('costs a Life for letters in the wrong order, marks the Word «Не знаю» and lists the letters tapped in the Game Review', async () => {
    const app = await run();
    await app.game.start('anagram');
    const asked = lemmaOf(current(app).round);
    const taps = tapsFor(current(app).round);
    const wrong = [...taps.slice(1), ...taps.slice(0, 1)];

    await app.game.answer({ form: 'chips', chips: wrong });

    expect(current(app).round.answer).toMatchObject({ form: 'chips', chosen: wrong, right: false });
    expect(current(app).lives).toBe(4);
    expect(app.knowledge.state.shown.get(idOf(asked))).toBe('unknown');
    expect(buildGameReview(current(app).played)[0]).toMatchObject({
      entryId: idOf(asked),
      right: false,
      picked: { text: [...lettersOf(asked).slice(1), lettersOf(asked)[0]].join('') },
    });
  });

  it('shows an apostrophe or a hyphen in place in the letters tapped in the Game Review', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const app = await run({ seed });
      await app.game.start('anagram');
      while (current(app).status === 'playing' && lemmaOf(current(app).round) !== 'будь-що') {
        await app.game.answer({ form: 'chips', chips: tapsFor(current(app).round) });
        await app.game.next();
      }
      if (current(app).status !== 'playing') continue;
      const taps = tapsFor(current(app).round);

      await app.game.answer({ form: 'chips', chips: [...taps].reverse() });

      expect(buildGameReview(current(app).played).at(-1)?.picked).toMatchObject({
        text: 'ощьд-уб',
      });
      return;
    }
    throw new Error('No Game asked about «будь-що»');
  });

  it('leaves the Knowledge Marks as they were after right answers', async () => {
    const app = await run();

    await playGame(app);

    expect(app.knowledge.state.shown.size).toBe(0);
  });

  it('asks first about the Words the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['кобза', 'ослін', 'пугач'];
    for (const lemma of weak) await app.knowledge.tap(idOf(lemma), 'unknown');

    const rounds = await playGame(app);

    expect(rounds.slice(0, weak.length).map(lemmaOf).sort()).toEqual([...weak].sort());
  });
});
