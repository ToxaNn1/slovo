import { describe, expect, it } from 'vitest';

import type {
  Category,
  Example,
  Idiom,
  PartOfSpeech,
  SynonymRow,
  Tip,
  Word,
} from '@slovo/contracts';

import {
  buildGameReview,
  createMemoryUserStatePort,
  GAME_LIVES,
  GAME_ROUNDS,
  openComposition,
  openUserState,
  renderStress,
  SEEN_DWELL_MS,
  userStateRecords,
  type Clock,
  type Composition,
  type ContentReadPort,
  type CurrentGame,
  type FeatureSwitch,
  type GameMode,
  type Round,
  type Schedule,
  type UserStateChanges,
  type UserStatePort,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { idiom, seededRandom } from '../test-support';

function word(
  id: string,
  categoryId: string,
  {
    partOfSpeech = 'noun',
    lemma = id.slice(2),
    stress = [0],
    examples = [{ text: `An example of ${id.slice(2)}.`, author: 'An author' }],
    rarity = 3,
    retired = false,
  }: {
    partOfSpeech?: PartOfSpeech;
    lemma?: string;
    stress?: number[];
    examples?: Example[];
    rarity?: number;
    retired?: boolean;
  } = {},
): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress,
    partOfSpeech,
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
    extraDefinitions: [],
    examples,
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired,
  };
}

/** The Language Pack's Categories, in its order. */
const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const crafts: Category = { id: 'crafts', displayName: 'Crafts' };
const categories = [nature, speech, crafts];

const numbered = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);

/**
 * The pack: 14 nouns and 3 adjectives in Nature, 6 nouns, 2 verbs and two
 * homonyms (one Lemma, two Stresses) in Speech, 3 nouns in Crafts, and a
 * Retired noun. Two Words have no Example.
 */
const words = [
  ...numbered('w_nnoun', 14).map((id) => word(id, 'nature')),
  ...numbered('w_nadj', 3).map((id) => word(id, 'nature', { partOfSpeech: 'adjective' })),
  ...numbered('w_snoun', 6).map((id) =>
    word(id, 'speech', id === 'w_snoun01' || id === 'w_snoun02' ? { examples: [] } : {}),
  ),
  ...numbered('w_sverb', 2).map((id) => word(id, 'speech', { partOfSpeech: 'verb' })),
  word('w_kupyna1', 'speech', { lemma: 'kupyna', stress: [1] }),
  word('w_kupyna2', 'speech', { lemma: 'kupyna', stress: [4] }),
  ...numbered('w_cnoun', 3).map((id) => word(id, 'crafts')),
  word('w_retired', 'nature', { retired: true }),
];
const content = createMemoryContentPort({ categories, words });

const byDefinition = new Map(words.map((w) => [w.primaryDefinition, w]));

/** The Word a Round asks about: the one whose primary Definition is its prompt. */
function answerOf(round: Round): Word {
  const answer = byDefinition.get(round.prompt);
  if (answer === undefined) throw new Error(`No Word has the Definition «${round.prompt}»`);
  return answer;
}

/** The Words a Round offers, in the order shown. */
const optionWordsOf = (round: Round) =>
  round.options.map(({ text }) => {
    const option = words.find((w) => renderStress(w) === text);
    if (option === undefined) throw new Error(`No Word reads «${text}»`);
    return option;
  });

/** The option that names the answer. */
const rightOf = (round: Round) =>
  round.options.findIndex(({ text }) => text === renderStress(answerOf(round)));

const clock: Clock = {
  now: () => new Date('2026-10-11T09:00:00+03:00'),
  timeZone: () => 'Europe/Kyiv',
};

/** A user-state port over the records that keeps every write it is given. */
function recordingPort(records: Map<string, string>) {
  const port = createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  return {
    writes,
    port: {
      ...port,
      write(changes) {
        writes.push(changes);
        return port.write(changes);
      },
    } satisfies UserStatePort,
  };
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

/** The Core composition of one app run over the records. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  seed = 7,
  game = true,
  gameModes,
  time = clock,
  pack = content,
  planned = true,
  schedule,
  on = ['rarityFloor', 'knowledge'],
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  seed?: number;
  game?: boolean;
  /** The Feature Switches on besides the Game's. */
  on?: readonly FeatureSwitch[];
  gameModes?: readonly GameMode[];
  time?: Clock;
  pack?: ContentReadPort;
  /** Whether to wait for the Game to plan its offers. */
  planned?: boolean;
  schedule?: Schedule;
} = {}): Promise<Composition> {
  const app = await openComposition({
    content: pack,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => (feature === 'game' && game) || on.includes(feature),
      userSettingDefaults: {
        mix: {
          categoryIds: categories.map(({ id }) => id),
          correctionCategoryIds: 'all' as const,
          corrections: false,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
      languageTraits: { distractorRule: 'same-part-of-speech' },
    },
    userState: await openUserState({ port }),
    clock: time,
    random: seededRandom(seed),
    ...(gameModes === undefined ? {} : { gameModes }),
    ...(schedule === undefined ? {} : { schedule }),
  });
  return planned ? offersPlanned(app) : app;
}

/** History records of the Words, as the Feed would have kept them. */
function historyOf(ids: readonly string[]): Map<string, string> {
  return new Map(
    ids.flatMap((id, index) => [
      ...userStateRecords.history.record(id).change({
        seenAt: new Date(Date.UTC(2026, 9, 1, 9, index)).toISOString(),
        wordOfTheDay: false,
      }),
    ]) as [string, string][],
  );
}

/** The Game in play; fails the test when there is none. */
function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** Answers the current Round right or wrong and taps «Далі». */
async function play(app: Composition, right: boolean, rightOption = rightOf): Promise<void> {
  const { round } = current(app);
  const option = rightOption(round);
  void app.game.answer(right ? option : (option + 1) % round.options.length);
  await app.game.next();
}

/** Starts «Вгадай слово» and plays it to its end, wrong only in the Rounds listed (from 1). */
async function playGame(app: Composition, wrongIn: readonly number[] = []): Promise<Round[]> {
  await app.game.start('guess-word');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    rounds.push(current(app).round);
    await play(app, !wrongIn.includes(current(app).round.number));
  }
  return rounds;
}

describe('the Game Modes on offer', () => {
  it('offers «Вгадай слово», ready to start, and no Game in play', async () => {
    const app = await run();

    expect(app.game.state).toEqual({
      modes: [{ modeId: 'guess-word', entryKind: 'word', canStart: true }],
      current: undefined,
    });
  });

  it('offers no mode when the Edition turns the Game off', async () => {
    const app = await run({ game: false });

    expect(app.game.state.modes).toEqual([]);
  });

  it("says a mode can't start with fewer than 15 eligible Words, and can once there are again", async () => {
    const app = await run();
    // Nature alone has 17 Words; two hidden leave 15.
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });
    await app.hide({ kind: 'entry', entryId: 'w_nnoun01' });
    await app.hide({ kind: 'entry', entryId: 'w_nnoun02' });
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);

    await app.hide({ kind: 'entry', entryId: 'w_nnoun03' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
    await app.game.start('guess-word');
    expect(app.game.state.current).toBeUndefined();

    await app.unhide({ kind: 'entry', entryId: 'w_nnoun03' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);
  });
});

describe('a Round of «Вгадай слово»', () => {
  it("asks a Word's primary Definition, with four Lemmas with Stress, the answer among them", async () => {
    const app = await run();

    await app.game.start('guess-word');

    const game = current(app);
    expect(game).toMatchObject({
      modeId: 'guess-word',
      roundsPassed: 0,
      lives: GAME_LIVES,
      status: 'playing',
    });
    expect(game.round).toMatchObject({ number: 1, answer: undefined });
    expect(game.round.options).toHaveLength(4);
    const answer = answerOf(game.round);
    const options = optionWordsOf(game.round);
    expect(options).toContain(answer);
    expect(game.round.options.map((option) => option.stressedVowels)).toEqual(
      options.map((option) => [option.lemma[option.stress[0] ?? 0]]),
    );
  });

  it('shows the Lemma with its Stress and the first Example with its author once answered', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const { round } = current(app);

    void app.game.answer(rightOf(round));

    const answer = answerOf(round);
    expect(current(app).round.answer).toEqual({
      chosen: rightOf(round),
      correct: rightOf(round),
      sheet: {
        answer: { text: renderStress(answer), stressedVowels: [answer.lemma[0]] },
        example: { text: `An example of ${answer.id.slice(2)}.`, author: 'An author' },
      },
    });
  });

  it('shows the Lemma alone for a Word without an Example', async () => {
    const app = await run({ seed: 3 });
    const sheets = [];
    for (let game = 0; game < 4; game += 1) {
      await app.game.start('guess-word');
      while (current(app).status === 'playing') {
        const { round } = current(app);
        void app.game.answer(rightOf(round));
        sheets.push({ answer: answerOf(round), sheet: current(app).round.answer?.sheet });
        await app.game.next();
      }
    }

    const withoutExample = sheets.filter(({ answer }) => answer.examples.length === 0);
    expect(withoutExample.length).toBeGreaterThan(0);
    for (const { answer, sheet } of withoutExample) {
      expect(sheet).toEqual({
        answer: { text: renderStress(answer), stressedVowels: [answer.lemma[0]] },
        example: undefined,
      });
    }
  });

  it("offers Distractors of the answer's part of speech first, then other Words", async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const app = await run({ seed });

      for (const round of await playGame(app)) {
        const answer = answerOf(round);
        const distractors = optionWordsOf(round).filter((option) => option !== answer);
        const samePartOfSpeech = words.filter(
          (w) => !w.retired && w.partOfSpeech === answer.partOfSpeech && w.lemma !== answer.lemma,
        );
        expect(distractors.filter((d) => d.partOfSpeech === answer.partOfSpeech)).toHaveLength(
          Math.min(3, samePartOfSpeech.length),
        );
      }
    }
  });

  it('tops the Distractors up with other Words when a narrow Mix has too few of the part of speech', async () => {
    const app = await run();
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    const rounds = await playGame(app);

    // Nature has 14 nouns and 3 adjectives, so 15 Rounds ask about an adjective at least once.
    const adjectiveRounds = rounds.filter((round) => answerOf(round).partOfSpeech === 'adjective');
    expect(adjectiveRounds.length).toBeGreaterThan(0);
    for (const round of adjectiveRounds) {
      const partsOfSpeech = optionWordsOf(round).map((option) => option.partOfSpeech);
      expect(partsOfSpeech.toSorted()).toEqual(['adjective', 'adjective', 'adjective', 'noun']);
    }
  });

  it('never offers two options with the same Lemma, so homonyms never share a Round', async () => {
    let homonymRounds = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = await run({ seed });

      for (const round of await playGame(app)) {
        const lemmas = optionWordsOf(round).map((option) => option.lemma);
        expect(new Set(lemmas).size).toBe(4);
        if (answerOf(round).lemma === 'kupyna') homonymRounds += 1;
      }
    }
    expect(homonymRounds).toBeGreaterThan(0);
  });

  it('puts the answer in different places, as the random source has it', async () => {
    const app = await run();

    const places = (await playGame(app)).map(rightOf);

    expect(new Set(places).size).toBeGreaterThan(1);
  });
});

