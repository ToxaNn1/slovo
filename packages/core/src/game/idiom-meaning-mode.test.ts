import { describe, expect, it } from 'vitest';

import type { Idiom, IdiomType } from '@slovo/contracts';

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
import { seededRandom } from '../test-support';

function idiom(id: string, idiomType: IdiomType = 'idiom'): Idiom {
  return {
    kind: 'idiom',
    id,
    expression: `expression ${id.slice(2)}`,
    idiomType,
    primaryDefinition: `meaning ${id.slice(2)}`,
    extraDefinitions: [],
    examples: [{ text: `They said expression ${id.slice(2)}.` }],
    ...(idiomType === 'placeName' ? { etymology: `Named after ${id.slice(2)}.` } : {}),
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

/** The 15 Idioms that play, 12 idioms proper and 3 proverbs, and a place name, which never plays. */
const playing = [
  ...Array.from({ length: 12 }, (_, index) =>
    idiom(`i_idiom${String(index + 1).padStart(2, '0')}`),
  ),
  ...Array.from({ length: 3 }, (_, index) => idiom(`i_proverb${String(index + 1)}`, 'proverb')),
];

const placeName = idiom('i_place1', 'placeName');

const content = createMemoryContentPort({ idioms: [...playing, placeName] });

/** The Core composition of one app run, every Feature Switch on but those turned off. */
async function run({
  seed = 7,
  off = [],
  idiomsInMix = true,
}: {
  seed?: number;
  off?: readonly string[];
  idiomsInMix?: boolean;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => !off.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: [],
          correctionCategoryIds: 'all' as const,
          corrections: true,
          idioms: idiomsInMix,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
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

const idiomMeaningOffer = (app: Composition) =>
  app.game.state.modes.find(({ modeId }) => modeId === 'idiom-meaning');

/** The Idiom the Round asks about, by its expression. */
function askedOf({ prompt }: Round): Idiom {
  const asked = [...playing, placeName].find(({ expression }) => expression === prompt);
  if (asked === undefined) throw new Error(`No Idiom reads «${prompt}»`);
  return asked;
}

/** The place of the asked Idiom's meaning among the Round's options. */
function rightOf(round: Round): number {
  if (round.form !== 'pick') throw new Error(`A ${round.form} Round`);
  return round.options.findIndex(({ text }) => text === askedOf(round).primaryDefinition);
}

/** Starts «Фразеологізми» and plays it to its end, always picking the right meaning, keeping each answered Round. */
async function playGame(app: Composition): Promise<Round[]> {
  await app.game.start('idiom-meaning');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    await app.game.answer({ form: 'pick', option: rightOf(current(app).round) });
    rounds.push(current(app).round);
    if (current(app).status === 'answered') await app.game.next();
  }
  return rounds;
}

/** Starts «Фразеологізми» with seeds until its first Round asks about the Idiom. */
async function startAt(id: string): Promise<Composition> {
  for (let seed = 1; seed < 200; seed += 1) {
    const app = await run({ seed });
    await app.game.start('idiom-meaning');
    if (askedOf(current(app).round).id === id) return app;
  }
  throw new Error(`No Game starts with «${id}»`);
}

describe('«Фразеологізми» on offer', () => {
  it('is offered when the Edition turns the mode on', async () => {
    const app = await run();

    expect(idiomMeaningOffer(app)).toEqual({
      modeId: 'idiom-meaning',
      entryKind: 'idiom',
      canStart: true,
    });
  });

  it('is off with its Feature Switch off', async () => {
    const app = await run({ off: ['gameIdiomMeaning'] });

    expect(idiomMeaningOffer(app)).toBeUndefined();
  });

  it('is off when the Edition turns Idioms off', async () => {
    const app = await run({ off: ['idioms'] });

    expect(idiomMeaningOffer(app)).toBeUndefined();
  });

  it("says it can't start with fewer than 15 Idioms that play, a place name not counted", async () => {
    const app = await run();
    await app.hide({ kind: 'entry', entryId: 'i_proverb1' });

    expect(idiomMeaningOffer(app)).toEqual({
      modeId: 'idiom-meaning',
      entryKind: 'idiom',
      canStart: false,
      refusal: 'too-few-entries',
    });

    await app.game.start('idiom-meaning');

    expect(app.game.state.current).toBeUndefined();
  });

  it("can't start while Idioms are out of the Mix, says so, and can once they are back", async () => {
    const app = await run({ idiomsInMix: false });

    expect(idiomMeaningOffer(app)).toEqual({
      modeId: 'idiom-meaning',
      entryKind: 'idiom',
      canStart: false,
      refusal: 'idioms-out-of-mix',
    });

    await app.mix.setKind('idiom', true);

    expect(idiomMeaningOffer(app)).toMatchObject({ canStart: true });
  });
});

describe('a Round of «Фразеологізми»', () => {
  it("shows an expression and four meanings, the expression's own the one right", async () => {
    const app = await run();
    const rounds = await playGame(app);
    const meaningsThatPlay = new Set(playing.map(({ primaryDefinition }) => primaryDefinition));

    expect(rounds).toHaveLength(GAME_ROUNDS);
    for (const round of rounds) {
      if (round.form !== 'pick') throw new Error(`A ${round.form} Round`);
      const asked = askedOf(round);
      const texts = round.options.map(({ text }) => text);
      expect(round).toMatchObject({ entryKind: 'idiom', prompt: asked.expression });
      expect(texts).toHaveLength(4);
      expect(new Set(texts).size).toBe(4);
      expect(texts.filter((text) => text === asked.primaryDefinition)).toHaveLength(1);
      for (const text of texts) expect(meaningsThatPlay.has(text)).toBe(true);
      expect(round.answer).toMatchObject({ form: 'pick', right: true });
    }
    expect(current(app)).toMatchObject({ lives: 5, status: 'won' });
  });

  it('asks about idioms and proverbs and never about a place name, nor offers its meaning', async () => {
    const asked = new Set<string>();
    const offered = new Set<string>();
    for (const seed of [1, 2, 3]) {
      for (const round of await playGame(await run({ seed }))) {
        asked.add(askedOf(round).id);
        if (round.form === 'pick') for (const { text } of round.options) offered.add(text);
      }
    }

    expect(asked.has(placeName.id)).toBe(false);
    expect(asked.has('i_proverb2')).toBe(true);
    expect(asked.size).toBe(playing.length);
    expect(offered.has(placeName.primaryDefinition)).toBe(false);
  });

  it('costs a Life for a wrong meaning, marks the Idiom «Не знаю», moves no Review and lists the meaning picked', async () => {
    const app = await startAt('i_proverb3');
    const { round } = current(app);
    if (round.form !== 'pick') throw new Error(`A ${round.form} Round`);
    const wrong = rightOf(round) === 0 ? 1 : 0;

    await app.game.answer({ form: 'pick', option: wrong });

    expect(current(app).lives).toBe(4);
    expect(current(app).round.answer).toMatchObject({
      right: false,
      sheet: {
        answer: { text: 'meaning proverb3', stressedVowels: [] },
        example: { text: 'They said expression proverb3.' },
      },
    });
    expect(app.knowledge.state.shown.get('i_proverb3')).toBe('unknown');
    expect(app.knowledge.state.due).toEqual([]);
    expect(buildGameReview(current(app).played)).toEqual([
      {
        number: 1,
        entryId: 'i_proverb3',
        title: { text: 'expression proverb3', stressedVowels: [] },
        answer: undefined,
        right: false,
        picked: { ...round.options[wrong], form: 'pick' },
        details: {
          kind: 'idiom',
          definition: 'meaning proverb3',
          example: { text: 'They said expression proverb3.' },
          etymology: undefined,
        },
      },
    ]);
  });

  it('asks first about the Idioms the reader marked «Не знаю»', async () => {
    const app = await run();
    const weak = ['i_idiom03', 'i_idiom09', 'i_proverb2'];
    for (const id of weak) await app.knowledge.tap(id, 'unknown');

    const rounds = await playGame(app);

    expect(
      rounds
        .slice(0, weak.length)
        .map((round) => askedOf(round).id)
        .sort(),
    ).toEqual([...weak].sort());
  });
});
