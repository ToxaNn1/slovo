import { describe, expect, it } from 'vitest';

import type { OriginLanguage, Word } from '@slovo/contracts';

import {
  buildGameReview,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type CurrentGame,
  type Round,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { seededRandom, word } from '../test-support';

/** The Edition's origin languages, in its order. */
const languages: readonly OriginLanguage[] = [
  { code: 'la', name: 'латина' },
  { code: 'grc', name: 'грецька' },
  { code: 'trk', name: 'тюркські' },
  { code: 'pl', name: 'польська' },
  { code: 'de', name: 'німецька' },
  { code: 'other', name: 'інша' },
];

/** The Words with an origin, by Lemma. */
const withOrigin: Readonly<Record<string, string>> = {
  кобза: 'trk',
  жупан: 'trk',
  каламар: 'grc',
  фіранка: 'de',
  шухляда: 'pl',
  рахуба: 'pl',
  аркан: 'trk',
  кафедра: 'grc',
  вікарій: 'la',
  амвон: 'grc',
};

/** The Words with an origin in the Category `church`, the others' in `test`. */
const inChurch = new Set(['кафедра', 'вікарій', 'амвон']);

/** The Words with no origin, which never play. */
const withoutOrigin = ['вирій', 'оброк', 'ослін', 'бекеш', 'пугач', 'кирея', 'ринва'] as const;

const idOf = (lemma: string) => `w_${lemma}`;

const nameOf = (code: string) => languages.find((language) => language.code === code)?.name;

const words: Word[] = [
  ...Object.entries(withOrigin).map(([lemma, origin]) =>
    word(idOf(lemma), {
      lemma,
      stress: [1],
      origin,
      etymology: `Where ${lemma} comes from.`,
      categoryId: inChurch.has(lemma) ? 'church' : 'test',
    }),
  ),
  ...withoutOrigin.map((lemma) => word(idOf(lemma), { lemma, stress: [1] })),
];

const content = createMemoryContentPort({ words });

/** How many Rounds a Game of «Звідки слово» has. */
const ORIGIN_ROUNDS = 8;

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
  originLanguages = languages,
  categoryIds = ['test', 'church'],
}: {
  seed?: number;
  off?: readonly string[];
  originLanguages?: readonly OriginLanguage[];
  categoryIds?: readonly string[];
} = {}): Promise<Composition> {
  const app = await openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds,
          correctionCategoryIds: 'all' as const,
          corrections: true,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
      languageTraits: { distractorRule: 'same-part-of-speech' },
      originLanguages,
    },
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: {
      now: () => new Date('2026-10-27T09:00:00+02:00'),
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

const originOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'origin');

/** The Lemma of the Word a Round asks about, its Stress mark set aside. */
function lemmaOf({ prompt }: Round): string {
  const lemma = prompt.replace('́', '');
  if (withOrigin[lemma] === undefined) throw new Error(`No Word with an origin is «${prompt}»`);
  return lemma;
}

function optionsOf(round: Round): string[] {
  if (round.form !== 'pick') throw new Error(`A Round of the form ${round.form}`);
  return round.options.map(({ text }) => text);
}

/** The place of the option naming the language the Round's Word comes from. */
const rightPick = (round: Round) =>
  optionsOf(round).indexOf(nameOf(withOrigin[lemmaOf(round)] ?? '') ?? '');

/** Starts «Звідки слово» and plays it to its end, every Round right, keeping each answered Round. */
async function playGame(app: Composition): Promise<Round[]> {
  await app.game.start('origin');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'pick', option: rightPick(current(app).round) });
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

/** Every Round of one Game per seed, each answered right. */
async function roundsOf(seeds: readonly number[]): Promise<Round[]> {
  const rounds: Round[] = [];
  for (const seed of seeds) rounds.push(...(await playGame(await run({ seed }))));
  return rounds;
}