describe('the idioms «Вгадай слово» asks about', () => {
  const idiomOf = (id: string, overrides: Partial<Idiom> = {}) =>
    idiom(id, {
      expression: `to ${id.slice(2)}`,
      primaryDefinition: `The sense of ${id.slice(2)}.`,
      examples: [{ text: `An example of ${id.slice(2)}.`, author: 'An author' }],
      ...overrides,
    });

  /** 16 idioms, two more that share one Definition, 3 place names, 2 proverbs and a Retired idiom. */
  const idioms = [
    ...numbered('i_idiom', 16).map((id) => idiomOf(id)),
    idiomOf('i_twin1', { primaryDefinition: 'A shared sense.' }),
    idiomOf('i_twin2', { primaryDefinition: 'A shared sense.' }),
    ...numbered('i_place', 3).map((id) =>
      idiomOf(id, { idiomType: 'placeName', etymology: 'The story of its name.' }),
    ),
    ...numbered('i_proverb', 2).map((id) => idiomOf(id, { idiomType: 'proverb' })),
    idiomOf('i_old', { retired: true }),
  ];
  const twins = ['i_twin1', 'i_twin2'];
  const placeNames = numbered('i_place', 3);
  const proverbs = numbered('i_proverb', 2);
  const entries: readonly (Word | Idiom)[] = [...words, ...idioms];

  /** What an option of the Entry reads. */
  const textOf = (entry: Word | Idiom) =>
    entry.kind === 'word' ? renderStress(entry) : entry.expression;

  /** The Entries a Round offers, in the order shown. */
  const offered = (round: Round) =>
    round.options.map(({ text }) => {
      const option = entries.find((entry) => textOf(entry) === text);
      if (option === undefined) throw new Error(`No Entry reads «${text}»`);
      return option;
    });

  /** The option whose Entry has the prompt for its primary Definition. */
  const rightAmong = (round: Round) =>
    offered(round).findIndex(({ primaryDefinition }) => primaryDefinition === round.prompt);

  /** The Core composition over a pack of the Words and the idioms, with Idioms on. */
  const runWith = (
    pack: { words?: readonly Word[]; idioms?: readonly Idiom[] },
    on: readonly FeatureSwitch[] = ['knowledge', 'idioms'],
    seed?: number,
  ) =>
    run({
      pack: createMemoryContentPort({ categories, ...pack }),
      on,
      ...(seed === undefined ? {} : { seed }),
    });

  /** Plays «Вгадай слово» to its end, wrong only in the Rounds about the Entries listed. */
  async function playAll(app: Composition, wrongOn: readonly string[] = []) {
    await app.game.start('guess-word');
    while (current(app).status === 'playing') {
      const { round } = current(app);
      const asked = offered(round)[rightAmong(round)];
      await play(app, !wrongOn.includes(asked?.id ?? ''), rightAmong);
    }
    return current(app).played;
  }

  it("asks an idiom's primary Definition with four idioms, and shows it with its first Example once answered", async () => {
    const app = await runWith({ idioms });

    const played = await playAll(app);

    expect(played).toHaveLength(GAME_ROUNDS);
    for (const { entry, prompt, options, answer } of played) {
      if (entry.kind !== 'idiom') throw new Error(`A Round asked about ${entry.id}`);
      expect(prompt).toBe(entry.primaryDefinition);
      expect(options).toHaveLength(4);
      expect(options.map(({ text }) => text)).toContain(entry.expression);
      expect(options.every(({ stressedVowels }) => stressedVowels.length === 0)).toBe(true);
      expect(answer.sheet).toEqual({
        answer: { text: entry.expression, stressedVowels: [] },
        example: entry.examples[0],
      });
    }
  });

  it('lists an idiom Round in the Game Review led by its expression, expanding into its Definition, Example and etymology', async () => {
    const app = await runWith({ idioms });

    const played = await playAll(app);

    expect(buildGameReview(played)).toEqual(
      played.map((round) => {
        if (round.entry.kind !== 'idiom') throw new Error(`A Round asked about ${round.entry.id}`);
        const { entry } = round;
        return {
          number: round.number,
          entryId: entry.id,
          title: { text: entry.expression, stressedVowels: [] },
          right: true,
          picked: undefined,
          details: {
            kind: 'idiom',
            definition: entry.primaryDefinition,
            example: entry.examples[0],
            etymology: entry.etymology,
          },
        };
      }),
    );
  });

  it("never offers an idiom with the answer's primary Definition, whatever the draw", async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = await runWith({ idioms }, undefined, seed);
      for (const id of twins) await app.knowledge.tap(id, 'unknown');

      const played = await playAll(app);

      const twinRounds = played.filter(({ entry }) => twins.includes(entry.id));
      expect(twinRounds.map(({ entry }) => entry.id).toSorted()).toEqual(twins);
      for (const round of twinRounds) {
        expect(offered(round).filter(({ id }) => twins.includes(id))).toEqual([round.entry]);
      }
    }
  });

  it('never asks about or offers a place name, a proverb or a Retired idiom, even one marked «Не знаю»', async () => {
    const app = await runWith({ idioms });
    for (const id of [...placeNames, ...proverbs]) await app.knowledge.tap(id, 'unknown');

    const played = await playAll(app);

    const shown = played.flatMap((round) => [round.entry, ...offered(round)]).map(({ id }) => id);
    expect(
      shown.filter((id) => placeNames.includes(id) || proverbs.includes(id) || id === 'i_old'),
    ).toEqual([]);
  });

  it("can't start with 14 idioms and 3 place names: a place name makes no Round", async () => {
    const app = await runWith({
      idioms: idioms.filter(({ id }) => ![...twins, 'i_idiom15', 'i_idiom16'].includes(id)),
    });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
  });

  it("doesn't ask about History with 14 Words and 2 place names in it: a place name makes no Round", async () => {
    const met = numbered('w_nnoun', 14);
    const app = await run({
      pack: createMemoryContentPort({ categories, words, idioms }),
      on: ['knowledge', 'idioms'],
      records: historyOf([...met, 'i_place01', 'i_place02']),
    });

    const played = await playAll(app);

    // History is below the threshold, so the Game asks about the whole pack, not History first.
    expect(played.filter(({ entry }) => !met.includes(entry.id)).length).toBeGreaterThan(1);
  });

  it('asks about Words and idioms in one Game: a Word Round offers Words only, an idiom Round idioms only', async () => {
    const unknown = ['i_idiom01', 'i_idiom02', 'i_idiom03'];
    const app = await runWith({ words, idioms });
    for (const id of unknown) await app.knowledge.tap(id, 'unknown');

    const played = await playAll(app);

    const kinds = played.map(({ entry }) => entry.kind);
    expect(kinds).toContain('word');
    expect(kinds).toContain('idiom');
    for (const round of played) {
      expect(offered(round).map(({ kind }) => kind)).toEqual(Array(4).fill(round.entry.kind));
    }
    expect(played.filter(({ entry }) => unknown.includes(entry.id))).toHaveLength(3);
  });

  it('asks an idiom due for Review today along with the Words in History', async () => {
    const history = historyOf(numbered('w_nnoun', 14).concat('w_snoun03'));
    const due = userStateRecords.knowledge
      .record('i_idiom01')
      .change({ mark: 'known', step: 3, reviewDay: '2026-10-11', learned: false }) as Map<
      string,
      string
    >;
    const runOver = (records: Map<string, string>) =>
      run({
        pack: createMemoryContentPort({ categories, words, idioms }),
        on: ['knowledge', 'idioms'],
        records,
      });

    const before = await playAll(await runOver(new Map(history)));
    const after = await playAll(await runOver(new Map([...history, ...due])));

    expect(before.map(({ entry }) => entry.kind)).not.toContain('idiom');
    expect(after.map(({ entry }) => entry.id)).toContain('i_idiom01');
  });

  it('never offers a Hidden idiom as a Distractor, whatever the draw', async () => {
    const hidden = ['i_idiom01', 'i_idiom02'];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = await runWith({ idioms }, undefined, seed);
      for (const entryId of hidden) await app.hide({ kind: 'entry', entryId });

      const played = await playAll(app);

      const shown = played.flatMap((round) => [round.entry, ...offered(round)]).map(({ id }) => id);
      expect(shown.filter((id) => hidden.includes(id))).toEqual([]);
    }
  });

  it('marks the idiom of a wrong answer «Не знаю»', async () => {
    const app = await runWith({ idioms });
    await app.game.start('guess-word');
    const { round } = current(app);
    const asked = offered(round)[rightAmong(round)]?.id ?? '';

    await play(app, false, rightAmong);

    expect(app.knowledge.state.shown.get(asked)).toBe('unknown');
  });

  it('asks no idiom with Idioms out of the Mix or the Feature Switch off, and still plays the Words', async () => {
    const unknown = ['i_idiom01', 'i_idiom02', 'i_idiom03'];
    const outOfMix = await runWith({ words, idioms });
    for (const id of unknown) await outOfMix.knowledge.tap(id, 'unknown');
    await outOfMix.mix.setKind('idiom', false);
    const switchedOff = await runWith({ words, idioms }, ['knowledge']);

    for (const app of [outOfMix, switchedOff]) {
      expect(app.game.state.modes).toEqual([
        { modeId: 'guess-word', entryKind: 'word', canStart: true },
      ]);
      const played = await playAll(app);
      expect(played).toHaveLength(GAME_ROUNDS);
      expect(
        played.flatMap((round) => [round.entry, ...offered(round)]).map(({ kind }) => kind),
      ).not.toContain('idiom');
    }
  });
});

