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

/** The Ukrainian Edition's vowels. */
const vowels = ['а', 'е', 'є', 'и', 'і', 'ї', 'о', 'у', 'ю', 'я'];

/**
 * The pack's Words, each with where its vowels stand: 16 that play, one of
 * them with two Stresses and one starting on «ї», and «дуб», whose one vowel
 * never plays.
 */
const playing: readonly { lemma: string; stress: number[]; vowels: number[] }[] = [
  { lemma: 'каганець', stress: [5], vowels: [1, 3, 5] },
  { lemma: 'завжди', stress: [1, 5], vowels: [1, 5] },
  { lemma: 'їжак', stress: [2], vowels: [0, 2] },
  { lemma: 'веремія', stress: [5], vowels: [1, 3, 5, 6] },
  { lemma: 'вирій', stress: [1], vowels: [1, 3] },
  { lemma: 'оброк', stress: [3], vowels: [0, 3] },
  { lemma: 'верес', stress: [1], vowels: [1, 3] },
  { lemma: 'кобза', stress: [1], vowels: [1, 4] },
  { lemma: 'ослін', stress: [0], vowels: [0, 3] },
  { lemma: 'бекеш', stress: [1], vowels: [1, 3] },
  { lemma: 'пугач', stress: [1], vowels: [1, 3] },
  { lemma: 'хоругва', stress: [1], vowels: [1, 3, 6] },
  { lemma: 'кирея', stress: [1], vowels: [1, 3, 4] },
  { lemma: 'жупан', stress: [1], vowels: [1, 3] },
  { lemma: 'опічок', stress: [2], vowels: [0, 2, 4] },
  { lemma: 'ринва', stress: [1], vowels: [1, 4] },
];

const idOf = (lemma: string) => `w_${lemma}`;

const words: Word[] = [
  ...playing.map(({ lemma, stress }) => word(idOf(lemma), { lemma, stress })),
  word('w_дуб', { lemma: 'дуб', stress: [1] }),
];

const content = createMemoryContentPort({ words });

/** Where the vowels of the Round's Word stand, and which of them are stressed. */
function expectedOf({ prompt }: Round) {
  const asked = playing.find(({ lemma }) => lemma === prompt);
  if (asked === undefined) throw new Error(`No playing Word is «${prompt}»`);
  return asked;
}

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
  marksStress = true,
}: {
  seed?: number;
  off?: readonly string[];
  marksStress?: boolean;
} = {}): Promise<Composition> {
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
      languageTraits: {
        distractorRule: 'same-part-of-speech',
        marksStress,
        ...(marksStress ? { vowels } : {}),
      },
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

const stressOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'stress');

/**
 * Starts «Наголос» and plays it to its end, tapping the vowel `tap` names,
 * keeping each answered Round.
 */
async function playGame(
  app: Composition,
  tap: (asked: (typeof playing)[number]) => number,
): Promise<Round[]> {
  await app.game.start('stress');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'vowel', position: tap(expectedOf(current(app).round)) });
    if (current(app).round.answer === undefined) throw new Error('The tap was no answer');
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

describe('«Наголос» on offer', () => {
  it('is offered when the Edition marks Stress and turns the mode on', async () => {
    const app = await run();

    expect(stressOffer(app)).toEqual({ modeId: 'stress', entryKind: 'word', canStart: true });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameStress'] });

    expect(stressOffer(app)).toBeUndefined();
  });

  it("is off in an Edition that doesn't mark Stress", async () => {
    const app = await run({ marksStress: false });

    expect(stressOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 Words of more than one vowel", async () => {
    const app = await run();
    await app.hide({ kind: 'entry', entryId: idOf('ринва') });
    await app.hide({ kind: 'entry', entryId: idOf('жупан') });

    expect(stressOffer(app)).toEqual({
      modeId: 'stress',
      entryKind: 'word',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('stress');

    expect(app.game.state.current).toBeUndefined();
  });
});

describe('a Round of «Наголос»', () => {
  it('shows the Lemma without Stress, each vowel a button, the stressed one right', async () => {
    const rounds: Round[] = [];
    for (const seed of [1, 2, 3]) {
      rounds.push(...(await playGame(await run({ seed }), ({ stress }) => stress[0] ?? -1)));
    }

    expect(rounds).toHaveLength(3 * GAME_ROUNDS);
    for (const round of rounds) {
      const { stress, vowels: places } = expectedOf(round);
      expect(round).toMatchObject({ form: 'vowel', vowels: places, highlight: undefined });
      expect(round.answer).toMatchObject({ form: 'vowel', stressed: stress, right: true });
    }
  });

  it('never asks about a Word with one vowel', async () => {
    const asked = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const round of await playGame(await run({ seed }), ({ stress }) => stress[0] ?? -1)) {
        asked.add(round.prompt);
      }
    }

    expect(asked.has('дуб')).toBe(false);
    expect(asked.size).toBe(playing.length);
  });

  it('accepts either Stress of a Word with two, and its sheet shows both', async () => {
    const twoStress: Round[] = [];
    for (const seed of [1, 2, 3]) {
      for (const tap of [0, 1]) {
        const rounds = await playGame(
          await run({ seed }),
          ({ stress }) => stress[tap] ?? stress[0] ?? -1,
        );
        twoStress.push(...rounds.filter(({ prompt }) => prompt === 'завжди'));
      }
    }

    expect(twoStress.map(({ answer }) => answer)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chosen: 1, right: true }),
        expect.objectContaining({ chosen: 5, right: true }),
      ]),
    );
    expect(twoStress[0]?.answer?.sheet.answer).toEqual({
      text: 'за́вжди́',
      stressedVowels: ['а', 'и'],
    });
  });

  it('costs a Life for an unstressed vowel, marks the Word «Не знаю» and lists it in the Game Review', async () => {
    const app = await run();
    await app.game.start('stress');
    const asked = expectedOf(current(app).round);
    const wrong = asked.vowels.find((place) => !asked.stress.includes(place)) ?? -1;

    await app.game.answer({ form: 'vowel', position: wrong });

    expect(current(app).round.answer).toMatchObject({ form: 'vowel', chosen: wrong, right: false });
    expect(current(app).lives).toBe(4);
    expect(app.knowledge.state.shown.get(idOf(asked.lemma))).toBe('unknown');
    expect(buildGameReview(current(app).played)[0]).toMatchObject({
      entryId: idOf(asked.lemma),
      right: false,
    });
  });

  it('asks first about the Words the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['кобза', 'ослін', 'пугач'];
    for (const lemma of weak) await app.knowledge.tap(idOf(lemma), 'unknown');

    const rounds = await playGame(app, ({ stress }) => stress[0] ?? -1);

    expect(
      rounds
        .slice(0, weak.length)
        .map(({ prompt }) => prompt)
        .sort(),
    ).toEqual([...weak].sort());
  });
});