describe('«Звідки слово» on offer', () => {
  it('is offered with its Feature Switch on', async () => {
    const app = await run();

    expect(originOffer(app)).toEqual({ modeId: 'origin', entryKind: 'word', canStart: true });
  });

  it.each([['gameOrigin'], ['game']])('is off with %s off', async (feature) => {
    const app = await run({ off: [feature] });

    expect(originOffer(app)).toBeUndefined();
  });

  it('starts with eight Words with an origin in the Mix', async () => {
    const app = await run();
    for (const lemma of ['аркан', 'амвон']) await app.hide({ kind: 'entry', entryId: idOf(lemma) });

    expect(originOffer(app)).toMatchObject({ canStart: true });

    await app.game.start('origin');

    expect(current(app).status).toBe('playing');
  });

  it("says it can't start with seven Words with an origin in the Mix, whatever the Words without one", async () => {
    const app = await run();
    for (const lemma of ['аркан', 'амвон', 'кафедра']) {
      await app.hide({ kind: 'entry', entryId: idOf(lemma) });
    }

    expect(originOffer(app)).toEqual({
      modeId: 'origin',
      entryKind: 'word',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('origin');

    expect(app.game.state.current).toBeUndefined();
  });

  it('counts only the Words with an origin whose Category is in the Mix', async () => {
    const app = await run({ categoryIds: ['test'] });

    expect(originOffer(app)).toMatchObject({ canStart: false, refusal: 'too-few-entries' });
  });

  it("says it can't start in an Edition with fewer than four origin languages", async () => {
    const app = await run({ originLanguages: languages.slice(0, 3) });

    expect(originOffer(app)).toMatchObject({ canStart: false, refusal: 'too-few-entries' });
  });
});

describe('a Round of «Звідки слово»', () => {
  it("shows a Word with its Definition and four of the Edition's origin languages, the Word's own right", async () => {
    const rounds = await roundsOf([1, 2, 3]);

    expect(rounds).toHaveLength(3 * ORIGIN_ROUNDS);
    for (const round of rounds) {
      const lemma = lemmaOf(round);
      const options = optionsOf(round);
      expect(round).toMatchObject({
        form: 'pick',
        prompt: `${lemma.slice(0, 2)}́${lemma.slice(2)}`,
        definition: `The meaning of ${lemma}.`,
        highlight: undefined,
      });
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      for (const option of options) expect(languages.map(({ name }) => name)).toContain(option);
      expect(options.filter((option) => option === nameOf(withOrigin[lemma] ?? ''))).toHaveLength(
        1,
      );
      expect(round.answer).toMatchObject({ form: 'pick', right: true });
      expect(round.answer?.sheet).toEqual({
        answer: { text: nameOf(withOrigin[lemma] ?? ''), stressedVowels: [] },
        example: undefined,
        explanation: `Where ${lemma} comes from.`,
        asked: { text: round.prompt, stressedVowels: [lemma[1]] },
      });
    }
  });

  it('asks only about Words with an origin', async () => {
    const asked = new Set((await roundsOf([1, 2, 3, 4, 5, 6])).map(lemmaOf));

    expect(asked).toEqual(new Set(Object.keys(withOrigin)));
  });

  it('draws its Distractors from every other origin language of the Edition', async () => {
    const shown = new Set((await roundsOf([1, 2, 3, 4, 5, 6])).flatMap(optionsOf));

    expect(shown).toEqual(new Set(languages.map(({ name }) => name)));
  });

  it('costs a Life for a wrong pick, marks the Word «Не знаю», moves no Review and lists the pick in the Game Review', async () => {
    const app = await run();
    await app.game.start('origin');
    const { round } = current(app);
    const asked = lemmaOf(round);
    const wrong = (rightPick(round) + 1) % 4;

    await app.game.answer({ form: 'pick', option: wrong });

    expect(current(app).round.answer).toMatchObject({ right: false, chosen: wrong });
    expect(current(app).lives).toBe(4);
    expect(app.knowledge.state.shown.get(idOf(asked))).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)[0]).toMatchObject({
      entryId: idOf(asked),
      title: { text: round.prompt },
      answer: { text: nameOf(withOrigin[asked] ?? ''), stressedVowels: [] },
      right: false,
      picked: { form: 'pick', text: optionsOf(round)[wrong] },
    });
  });

  it('leads a Game Review item with the Word asked about, its right language beside it', async () => {
    const app = await run();
    await app.game.start('origin');
    const { round } = current(app);
    const asked = lemmaOf(round);

    await app.game.answer({ form: 'pick', option: rightPick(round) });

    expect(buildGameReview(current(app).played)[0]).toMatchObject({
      // Every Word here is stressed on its second letter.
      title: { text: round.prompt, stressedVowels: [asked[1]] },
      answer: { text: nameOf(withOrigin[asked] ?? ''), stressedVowels: [] },
      right: true,
      picked: undefined,
    });
  });

  it('leaves the Knowledge Marks as they were after right answers', async () => {
    const app = await run();

    await playGame(app);

    expect(app.knowledge.state.shown.size).toBe(0);
  });

  it('asks first about the Words the reader marked «Не знаю», never about weak Words without an origin', async () => {
    const app = await run();
    const weak = ['кобза', 'амвон', 'рахуба'];
    for (const lemma of [...weak, 'вирій']) await app.knowledge.tap(idOf(lemma), 'unknown');

    const rounds = await playGame(app);

    expect(rounds.slice(0, weak.length).map(lemmaOf).sort()).toEqual([...weak].sort());
  });
});