describe('the Synonym Rows «Вгадай слово» asks about', () => {
  const rowOf = (id: string, dominant: string, members: readonly string[]): SynonymRow => ({
    kind: 'synonymRow',
    id,
    dominant: { text: dominant, stress: [0] },
    meaning: `The sense of ${dominant}.`,
    members: members.map((text) => ({ text, stress: [1] })),
    example: { text: `An example of ${dominant}.` },
    sources: [{ title: 'Test source' }],
    retired: false,
  });

  /** Six live rows, two pairs of them sharing a member, and a Retired row. */
  const rows = [
    rowOf('r_go', 'іти', ['простувати', 'чимчикувати', 'шкандибати', 'дибати', 'чалапати']),
    rowOf('r_say', 'говорити', ['мовити', 'казати', 'балакати', 'гомоніти', 'проказувати']),
    rowOf('r_look', 'дивитися', ['глядіти', 'позирати', 'зиркати', 'споглядати', 'видивлятися']),
    rowOf('r_eat', 'їсти', ['споживати', 'трапезувати', 'уминати', 'наминати', 'смакувати']),
    rowOf('r_run', 'бігти', ['мчати', 'гнати', 'летіти', 'чимчикувати', 'дременути']),
    rowOf('r_shout', 'кричати', ['волати', 'горлати', 'репетувати', 'верещати', 'казати']),
    {
      ...rowOf('r_old', 'спати', ['дрімати', 'куняти', 'почивати', 'спочивати', 'ночувати']),
      retired: true,
    },
  ];
  const live = ['r_go', 'r_say', 'r_look', 'r_eat', 'r_run', 'r_shout'];

  /** What a word of a row reads in a Round: its text with its Stress. */
  const shownAs = ({ text, stress }: { text: string; stress: number[] }) =>
    renderStress({ lemma: text, stress });

  /** The row a Round asks about: the one whose dominant is its prompt, if any. */
  const rowOfRound = (round: Round) =>
    rows.find(({ dominant }) => shownAs(dominant) === round.prompt);

  /** The row a Round asks about; fails the test when it asks about a Word. */
  function rowAsked(round: Round): SynonymRow {
    const row = rowOfRound(round);
    if (row === undefined) throw new Error(`No row has the dominant «${round.prompt}»`);
    return row;
  }

  /** The texts of a row as it reads: its dominant and its members. */
  const textsOf = (row: SynonymRow) => [row.dominant, ...row.members].map(shownAs);

  /** The option that names a member of the row asked, or the Word asked. */
  const rightAmong = (round: Round) =>
    rowOfRound(round) !== undefined
      ? round.options.findIndex(({ text }) => rowAsked(round).members.map(shownAs).includes(text))
      : rightOf(round);

  /** The Core composition over a pack of the Words and the rows, with Synonym Rows on. */
  const runWith = ({
    synonymRows = rows,
    on = ['knowledge', 'synonymRows'],
    seed,
    records,
  }: {
    synonymRows?: readonly SynonymRow[];
    on?: readonly FeatureSwitch[];
    seed?: number;
    records?: Map<string, string>;
  } = {}) =>
    run({
      pack: createMemoryContentPort({ categories, words, synonymRows }),
      on,
      ...(records === undefined ? {} : { records }),
      ...(seed === undefined ? {} : { seed }),
    });

  /** Plays «Вгадай слово» to its end, wrong only in the Rounds about the Entries listed. */
  async function playAll(app: Composition, wrongOn: readonly string[] = []) {
    await app.game.start('guess-word');
    while (current(app).status === 'playing') {
      const { round } = current(app);
      const asked = (rowOfRound(round) ?? answerOf(round)).id;
      await play(app, !wrongOn.includes(asked), rightAmong);
    }
    return current(app).played;
  }

  /** Marks the Entries «Не знаю», so the Game asks about up to 5 of them. */
  async function unknown(app: Composition, ids: readonly string[]) {
    for (const id of ids) await app.knowledge.tap(id, 'unknown');
    return app;
  }

  it('asks the dominant of a row with four words, one of them its member, and shows the member with its Example once answered', async () => {
    const app = await unknown(await runWith(), live.slice(0, 5));

    const played = await playAll(app);

    const rowRounds = played.filter(({ entry }) => entry.kind === 'synonymRow');
    expect(rowRounds.map(({ entry }) => entry.id).toSorted()).toEqual(live.slice(0, 5).toSorted());
    for (const { entry, prompt, options, answer } of rowRounds) {
      if (entry.kind !== 'synonymRow') throw new Error(`A Round asked about ${entry.id}`);
      expect(prompt).toBe(shownAs(entry.dominant));
      expect(options).toHaveLength(4);
      const members = options.filter(({ text }) => entry.members.map(shownAs).includes(text));
      expect(members).toEqual([options[answer.correct]]);
      expect(options.every(({ stressedVowels }) => stressedVowels.length === 1)).toBe(true);
      expect(answer.sheet).toEqual({ answer: options[answer.correct], example: entry.example });
    }
  });

  it('marks each Round with the kind of Entry it asks about, so the screen lays out a row Round as one', async () => {
    const app = await unknown(await runWith(), live.slice(0, 5));

    const played = await playAll(app);

    expect(played.some(({ entryKind }) => entryKind === 'synonymRow')).toBe(true);
    expect(played.some(({ entryKind }) => entryKind === 'word')).toBe(true);
    for (const { entry, entryKind } of played) expect(entryKind).toBe(entry.kind);
  });

  it('offers as Distractors only members of other live rows, never a text of the row asked, whatever the draw', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = await unknown(await runWith({ seed }), ['r_go', 'r_say', 'r_run', 'r_shout']);

      const played = await playAll(app);

      const rowRounds = played.filter(({ entry }) => entry.kind === 'synonymRow');
      expect(rowRounds.length).toBeGreaterThanOrEqual(4);
      for (const round of rowRounds) {
        const asked = rowAsked(round);
        const others = rows.filter(({ id }) => live.includes(id) && id !== asked.id);
        const distractors = round.options.filter((_, index) => index !== round.answer.correct);
        expect(new Set(round.options.map(({ text }) => text)).size).toBe(4);
        for (const { text } of distractors) {
          expect(textsOf(asked)).not.toContain(text);
          expect(others.some((row) => row.members.map(shownAs).includes(text))).toBe(true);
        }
      }
    }
  });

  it('plays rows with 4 rows in the Mix, and none with fewer: 3 live rows, or 4 with one Hidden', async () => {
    const four = rows.filter(({ id }) =>
      ['r_go', 'r_say', 'r_look', 'r_eat', 'r_old'].includes(id),
    );
    const three = four.filter(({ id }) => id !== 'r_eat');
    const askedKinds = async (app: Composition) =>
      (await playAll(await unknown(app, live))).map(({ entry }) => entry.kind);
    const hidden = userStateRecords.hiddenEntries
      .record('r_eat')
      .change('2026-10-01T09:00:00.000Z') as Map<string, string>;
    const hiding = await runWith({ synonymRows: four, records: new Map(hidden) });

    expect(await askedKinds(await runWith({ synonymRows: four }))).toContain('synonymRow');
    for (const app of [await runWith({ synonymRows: three }), hiding]) {
      expect(app.game.state.modes).toEqual([
        { modeId: 'guess-word', entryKind: 'word', canStart: true },
      ]);
      const kinds = await askedKinds(app);
      expect(kinds).toHaveLength(GAME_ROUNDS);
      expect(kinds).not.toContain('synonymRow');
    }
  });

  it('marks the row of a wrong answer «Не знаю», and leaves a row answered right unmarked', async () => {
    const app = await runWith({ seed: 3 });

    const played = await playAll(app, ['r_go', 'r_say', 'r_look']);

    const rowRounds = played.filter(({ entry }) => entry.kind === 'synonymRow');
    expect(rowRounds.length).toBeGreaterThan(0);
    for (const { entry, right } of rowRounds) {
      expect(app.knowledge.state.shown.get(entry.id)).toBe(right ? undefined : 'unknown');
    }
    expect(rowRounds.some(({ right }) => !right)).toBe(true);
  });

  it('lists a row Round in the Game Review led by its dominant, expanding into every member, with the wrong pick, to open the row', async () => {
    const app = await unknown(await runWith({ seed: 3 }), live.slice(0, 5));

    const played = await playAll(app, ['r_go', 'r_say']);

    const items = buildGameReview(played);
    const rowItems = items.filter(({ details }) => details.kind === 'synonymRow');
    expect(rowItems.some(({ right }) => right)).toBe(true);
    expect(rowItems.some(({ right }) => !right)).toBe(true);
    for (const item of rowItems) {
      const round = played[item.number - 1];
      if (round?.entry.kind !== 'synonymRow') throw new Error(`Item ${String(item.number)}`);
      const { entry } = round;
      expect(item).toEqual({
        number: round.number,
        entryId: entry.id,
        title: { text: round.prompt, stressedVowels: [expect.any(String)] },
        right: !['r_go', 'r_say'].includes(entry.id),
        picked: round.right ? undefined : round.options[round.answer.chosen],
        details: {
          kind: 'synonymRow',
          members: entry.members.map((member) => ({
            text: shownAs(member),
            stressedVowels: [expect.any(String)],
          })),
        },
      });
    }
  });

  it('asks no row with Synonym Rows out of the Mix or the Feature Switch off, and still plays the Words', async () => {
    const outOfMix = await unknown(await runWith(), live);
    await outOfMix.mix.setKind('synonymRow', false);
    const switchedOff = await unknown(await runWith({ on: ['knowledge'] }), live);

    for (const app of [outOfMix, switchedOff]) {
      const played = await playAll(app);
      expect(played).toHaveLength(GAME_ROUNDS);
      expect(played.map(({ entry }) => entry.kind)).not.toContain('synonymRow');
    }
  });
});

describe('the Tips «Вгадай слово» asks about', () => {
  const tipOf = (id: string, withExample = true): Tip => ({
    kind: 'tip',
    id,
    title: `The rule of ${id}`,
    standardForm: `The right way of ${id}`,
    explanation: `Why ${id} is said so.`,
    ...(withExample ? { example: { text: `An example of ${id}.` } } : {}),
    sources: [{ title: 'Test source' }],
    gameQuestion: {
      prompt: `How is ${id} said?`,
      rightAnswer: `${id}: right`,
      wrongAnswers: [`${id}: wrong 1`, `${id}: wrong 2`, `${id}: wrong 3`],
    },
    retired: false,
  });

  /** Five live Tips, one with no Example, and a Retired Tip. */
  const tips = [
    tipOf('t_time'),
    tipOf('t_greet', false),
    tipOf('t_comma'),
    tipOf('t_apology'),
    tipOf('t_thanks'),
    { ...tipOf('t_old'), retired: true },
  ];
  const live = ['t_time', 't_greet', 't_comma', 't_apology', 't_thanks'];

  /** The Tip a Round asks about: the one whose own question is its prompt, if any. */
  const tipOfRound = (round: Round) =>
    tips.find(({ gameQuestion }) => gameQuestion.prompt === round.prompt);

  /** The option that names the right answer of the Tip asked, or the Word asked. */
  const rightAmong = (round: Round) => {
    const tip = tipOfRound(round);
    return tip === undefined
      ? rightOf(round)
      : round.options.findIndex(({ text }) => text === tip.gameQuestion.rightAnswer);
  };

  /** The Core composition over a pack of the Words and the Tips, with Tips on. */
  const runWith = ({
    on = ['knowledge', 'tips'],
    seed,
  }: { on?: readonly FeatureSwitch[]; seed?: number } = {}) =>
    run({
      pack: createMemoryContentPort({ categories, words, tips }),
      on,
      ...(seed === undefined ? {} : { seed }),
    });

  /** Plays «Вгадай слово» to its end, wrong only in the Rounds about the Entries listed. */
  async function playAll(app: Composition, wrongOn: readonly string[] = []) {
    await app.game.start('guess-word');
    while (current(app).status === 'playing') {
      const { round } = current(app);
      const asked = (tipOfRound(round) ?? answerOf(round)).id;
      await play(app, !wrongOn.includes(asked), rightAmong);
    }
    return current(app).played;
  }

  /** Marks the Entries «Не знаю», so the Game asks about up to 5 of them. */
  async function unknown(app: Composition, ids: readonly string[]) {
    for (const id of ids) await app.knowledge.tap(id, 'unknown');
    return app;
  }

  it('asks a Tip its own question with its four answers, exactly one right, and shows the right answer with its Example once answered', async () => {
    const app = await unknown(await runWith(), live);

    const played = await playAll(app);

    const tipRounds = played.filter(({ entry }) => entry.kind === 'tip');
    expect(tipRounds.map(({ entry }) => entry.id).toSorted()).toEqual(live.toSorted());
    for (const { entry, prompt, options, answer } of tipRounds) {
      if (entry.kind !== 'tip') throw new Error(`A Round asked about ${entry.id}`);
      const { gameQuestion } = entry;
      expect(prompt).toBe(gameQuestion.prompt);
      expect(options.map(({ text }) => text).toSorted()).toEqual(
        [gameQuestion.rightAnswer, ...gameQuestion.wrongAnswers].toSorted(),
      );
      expect(options.filter(({ text }) => text === gameQuestion.rightAnswer)).toEqual([
        options[answer.correct],
      ]);
      expect(options.every(({ stressedVowels }) => stressedVowels.length === 0)).toBe(true);
      expect(answer.sheet).toEqual({ answer: options[answer.correct], example: entry.example });
    }
  });

  it('marks each Round with the kind of Entry it asks about, so the screen lays out a Tip Round as one', async () => {
    const app = await unknown(await runWith(), live);
    await app.game.start('guess-word');

    const kinds = new Set<string>();
    while (current(app).status === 'playing') {
      const { round } = current(app);
      kinds.add(round.entryKind);
      expect(round.entryKind).toBe(tipOfRound(round) === undefined ? 'word' : 'tip');
      await play(app, true, rightAmong);
    }
    expect([...kinds].toSorted()).toEqual(['tip', 'word']);
  });

  it('shuffles the four answers with the injected randomness', async () => {
    const places = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = await unknown(await runWith({ seed }), live);
      for (const { entry, answer } of await playAll(app)) {
        if (entry.kind === 'tip') places.add(answer.correct);
      }
    }

    expect(places.size).toBeGreaterThan(1);
  });

  it('marks the Tip of a wrong answer «Не знаю», and leaves a Tip answered right unmarked', async () => {
    const app = await runWith({ seed: 3 });

    const played = await playAll(app, ['t_time', 't_greet', 't_comma']);

    const tipRounds = played.filter(({ entry }) => entry.kind === 'tip');
    expect(tipRounds.length).toBeGreaterThan(0);
    for (const { entry, right } of tipRounds) {
      expect(app.knowledge.state.shown.get(entry.id)).toBe(right ? undefined : 'unknown');
    }
    expect(tipRounds.some(({ right }) => !right)).toBe(true);
  });

  it('lists a Tip Round in the Game Review led by its title, expanding into its explanation, with the wrong pick, to open the Tip', async () => {
    const app = await unknown(await runWith({ seed: 3 }), live);

    const played = await playAll(app, ['t_time', 't_greet']);

    const items = buildGameReview(played);
    const tipItems = items.filter(({ details }) => details.kind === 'tip');
    expect(tipItems).toHaveLength(live.length);
    expect(tipItems.filter(({ right }) => !right)).toHaveLength(2);
    for (const item of tipItems) {
      const round = played[item.number - 1];
      if (round?.entry.kind !== 'tip') throw new Error(`Item ${String(item.number)}`);
      const { entry } = round;
      expect(item).toEqual({
        number: round.number,
        entryId: entry.id,
        title: { text: entry.title, stressedVowels: [] },
        right: !['t_time', 't_greet'].includes(entry.id),
        picked: round.right ? undefined : round.options[round.answer.chosen],
        details: { kind: 'tip', explanation: entry.explanation },
      });
    }
    for (const { picked } of tipItems) {
      if (picked !== undefined) expect(picked.text).toMatch(/: wrong \d$/);
    }
  });

  it('asks no Tip with Tips out of the Mix or the Feature Switch off, and still plays the Words', async () => {
    const outOfMix = await unknown(await runWith(), live);
    await outOfMix.mix.setKind('tip', false);
    const switchedOff = await unknown(await runWith({ on: ['knowledge'] }), live);

    for (const app of [outOfMix, switchedOff]) {
      const played = await playAll(app);
      expect(played).toHaveLength(GAME_ROUNDS);
      expect(played.map(({ entry }) => entry.kind)).not.toContain('tip');
    }
  });
});

describe('the rules of a Game', () => {
  it('answers a Round once: a second answer changes nothing', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const right = rightOf(current(app).round);
    void app.game.answer(right);
    const answered = app.game.state;

    void app.game.answer((right + 1) % 4);

    expect(app.game.state).toBe(answered);
    expect(current(app)).toMatchObject({ lives: 5, status: 'answered' });
  });

  it('takes a Life for a wrong answer at once, before «Далі»', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const right = rightOf(current(app).round);

    void app.game.answer((right + 1) % 4);

    expect(current(app)).toMatchObject({ lives: 4, roundsPassed: 0, status: 'answered' });
    expect(current(app).round.answer).toMatchObject({ chosen: (right + 1) % 4, correct: right });
  });

  it('counts a Round passed on «Далі», right or wrong, and moves to the next Round', async () => {
    const app = await run();
    await app.game.start('guess-word');

    await play(app, true);
    expect(current(app)).toMatchObject({ roundsPassed: 1, lives: 5, status: 'playing' });
    expect(current(app).round).toMatchObject({ number: 2, answer: undefined });

    await play(app, false);
    expect(current(app)).toMatchObject({ roundsPassed: 2, lives: 4, status: 'playing' });
    expect(current(app).round.number).toBe(3);
  });

  it('does nothing on «Далі» before the Round is answered', async () => {
    const app = await run();
    await app.game.start('guess-word');
    const playing = app.game.state;

    await app.game.next();

    expect(app.game.state).toBe(playing);
  });

  it('is won after the 15th Round, with 15 Rounds passed and every Life', async () => {
    const app = await run();

    const rounds = await playGame(app);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 5, status: 'won' });
  });

  it('is won after the 15th Round with mistakes, as long as a Life is left', async () => {
    const app = await run();

    await playGame(app, [2, 6, 7, 15]);

    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 1, status: 'won' });
  });

  it.each([5, 9, 15])(
    'is lost when the fifth Life goes in Round %i, which is not counted as passed',
    async (lastRound) => {
      const app = await run();
      const wrong = [4, 3, 2, 1, 0].map((before) => lastRound - before);

      const rounds = await playGame(app, wrong);

      expect(rounds).toHaveLength(lastRound);
      expect(current(app)).toMatchObject({
        roundsPassed: lastRound - 1,
        lives: 0,
        status: 'lost',
      });
    },
  );

  it('ends a Game that lost its fifth Life only on «Далі»: the answered Round stays until then', async () => {
    const app = await run();
    await app.game.start('guess-word');
    for (let round = 1; round <= 4; round += 1) await play(app, false);
    const { round } = current(app);
    void app.game.answer((rightOf(round) + 1) % 4);

    expect(current(app)).toMatchObject({ lives: 0, roundsPassed: 4, status: 'answered' });
    await app.game.next();
    expect(current(app)).toMatchObject({ lives: 0, roundsPassed: 4, status: 'lost' });
  });

  it("lists every played Round in order with its Entry, the reader's pick and whether it was right", async () => {
    const app = await run();

    const rounds = await playGame(app, [2, 5]);

    const { played } = current(app);
    expect(played).toHaveLength(GAME_ROUNDS);
    expect(played.map(({ number }) => number)).toEqual(rounds.map(({ number }) => number));
    played.forEach((entry, index) => {
      const round = rounds[index];
      if (round === undefined) throw new Error(`No Round was shown at place ${String(index)}`);
      const wrong = [2, 5].includes(round.number);
      expect(entry.entry).toEqual(answerOf(round));
      expect(entry.right).toBe(!wrong);
      expect(entry.answer.correct).toBe(rightOf(round));
      expect(entry.answer.chosen).toBe(wrong ? (rightOf(round) + 1) % 4 : rightOf(round));
      expect(entry.options).toEqual(round.options);
    });
  });

  it('lists the Round that cost the last Life as the last played Round of a lost Game', async () => {
    const app = await run();
    await app.game.start('guess-word');
    for (let round = 1; round <= 5; round += 1) await play(app, false);

    const { played, status } = current(app);

    expect(status).toBe('lost');
    expect(played.map(({ number, right }) => [number, right])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
      [5, false],
    ]);
  });

  it('lists the Rounds answered so far while the Game is in play, and none before the first answer', async () => {
    const app = await run();
    await app.game.start('guess-word');
    expect(current(app).played).toEqual([]);

    await play(app, true);
    void app.game.answer((rightOf(current(app).round) + 1) % 4);

    expect(current(app).played.map(({ number, right }) => [number, right])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('starts a new Game with no played Rounds', async () => {
    const app = await run();
    await playGame(app);

    await app.game.start('guess-word');

    expect(current(app).played).toEqual([]);
  });

  it('asks 15 different Words in one Game', async () => {
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });

      const answers = (await playGame(app)).map((round) => answerOf(round).id);

      expect(new Set(answers).size).toBe(GAME_ROUNDS);
    }
  });

  it('takes no answer and no «Далі» once the Game is over, and «Ще раз» starts a new one', async () => {
    const app = await run();
    await playGame(app);
    const over = app.game.state;

    void app.game.answer(0);
    await app.game.next();
    expect(app.game.state).toBe(over);

    await app.game.start('guess-word');

    expect(current(app)).toMatchObject({ roundsPassed: 0, lives: 5, status: 'playing' });
    expect(current(app).round.number).toBe(1);
  });

  it("shows the mode screen, saying why, when «Ще раз» finds the mode can't start any more", async () => {
    const app = await run();
    await playGame(app);
    // Nature alone, with three of its Words hidden, leaves 14.
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });
    for (const entryId of ['w_nnoun01', 'w_nnoun02', 'w_nnoun03']) {
      await app.hide({ kind: 'entry', entryId });
    }

    await app.game.start('guess-word');

    expect(app.game.state).toEqual({
      modes: [
        { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
      ],
      current: undefined,
      bestResult: 15,
    });
  });

  it('goes back to the mode screen when the reader leaves a finished Game', async () => {
    const app = await run();
    await playGame(app);

    app.game.leave();

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);
  });

  it('drops a Game left midway, in a Round or after an answer, and shows the mode screen', async () => {
    const app = await run();
    await app.game.start('guess-word');
    await play(app, false);

    app.game.leave();
    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);

    await app.game.start('guess-word');
    void app.game.answer(0);
    expect(current(app).status).toBe('answered');

    app.game.leave();
    expect(app.game.state.current).toBeUndefined();
  });

  it('takes no answer and no «Далі» for a Game that was left', async () => {
    const app = await run();
    await app.game.start('guess-word');
    app.game.leave();
    const modeScreen = app.game.state;

    void app.game.answer(0);
    await app.game.next();

    expect(app.game.state).toBe(modeScreen);
  });

  it('writes nothing to the user state when a Game is left, and allows a new Game from the start', async () => {
    const { port, writes } = recordingPort(new Map());
    const app = await run({ port });
    await app.game.start('guess-word');
    await play(app, false);
    await play(app, false);
    writes.length = 0;

    app.game.leave();
    await app.game.start('guess-word');

    expect(writes).toEqual([]);
    expect(current(app)).toMatchObject({
      roundsPassed: 0,
      lives: GAME_LIVES,
      status: 'playing',
      round: { number: 1, answer: undefined },
    });
  });

  it('tells its subscribers when a Game is left, and not when there is none', async () => {
    const app = await run();
    let changes = 0;
    app.game.subscribe(() => {
      changes += 1;
    });

    app.game.leave();
    expect(changes).toBe(0);

    await app.game.start('guess-word');
    app.game.leave();
    expect(changes).toBe(2);
  });

  it('tells its subscribers of every change', async () => {
    const app = await run();
    let changes = 0;
    app.game.subscribe(() => {
      changes += 1;
    });

    await app.game.start('guess-word');
    void app.game.answer(0);
    await app.game.next();

    expect(changes).toBe(3);
  });
});

describe('the Words a Game asks about', () => {
  const met = numbered('w_nnoun', 14).concat('w_snoun03');

  it('asks only Words in History once 15 eligible ones are there, with Distractors from every eligible Word', async () => {
    const app = await run({ records: historyOf(met) });

    const rounds = await playGame(app);

    expect(rounds.map((round) => answerOf(round).id).toSorted()).toEqual(met.toSorted());
    const distractors = rounds.flatMap((round) =>
      optionWordsOf(round).filter((option) => option !== answerOf(round)),
    );
    expect(distractors.some((distractor) => !met.includes(distractor.id))).toBe(true);
  });

  it('keeps asking the Words in History in a new Cycle with nothing Seen yet', async () => {
    const records = new Map([
      ...historyOf(met),
      ...(userStateRecords.cycle.change({ id: 4, seed: 99 }) as Map<string, string>),
    ]);
    const app = await run({ records });

    const rounds = await playGame(app);

    expect(rounds.every((round) => met.includes(answerOf(round).id))).toBe(true);
  });

  it('asks every eligible Word while fewer than 15 eligible ones are in History', async () => {
    const app = await run({ records: historyOf(met) });
    // One of the 15 Hidden leaves 14 eligible Words in History.
    await app.hide({ kind: 'entry', entryId: 'w_snoun03' });

    const rounds = await playGame(app);

    expect(rounds.some((round) => !met.includes(answerOf(round).id))).toBe(true);
    expect(rounds.some((round) => answerOf(round).id === 'w_snoun03')).toBe(false);
  });

  it('never asks about or offers a Hidden Entry, a Word of a Hidden Category or a Retired Word', async () => {
    const left = ['w_nnoun01', 'w_cnoun01', 'w_cnoun02', 'w_cnoun03', 'w_retired'];
    for (const seed of [1, 2, 3, 4]) {
      const app = await run({ seed });
      await app.hide({ kind: 'entry', entryId: 'w_nnoun01' });
      await app.hide({ kind: 'category', categoryId: 'crafts' });

      for (const round of await playGame(app)) {
        const shown = optionWordsOf(round).map((option) => option.id);
        expect(shown.filter((id) => left.includes(id))).toEqual([]);
      }
    }
  });

  it('never asks about or offers a Word below the Rarity Floor', async () => {
    // 16 Words of rarity 4 and 5 over the pack's Words, all of rarity 3.
    const rare = numbered('w_rare', 16).map((id) =>
      word(id, 'crafts', { rarity: id.endsWith('1') ? 5 : 4 }),
    );
    const pack = createMemoryContentPort({ categories, words: [...words, ...rare] });
    const rareReading = (text: string) => rare.find((w) => renderStress(w) === text);
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed, pack });
      await app.mix.setRarityFloor(4);

      await app.game.start('guess-word');
      while (current(app).status === 'playing') {
        const { round } = current(app);
        expect(round.options.every(({ text }) => rareReading(text) !== undefined)).toBe(true);
        const right = round.options.findIndex(
          ({ text }) => rareReading(text)?.primaryDefinition === round.prompt,
        );
        expect(right).not.toBe(-1);
        void app.game.answer(right);
        await app.game.next();
      }
    }
  });

  it('never asks about or offers an Entry hidden during the Game in the Rounds after', async () => {
    for (const seed of [1, 2, 3]) {
      const app = await run({ seed });
      await app.game.start('guess-word');
      await play(app, true);
      const hiddenWord = optionWordsOf(current(app).round)[0]?.id ?? '';
      await app.hide({ kind: 'category', categoryId: 'speech' });
      await app.hide({ kind: 'entry', entryId: hiddenWord });

      const later: Round[] = [];
      while (current(app).status === 'playing') {
        await play(app, true);
        if (current(app).status === 'playing') later.push(current(app).round);
      }

      expect(later).toHaveLength(GAME_ROUNDS - 2);
      for (const round of later) {
        const shown = optionWordsOf(round);
        expect(shown.filter((w) => w.categoryId === 'speech' || w.id === hiddenWord)).toEqual([]);
      }
    }
  });

  it('writes no Seen, no History and no Active Day while it is played, only its best result', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    // The knowledge Feature Switch off, so no mistake writes a «Не знаю» mark.
    const app = await run({ port, on: ['rarityFloor'] });
    writes.length = 0;

    await playGame(app, [3, 4]);
    await playGame(app, [1, 2, 3, 4, 5]);

    expect(writes).toEqual([userStateRecords.gameBest.change(15)]);
    expect(app.history.list).toEqual([]);
  });
});

// Spec #461, ADR 0043: up to 5 of the 15 Rounds ask about Entries the reader is weak on.
describe('the Rounds about Entries marked «Не знаю» or due', () => {
  const unknown = numbered('w_nnoun', 8);

  /** The Words the Rounds ask about, in order. */
  const asked = (rounds: readonly Round[]) => rounds.map((round) => answerOf(round).id);

  it('asks 5 of 8 Words marked «Не знаю», and no more of them', async () => {
    const app = await run();
    for (const id of unknown) await app.knowledge.tap(id, 'unknown');

    const ids = asked(await playGame(app));

    expect(ids.filter((id) => unknown.includes(id))).toHaveLength(5);
    expect(new Set(ids).size).toBe(GAME_ROUNDS);
  });

  it('asks both of 2 Words marked «Не знаю», the rest from History as before', async () => {
    const met = numbered('w_nnoun', 14).concat('w_snoun03');
    const app = await run({ records: historyOf(met) });
    await app.knowledge.tap('w_cnoun01', 'unknown');
    await app.knowledge.tap('w_cnoun02', 'unknown');

    const ids = asked(await playGame(app));

    expect(ids.filter((id) => !met.includes(id)).toSorted()).toEqual(['w_cnoun01', 'w_cnoun02']);
  });

  it('asks a Word due for Review today, Known on its 1-day Review before', async () => {
    const records = new Map(
      userStateRecords.knowledge
        .record('w_cnoun01')
        .change({ mark: 'known', step: 3, reviewDay: '2026-10-11', learned: false }) as Map<
        string,
        string
      >,
    );
    const app = await run({
      records: new Map([...historyOf(numbered('w_nnoun', 14).concat('w_snoun03')), ...records]),
    });

    expect(asked(await playGame(app))).toContain('w_cnoun01');
  });

  /** The records of one app run, in which the reader marks what `mark` says; a later run finds its Cycle and draws alike. */
  async function marked(mark?: (app: Composition) => Promise<void>) {
    const records = new Map<string, string>();
    const app = await run({ records });
    if (mark !== undefined) await mark(app);
    return records;
  }

  it('plans the Rounds as before without a mark, with Learned Words only, and with the knowledge Feature Switch off', async () => {
    const before = asked(
      await playGame(await run({ records: await marked(), on: ['rarityFloor'] })),
    );

    expect(asked(await playGame(await run({ records: await marked() })))).toEqual(before);

    const learned = await marked(async (app) => {
      await app.knowledge.tap('w_nnoun01', 'known');
      await app.knowledge.tap('w_nnoun02', 'known');
    });
    expect(asked(await playGame(await run({ records: learned })))).toEqual(before);

    const unknownOff = await marked(async (app) => {
      for (const id of unknown) await app.knowledge.tap(id, 'unknown');
    });
    expect(asked(await playGame(await run({ records: unknownOff, on: ['rarityFloor'] })))).toEqual(
      before,
    );
  });
});

// Spec #461, ADR 0043: a wrong answer marks the Entry «Не знаю»; a right one changes nothing.
describe('the Knowledge Marks a Game leaves', () => {
  const tomorrow: Clock = { ...clock, now: () => new Date('2026-10-12T09:00:00+03:00') };

  /** A record of `w_cnoun01` on its 3-day Review, due today, so a Game asks about it, with History enough. */
  function dueOnThreeDays(): Map<string, string> {
    const record = userStateRecords.knowledge
      .record('w_cnoun01')
      .change({ mark: 'known', step: 3, reviewDay: '2026-10-11', learned: false }) as Map<
      string,
      string
    >;
    return new Map([...historyOf(numbered('w_nnoun', 14).concat('w_snoun03')), ...record]);
  }

  /** The «Вчу» list as the Entries and the local days until their Review. */
  const learningOf = (app: Composition) =>
    app.knowledge.state.learning.map(({ entryId, daysUntilReview }) => [entryId, daysUntilReview]);

  /** Plays «Вгадай слово» to its end, wrong only in the Round that asks about the Word. */
  async function playWrongOn(app: Composition, wordId: string): Promise<void> {
    await app.game.start('guess-word');
    while (current(app).status === 'playing') {
      await play(app, answerOf(current(app).round).id !== wordId);
    }
  }

  it('marks the Word of a wrong answer «Не знаю», due for Review tomorrow', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.game.start('guess-word');
    const asked = answerOf(current(app).round).id;

    await play(app, false);

    expect(app.knowledge.state.shown.get(asked)).toBe('unknown');
    expect(learningOf(app)).toEqual([[asked, 1]]);
    expect(app.knowledge.state.due).toEqual([]);
    expect((await run({ records, time: tomorrow })).knowledge.state.due).toEqual([asked]);
  });

  it('starts the Review of a Word answered wrong again at 1 day', async () => {
    const app = await run({ records: dueOnThreeDays() });

    await playWrongOn(app, 'w_cnoun01');

    expect(app.knowledge.state.shown.get('w_cnoun01')).toBe('unknown');
    expect(learningOf(app)).toEqual([['w_cnoun01', 1]]);
    expect(app.knowledge.state.known.word).toBe(0);
  });

  it('leaves every record as it was after right answers', async () => {
    const app = await run({ records: dueOnThreeDays() });

    const rounds = await playGame(app);

    expect(rounds.map((round) => answerOf(round).id)).toContain('w_cnoun01');
    expect(learningOf(app)).toEqual([['w_cnoun01', 0]]);
    expect(app.knowledge.state).toMatchObject({ known: { word: 1 }, due: ['w_cnoun01'] });
  });

  it('goes on to the next Round when the «Не знаю» mark fails to write, and reports the failure', async () => {
    const memory = createMemoryUserStatePort(new Map());
    let failing = false;
    const app = await run({
      port: {
        ...memory,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : memory.write(changes),
      },
    });
    await app.game.start('guess-word');
    const asked = answerOf(current(app).round).id;

    failing = true;
    const { round } = current(app);
    await expect(app.game.answer((rightOf(round) + 1) % 4)).rejects.toThrow('The disk is full');
    await app.game.next();

    expect(current(app)).toMatchObject({ lives: 4, roundsPassed: 1, status: 'playing' });
    expect(app.knowledge.state.shown.get(asked)).toBeUndefined();
    expect(learningOf(app)).toEqual([]);
  });

  it('marks nothing with the knowledge Feature Switch off, and keeps the records there are', async () => {
    const records = dueOnThreeDays();
    const app = await run({ records, on: ['rarityFloor'] });

    await playGame(app, [1, 2, 3, 4, 5]);
    await playWrongOn(app, 'w_cnoun01');

    const on = await run({ records });
    expect(learningOf(on)).toEqual([['w_cnoun01', 0]]);
    expect(on.knowledge.state).toMatchObject({ known: { word: 1 }, due: ['w_cnoun01'] });
  });
});

// Spec #215, "Best result": the most Rounds passed in one finished Game, in any Game Mode.
describe('the best result', () => {
  const { gameBest } = userStateRecords;

  it('is absent at first, on the Game and in the progress snapshot', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    expect(app.game.state.bestResult).toBeUndefined();
    expect(app.progress.state.bestResult).toBeUndefined();
    expect(records.has(gameBest.key)).toBe(false);
  });

  it('is written by the first finished Game, even the shortest loss', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await playGame(app, [1, 2, 3, 4, 5]);

    expect(current(app)).toMatchObject({ roundsPassed: 4, status: 'lost' });
    expect(app.game.state.bestResult).toBe(4);
    expect(gameBest.decode(records.get(gameBest.key))).toBe(4);
  });

  it('is written by a finished Game that beats it, won or lost, and unchanged by one that does not', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    // The knowledge Feature Switch off, so no mistake writes a «Не знаю» mark.
    const app = await run({ port, on: ['rarityFloor'] });
    writes.length = 0;

    // Lost in Round 8: 7 Rounds passed.
    await playGame(app, [3, 5, 6, 7, 8]);
    expect(app.game.state.bestResult).toBe(7);
    // Lost in Round 5: 4 Rounds passed, fewer than 7.
    await playGame(app, [1, 2, 3, 4, 5]);
    expect(app.game.state.bestResult).toBe(7);
    // Lost in Round 8 again: as many as 7, which doesn't beat it.
    await playGame(app, [1, 2, 3, 4, 8]);
    expect(app.game.state.bestResult).toBe(7);
    await playGame(app, [2]);
    expect(app.game.state.bestResult).toBe(15);

    expect(writes).toEqual([gameBest.change(7), gameBest.change(15)]);
    expect(gameBest.decode(records.get(gameBest.key))).toBe(15);
  });

  it('shows the Game just finished in the best result of the same snapshot', async () => {
    const app = await run({ records: gameBest.change(3) as Map<string, string> });
    const finished: { roundsPassed: number; bestResult: number | undefined }[] = [];
    app.game.subscribe(() => {
      const { current: game, bestResult } = app.game.state;
      if (game?.status === 'won' || game?.status === 'lost') {
        finished.push({ roundsPassed: game.roundsPassed, bestResult });
      }
    });

    await playGame(app, [9, 10, 11, 12, 13]);
    await playGame(app, [1, 2, 3, 4, 5]);

    expect(finished).toEqual([
      { roundsPassed: 12, bestResult: 12 },
      { roundsPassed: 4, bestResult: 12 },
    ]);
  });

  it('is never written by a Game left before its end', async () => {
    const records = new Map<string, string>();
    const { port, writes } = recordingPort(records);
    // The knowledge Feature Switch off, so no mistake writes a «Не знаю» mark.
    const app = await run({ port, on: ['rarityFloor'] });
    writes.length = 0;
    await app.game.start('guess-word');
    for (let round = 1; round <= 10; round += 1) await play(app, true);
    // The fifth Life lost, but «Далі» not tapped: the Game isn't over yet.
    await app.game.start('guess-word');
    for (let round = 1; round <= 4; round += 1) await play(app, false);
    void app.game.answer((rightOf(current(app).round) + 1) % 4);

    app.game.leave();

    expect(writes).toEqual([]);
    expect(app.game.state.bestResult).toBeUndefined();
  });

  it('keeps the Game as it was when the record fails to write, and finishes it on the next «Далі»', async () => {
    const records = new Map<string, string>();
    const memory = createMemoryUserStatePort(records);
    let failing = false;
    const app = await run({
      port: {
        ...memory,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : memory.write(changes),
      },
    });
    await app.game.start('guess-word');
    for (let round = 1; round <= 4; round += 1) await play(app, false);
    await app.game.answer((rightOf(current(app).round) + 1) % 4);
    const answered = app.game.state;

    failing = true;
    await expect(app.game.next()).rejects.toThrow('The disk is full');
    expect(app.game.state).toBe(answered);

    failing = false;
    await app.game.next();
    expect(current(app)).toMatchObject({ roundsPassed: 4, status: 'lost' });
    expect(app.game.state.bestResult).toBe(4);
    expect(gameBest.decode(records.get(gameBest.key))).toBe(4);
  });

  it('survives reopening, a new Cycle and a cleared History', async () => {
    const records = new Map<string, string>();
    await playGame(await run({ records }), [3, 5, 6, 7, 8]);
    let now = new Date('2026-10-12T09:00:00+03:00').getTime();
    const time: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
    const app = await run({ records, time });
    expect(app.game.state.bestResult).toBe(7);

    // Read every card, then the card after the end-of-Cycle card starts a new Cycle.
    while (app.feed.cards.at(-1)?.kind !== 'end-of-cycle') {
      await app.feed.show(app.feed.cards.length - 1);
      now += SEEN_DWELL_MS;
      await app.feed.show(undefined);
    }
    await app.feed.show(app.feed.cards.length - 1);
    await app.feed.show(undefined);
    await app.history.clear();

    expect(app.history.list).toEqual([]);
    expect(app.game.state.bestResult).toBe(7);
    expect(app.progress.state.bestResult).toBe(7);
    const reopened = await run({ records, time });
    expect(reopened.game.state.bestResult).toBe(7);
    expect(reopened.progress.state.bestResult).toBe(7);
  });

  it('shows in the progress snapshot, which tells its subscribers when it changes', async () => {
    const app = await run();
    const before = app.progress.state;
    let told = 0;
    app.progress.subscribe(() => {
      told += 1;
    });

    await playGame(app, [3, 5, 6, 7, 8]);

    expect(app.progress.state).toEqual({ ...before, bestResult: 7 });
    expect(told).toBe(1);
  });

  it('is absent on the Game and in the progress snapshot when the Edition turns the Game off', async () => {
    const app = await run({ records: gameBest.change(13) as Map<string, string>, game: false });

    expect(app.game.state.bestResult).toBeUndefined();
    expect(app.progress.state.bestResult).toBeUndefined();
  });
});

/** A Game Mode that asks for a Word's Lemma among three made-up ones, the answer always first. */
const lemmaMode: GameMode = {
  id: 'test-lemma',
  entryKind: 'word',
  isOn: () => true,
  buildRound: ({ answer }) => {
    if (answer.kind !== 'word') return undefined;
    const option = (text: string) => ({ text, stressedVowels: [] });
    return {
      prompt: answer.id,
      options: [option(answer.lemma), option('one'), option('two'), option('three')],
      correct: 0,
      sheet: { answer: option(answer.lemma), example: undefined },
    };
  },
};

describe('the Game Mode Extension Point', () => {
  it('plays a full Game in a Game Mode registered through it, after the Core modes', async () => {
    const app = await run({ gameModes: [lemmaMode] });
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: true },
    ]);

    await app.game.start('test-lemma');
    const prompts: string[] = [];
    while (current(app).status === 'playing') {
      prompts.push(current(app).round.prompt);
      await play(app, current(app).round.number !== 3, () => 0);
    }

    expect(current(app)).toMatchObject({
      modeId: 'test-lemma',
      roundsPassed: 15,
      lives: 4,
      status: 'won',
    });
    expect(new Set(prompts).size).toBe(GAME_ROUNDS);
  });

  it('leaves out a Game Mode the Edition turns off', async () => {
    const app = await run({ gameModes: [{ ...lemmaMode, isOn: () => false }] });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
    ]);
  });

  it("says a Game Mode that can't make its Rounds can't start, before a start and after it", async () => {
    const app = await run({ gameModes: [{ ...lemmaMode, buildRound: () => undefined }] });
    const offers = [
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ];
    expect(app.game.state.modes).toEqual(offers);

    await app.game.start('test-lemma');

    expect(app.game.state.current).toBeUndefined();
    expect(app.game.state.modes).toEqual(offers);
  });

  it('carries the Entry kind of a registered mode in its offer, with the refusal of that kind', async () => {
    const app = await run({
      gameModes: [{ ...lemmaMode, id: 'test-correction', entryKind: 'correction' }],
    });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      {
        modeId: 'test-correction',
        entryKind: 'correction',
        canStart: false,
        refusal: 'corrections-out-of-mix',
      },
    ]);
  });

  it("says a registered mode can't start with fewer than 15 eligible Entries of its kind", async () => {
    const app = await run({ gameModes: [lemmaMode] });
    await app.hide({ kind: 'category', categoryId: 'nature' });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
  });

  it('refuses two Game Modes with one id', async () => {
    await expect(run({ gameModes: [{ ...lemmaMode, id: 'guess-word' }] })).rejects.toThrow(
      'guess-word',
    );
  });
});

describe('whether a Game Mode can start', () => {
  /**
   * A Game Mode that can make a fair Round only of a noun, so it may have 15
   * eligible Words and still too few Rounds.
   */
  const nounMode: GameMode = {
    ...lemmaMode,
    id: 'test-noun',
    buildRound: (input) =>
      input.answer.kind === 'word' && input.answer.partOfSpeech === 'noun'
        ? lemmaMode.buildRound(input)
        : undefined,
  };

  /** The mode's offer, and whether a start in it begins a Game; the Game is left after. */
  async function offerAndStart(app: Composition) {
    const offer = app.game.state.modes.find(({ modeId }) => modeId === 'test-noun');
    await app.game.start('test-noun');
    const started = app.game.state.current !== undefined;
    app.game.leave();
    return { offer, started };
  }

  it('says the offers are still planned just after the Game opens, and a start waits for them', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // The Game alone reads the Words in full, so only its planning waits.
    const pack: ContentReadPort = {
      ...content,
      async listWords() {
        await gate;
        return content.listWords();
      },
    };
    const app = await run({
      pack,
      planned: false,
      gameModes: [{ ...lemmaMode, buildRound: () => undefined }],
    });

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: false, planning: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, planning: true },
    ]);
    const start = app.game.start('guess-word');
    release();
    await start;

    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'test-lemma', entryKind: 'word', canStart: false, refusal: 'too-few-entries' },
    ]);
    expect(current(app)).toMatchObject({ modeId: 'guess-word', status: 'playing' });
  });

  it("refuses a mode on its offer, before any start, when it can't make 15 fair Rounds", async () => {
    const app = await run({ gameModes: [nounMode] });
    // Nature alone: 17 eligible Words, of them 14 nouns.
    await app.hide({ kind: 'category', categoryId: 'speech' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    expect(await offerAndStart(app)).toEqual({
      offer: {
        modeId: 'test-noun',
        entryKind: 'word',
        canStart: false,
        refusal: 'too-few-entries',
      },
      started: false,
    });
  });

  it('offers what a start then does, after a hide, a restore and a Mix change', async () => {
    const app = await run({ gameModes: [nounMode] });
    const canStart = { modeId: 'test-noun', entryKind: 'word', canStart: true };
    const refused = { ...canStart, canStart: false, refusal: 'too-few-entries' };
    // Without Speech, the Mix holds 17 nouns among 20 Words.
    await app.mix.takeOut('speech');
    expect(await offerAndStart(app)).toEqual({ offer: canStart, started: true });

    // 14 nouns among 17 Words.
    for (const entryId of ['w_nnoun01', 'w_nnoun02', 'w_nnoun03']) {
      await app.hide({ kind: 'entry', entryId });
    }
    expect(await offerAndStart(app)).toEqual({ offer: refused, started: false });
    // A refused start changes nothing a later change reads differently.
    await app.hide({ kind: 'entry', entryId: 'w_nadj01' });
    expect(await offerAndStart(app)).toEqual({ offer: refused, started: false });

    // 15 nouns among 16 Words.
    await app.unhide({ kind: 'entry', entryId: 'w_nnoun01' });
    expect(await offerAndStart(app)).toEqual({ offer: canStart, started: true });

    await app.mix.takeOut('crafts');
    expect(await offerAndStart(app)).toEqual({ offer: refused, started: false });

    await app.mix.putBack('speech');
    expect(await offerAndStart(app)).toEqual({ offer: canStart, started: true });
  });

  /** The pack, keeping the name of each read in `reads`. */
  function countingPack(reads: string[]): ContentReadPort {
    return Object.fromEntries(
      Object.entries(content).map(([name, read]) => [
        name,
        (...args: never[]) => {
          reads.push(name);
          return (read as (...args: never[]) => unknown)(...args);
        },
      ]),
    ) as unknown as ContentReadPort;
  }

  it('reads the eligible Entries once for a start, whether it starts or not', async () => {
    const reads: string[] = [];
    const app = await run({
      pack: countingPack(reads),
      gameModes: [{ ...lemmaMode, buildRound: () => undefined }],
    });

    reads.length = 0;
    await app.game.start('guess-word');
    const started = [...reads];
    reads.length = 0;
    await app.game.start('test-lemma');

    // One read of the eligible ids, a query per Category in the Mix; the Words were read once already.
    expect(started).toEqual(['listWordIds', 'listWordIds', 'listWordIds']);
    expect(reads).toEqual(started);
  });

  it('reads the Words of the pack once a session, however often the offers are planned', async () => {
    const reads: string[] = [];
    const app = await run({ pack: countingPack(reads), gameModes: [lemmaMode] });

    await app.hide({ kind: 'entry', entryId: 'w_nnoun01' });
    await app.unhide({ kind: 'entry', entryId: 'w_nnoun01' });
    await app.mix.takeOut('speech');
    await app.game.start('guess-word');

    expect(reads.filter((name) => name === 'listWords')).toEqual(['listWords']);
  });
});

describe('a failed planning of the offers', () => {
  /**
   * A schedule the test turns by hand: it keeps what is scheduled, each with
   * its delay, and runs it only when the test says so.
   */
  function handSchedule() {
    const delays: number[] = [];
    const waiting: (() => void)[] = [];
    let scheduled: (run: () => void) => void = (run) => waiting.push(run);
    const schedule: Schedule = (run, delay) => {
      delays.push(delay);
      scheduled(run);
      return () => undefined;
    };
    return {
      schedule,
      delays,
      /** Waits until something is scheduled, then runs it. */
      async runNext(): Promise<void> {
        const run =
          waiting.shift() ??
          (await new Promise<() => void>((resolve) => {
            scheduled = (next) => {
              scheduled = (later) => waiting.push(later);
              resolve(next);
            };
          }));
        run();
      },
    };
  }

  /** The pack, whose Words fail to read as long as `failing` says so. */
  function failingPack(failing: () => boolean): ContentReadPort {
    return {
      ...content,
      listWords: () =>
        failing() ? Promise.reject(new Error('The pack failed to read')) : content.listWords(),
    };
  }

  const planning = [{ modeId: 'guess-word', entryKind: 'word', canStart: false, planning: true }];
  const ready = [{ modeId: 'guess-word', entryKind: 'word', canStart: true }];

  it('plans the offers again a second after a failed read, without a hide, a restore or a Mix change', async () => {
    let reads = 0;
    const later = handSchedule();
    const app = await run({
      pack: failingPack(() => (reads += 1) === 1),
      planned: false,
      schedule: later.schedule,
    });

    await later.runNext();
    await offersPlanned(app);

    expect(later.delays).toEqual([1_000]);
    expect(app.game.state.modes).toEqual(ready);
  });

  it('tries three times more, 1, 2 and 4 seconds apart, then says the offers are still planned', async () => {
    const later = handSchedule();
    const app = await run({
      pack: failingPack(() => true),
      planned: false,
      schedule: later.schedule,
    });

    await later.runNext();
    await later.runNext();
    await later.runNext();
    // «Далі» does nothing without a Game, but waits its turn behind the last try.
    await app.game.next();

    expect(later.delays).toEqual([1_000, 2_000, 4_000]);
    expect(app.game.state.modes).toEqual(planning);
  });

  it('plans the offers again when the app returns to the foreground after every try failed', async () => {
    let failing = true;
    const later = handSchedule();
    const app = await run({
      pack: failingPack(() => failing),
      planned: false,
      schedule: later.schedule,
    });
    await later.runNext();
    await later.runNext();
    await later.runNext();
    await app.game.next();

    failing = false;
    await app.resume();
    await offersPlanned(app);

    expect(app.game.state.modes).toEqual(ready);
    expect(later.delays).toEqual([1_000, 2_000, 4_000]);
  });

  it('plans the offers again on a return to the foreground even without a schedule to try again by', async () => {
    let failing = true;
    const app = await run({ pack: failingPack(() => failing), planned: false });
    await app.game.next();
    expect(app.game.state.modes).toEqual(planning);

    failing = false;
    await app.resume();
    await offersPlanned(app);

    expect(app.game.state.modes).toEqual(ready);
  });

  it('lets a start during a try wait its turn behind it', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let failed = false;
    let starting = false;
    /** For each read of the eligible ids while the start waits, whether the offers were planned by then. */
    const plannedAtRead: boolean[] = [];
    const later = handSchedule();
    const app = await run({
      pack: {
        ...content,
        listWordIds(categoryId) {
          if (starting)
            plannedAtRead.push(
              app.game.state.modes.every((offer) => 'canStart' in offer && !('planning' in offer)),
            );
          return content.listWordIds(categoryId);
        },
        async listWords() {
          if (!failed) {
            failed = true;
            throw new Error('The pack failed to read');
          }
          await gate;
          return content.listWords();
        },
      },
      planned: false,
      schedule: later.schedule,
    });

    await later.runNext();
    starting = true;
    const start = app.game.start('guess-word');
    release();
    await start;

    // The try reads the eligible ids, a query per Category, while the offers are still planned; the start, only after.
    expect(plannedAtRead).toEqual([false, false, false, true, true, true]);
    expect(app.game.state.modes).toEqual(ready);
    expect(current(app)).toMatchObject({ modeId: 'guess-word', status: 'playing' });
  });

  it('tries nothing again when the first planning succeeds, nor on a return to the foreground', async () => {
    const reads: string[] = [];
    const later = handSchedule();
    const app = await run({
      pack: { ...content, listWords: () => (reads.push('listWords'), content.listWords()) },
      schedule: later.schedule,
    });
    const offers = app.game.state.modes;

    await app.resume();
    await app.game.next();

    expect(later.delays).toEqual([]);
    expect(reads).toEqual(['listWords']);
    expect(app.game.state.modes).toBe(offers);
  });
});
