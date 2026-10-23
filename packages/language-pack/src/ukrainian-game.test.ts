import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  GAME_ROUNDS,
  openComposition,
  openUserState,
  renderStress,
  type Composition,
  type Correction,
  type CurrentGame,
  type Idiom,
  type PlayedRound,
  type Random,
  type Round,
  type UserStateChanges,
  type UserStatePort,
  userStateRecords,
  type Word,
  withoutStress,
} from '@slovo/core';

import {
  buildLanguagePack,
  type ContentReport,
  openLanguagePack,
  type NodeLanguagePack,
} from './index';
import { ukrainian, ukrainianFolder } from './test-support';

// The Core's Game over the real Ukrainian Language Pack, opened through the
// Core composition (spec #215, seam 1). It lives here because only this
// package can build and read a pack in Node.

let workDir: string;
let pack: NodeLanguagePack;
let words: readonly Word[];
let corrections: readonly Correction[];
let report: ContentReport;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-game-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  report = result.report;
  pack = openLanguagePack(outFile);
  words = await pack.listWords();
  const ids = await pack.listCorrectionIds();
  corrections = (await Promise.all(ids.map((id) => pack.getCorrection(id)))).filter(
    (correction) => correction !== undefined,
  );
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

/** A seeded random port (a linear congruential generator), so every run draws the same. */
function seededRandom(seed: number): Random {
  let state = seed;
  return {
    next() {
      state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32;
      return state / 2 ** 32;
    },
  };
}

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

async function run(seed: number, port = createMemoryUserStatePort(new Map())) {
  const app = await openComposition({
    content: pack,
    edition: ukrainian,
    userState: await openUserState({ port }),
    clock: { now: () => new Date('2026-10-15T09:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
    random: seededRandom(seed),
  });
  return offersPlanned(app);
}

/**
 * The composition of `run` with Idioms out of the Mix, so that «Вгадай
 * слово» asks about Words alone, for the tests of Word Rounds.
 */
async function runWords(seed: number, port?: UserStatePort) {
  const app = await run(seed, port);
  await app.mix.setIdioms(false);
  return app;
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** A Round as it was asked: the Word it asks about and the Words it offers. */
interface Asked {
  readonly answer: Word;
  readonly options: readonly Word[];
  readonly round: Round;
}

/** The Words that read as the option, with its Stress. */
const wordsReading = (text: string) => words.filter((word) => renderStress(word) === text);

/**
 * Plays a Game of «Вгадай слово» to its end, always right, and tells what
 * each Round asked. The answer is the option whose Word has the prompt as its
 * primary Definition, as the reader would find it; of two homonyms that read
 * alike, the one with that Definition.
 */
async function playGame(app: Composition): Promise<Asked[]> {
  await app.game.start('guess-word');
  const asked: Asked[] = [];
  while (current(app).status === 'playing') {
    const { round } = current(app);
    const options = round.options.map(({ text }) => {
      const reading = wordsReading(text);
      const word =
        reading.find((candidate) => candidate.primaryDefinition === round.prompt) ?? reading[0];
      if (word === undefined) throw new Error(`No Word reads «${text}»`);
      return word;
    });
    const right = options.findIndex((word) => word.primaryDefinition === round.prompt);
    const answer = options[right];
    if (answer === undefined) throw new Error(`No option has the Definition «${round.prompt}»`);
    void app.game.answer(right);
    asked.push({ answer, options, round: current(app).round });
    await app.game.next();
  }
  return asked;
}

describe('«Вгадай слово» over the Ukrainian Language Pack', () => {
  it('offers the mode to a new reader and plays a full Game of 15 different Words', async () => {
    const app = await runWords(7);
    expect(app.game.state.modes).toEqual([
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'correction', entryKind: 'correction', canStart: true },
    ]);

    const asked = await playGame(app);

    expect(asked).toHaveLength(GAME_ROUNDS);
    expect(new Set(asked.map(({ answer }) => answer.id)).size).toBe(GAME_ROUNDS);
    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 5, status: 'won' });
  });

  it("offers three Distractors of the answer's part of speech, none with the answer's Lemma", async () => {
    for (const seed of [1, 2, 3]) {
      for (const { answer, options } of await playGame(await runWords(seed))) {
        expect(
          options.filter((option) => option.partOfSpeech === answer.partOfSpeech),
        ).toHaveLength(4);
        expect(new Set(options.map((option) => option.lemma)).size).toBe(4);
      }
    }
  });

  // Each hide plans the Rounds again, so four narrowed Games outrun Vitest's 5 s default on CI.
  it(
    "never offers a Distractor with the answer's Definition, as «Кістлявий, худий.» three Words share",
    { timeout: 20_000 },
    async () => {
      const definitionOf = (text: string) =>
        withoutStress(text).toLowerCase().replace(/\s+/g, ' ').trim();
      const shared = (definition: string) =>
        words.filter((word) => definitionOf(word.primaryDefinition) === definition).length > 1;
      const asked: Asked[] = [];
      for (const seed of [1, 2, 3, 4]) {
        const app = await runWords(seed);
        for (const { id } of (await pack.listCategories()).filter(
          ({ id }) => id !== 'human-body',
        )) {
          await app.hide({ kind: 'category', categoryId: id });
        }
        asked.push(...(await playGame(app)));
      }

      expect(asked.some(({ round }) => shared(definitionOf(round.prompt)))).toBe(true);
      for (const { round } of asked) {
        const prompt = definitionOf(round.prompt);
        expect(
          round.options.filter(({ text }) =>
            wordsReading(text).some((word) => definitionOf(word.primaryDefinition) === prompt),
          ),
        ).toHaveLength(1);
      }
    },
  );

  it('shows the Lemma and its first Example, with its author, on the sheet', async () => {
    for (const { answer, round } of await playGame(await runWords(11))) {
      expect(round.answer?.sheet).toEqual({
        answer: expect.objectContaining({ text: renderStress(answer) }) as unknown,
        example: answer.examples[0],
      });
    }
  });

  // Like the test above, each hide plans the Rounds again, for as many Games as it takes to ask the verb.
  it(
    'tops the Distractors up with other Words for the only verb of a one-Category Mix',
    { timeout: 20_000 },
    async () => {
      const verbRounds: Asked[] = [];
      for (let seed = 1; verbRounds.length === 0 && seed <= 40; seed += 1) {
        const app = await runWords(seed);
        for (const { id } of (await pack.listCategories()).filter(
          ({ id }) => id !== 'human-body',
        )) {
          await app.hide({ kind: 'category', categoryId: id });
        }
        const asked = await playGame(app);
        expect(asked.every(({ answer }) => answer.categoryId === 'human-body')).toBe(true);
        verbRounds.push(...asked.filter(({ answer }) => answer.partOfSpeech === 'verb'));
      }

      expect(verbRounds.length).toBeGreaterThan(0);
      for (const { options } of verbRounds) {
        expect(options.filter((option) => option.partOfSpeech === 'verb')).toHaveLength(1);
        expect(options.every((option) => option.categoryId === 'human-body')).toBe(true);
      }
    },
  );

  it('writes no Seen, no History and no Active Day while it is played, only its best result', async () => {
    const { port, writes } = recordingPort(new Map());
    const app = await runWords(6, port);
    writes.length = 0;

    await playGame(app);

    expect(writes).toEqual([userStateRecords.gameBest.change(current(app).roundsPassed)]);
  });
});

describe('the idioms «Вгадай слово» asks about in the Ukrainian Language Pack', () => {
  it('asks idioms marked «Не знаю» with idioms only, never a place name, and Words with Words only', async () => {
    const idioms = await pack.getIdioms(await pack.listIdiomIds());
    const proper = idioms.filter(({ idiomType }) => idiomType === 'idiom');
    const entries: readonly (Word | Idiom)[] = [...words, ...idioms];
    const textOf = (entry: Word | Idiom) =>
      entry.kind === 'word' ? renderStress(entry) : entry.expression;
    const offered = (round: Round) =>
      round.options.map(({ text }) => {
        const reading = entries.filter((entry) => textOf(entry) === text);
        const entry =
          reading.find(({ primaryDefinition }) => primaryDefinition === round.prompt) ?? reading[0];
        if (entry === undefined) throw new Error(`No Entry reads «${text}»`);
        return entry;
      });
    const played: PlayedRound[] = [];
    for (const seed of [1, 2, 3]) {
      const app = await run(seed);
      for (const { id } of idioms) await app.knowledge.tap(id, 'unknown');
      await app.game.start('guess-word');
      while (current(app).status === 'playing') {
        const { round } = current(app);
        void app.game.answer(
          offered(round).findIndex(({ primaryDefinition }) => primaryDefinition === round.prompt),
        );
        await app.game.next();
      }
      expect(current(app)).toMatchObject({ roundsPassed: GAME_ROUNDS, status: 'won' });
      played.push(...current(app).played);
    }

    for (const round of played) {
      expect(offered(round).map(({ kind }) => kind)).toEqual(Array(4).fill(round.entry.kind));
    }
    const shown = played.flatMap((round) => [round.entry, ...offered(round)]);
    expect(shown.filter((entry) => entry.kind === 'idiom' && entry.idiomType !== 'idiom')).toEqual(
      [],
    );
    // An idiom makes a fair Round only with three other idioms to stand beside it.
    const askedIdioms = played.filter(({ entry }) => entry.kind === 'idiom');
    expect(askedIdioms).toHaveLength(proper.length < 4 ? 0 : 3 * Math.min(5, proper.length));
  });
});

/** The Correction whose «people often say» sentence the Round asks. */
function askedOf(round: Round): Correction {
  const asked = corrections.find(({ examplePair }) => examplePair.nonStandard === round.prompt);
  if (asked === undefined) throw new Error(`No Correction says «${round.prompt}»`);
  return asked;
}

/** Plays a Game of «Обери правильне» to its end, always right, and keeps each answered Round. */
async function playCorrections(app: Composition): Promise<Round[]> {
  await app.game.start('correction');
  const rounds: Round[] = [];
  while (current(app).status === 'playing') {
    const { round } = current(app);
    void app.game.answer(
      round.options.findIndex(({ text }) => text === askedOf(round).standardEquivalents[0]),
    );
    rounds.push(current(app).round);
    await app.game.next();
  }
  return rounds;
}

describe('the anglicisms of the Ukrainian Language Pack', () => {
  it('builds the pack with its anglicisms and counts them in the report', () => {
    const anglicisms = corrections.filter(({ correctionType }) => correctionType === 'anglicism');

    expect(anglicisms.map(({ nonStandardForm }) => nonStandardForm)).toEqual(
      expect.arrayContaining(['дедлайн', 'тінейджер', 'лузер', 'меседж', 'голкіпер', 'дисконт']),
    );
    expect(report.correctionsPerType).toContainEqual({
      correctionType: 'anglicism',
      corrections: anglicisms.length,
    });
  });
});

describe('«Обери правильне» over the Ukrainian Language Pack', () => {
  it('plays a full Game of 15 different Corrections', async () => {
    const app = await run(7);

    const rounds = await playCorrections(app);

    expect(new Set(rounds.map((round) => askedOf(round).id)).size).toBe(GAME_ROUNDS);
    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 5, status: 'won' });
  });

  it('highlights the non-standard form where the sentence holds it as written, and nothing where it is inflected', async () => {
    const rounds: Round[] = [];
    for (const seed of [1, 2, 3, 4]) rounds.push(...(await playCorrections(await run(seed))));
    const highlighted = rounds.filter((round) => round.highlight !== undefined);
    const plain = rounds.filter((round) => round.highlight === undefined);

    // «на протязі року» holds its form; «Слідуюча зупинка» holds «слідуючий» inflected.
    expect(highlighted.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    for (const round of highlighted) {
      const { start = 0, end = 0 } = round.highlight ?? {};
      expect(round.prompt.slice(start, end).toLowerCase()).toBe(
        askedOf(round).nonStandardForm.toLowerCase(),
      );
    }
    for (const round of plain) {
      expect(round.prompt.toLowerCase()).not.toContain(
        askedOf(round).nonStandardForm.toLowerCase(),
      );
    }
  });

  it("offers other Corrections' main equivalents, of the same Correction Type first, never the asked one's own", async () => {
    for (const seed of [1, 2, 3]) {
      for (const round of await playCorrections(await run(seed))) {
        const asked = askedOf(round);
        const texts = round.options.map(({ text }) => text);
        expect(new Set(texts).size).toBe(4);
        expect(texts.filter((text) => asked.standardEquivalents.includes(text))).toEqual([
          asked.standardEquivalents[0],
        ]);
        const sameType = corrections.filter(
          (other) => other.id !== asked.id && other.correctionType === asked.correctionType,
        );
        const distractors = texts.filter((text) => text !== asked.standardEquivalents[0]);
        expect(
          distractors.filter((text) =>
            sameType.some((other) => other.standardEquivalents[0] === text),
          ),
        ).toHaveLength(Math.min(3, sameType.length));
        for (const text of distractors) {
          expect(
            corrections.some(
              (other) => other.id !== asked.id && other.standardEquivalents[0] === text,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it('plays a Round about an anglicism, offering the other anglicisms first', async () => {
    const anglicisms = corrections.filter(({ correctionType }) => correctionType === 'anglicism');
    let round: Round | undefined;
    for (let seed = 1; round === undefined && seed <= 40; seed += 1) {
      round = (await playCorrections(await run(seed))).find(
        (played) => askedOf(played).correctionType === 'anglicism',
      );
    }
    if (round === undefined) throw new Error('No Game asked about an anglicism');

    const asked = askedOf(round);
    const texts = round.options.map(({ text }) => text);
    expect(new Set(texts).size).toBe(4);
    expect(texts[round.answer?.correct ?? -1]).toBe(asked.standardEquivalents[0]);
    const others = anglicisms
      .filter((anglicism) => anglicism.id !== asked.id)
      .map((anglicism) => anglicism.standardEquivalents[0]);
    expect(texts.filter((text) => others.includes(text))).toHaveLength(3);
  });

  it('asks about no stress trap and offers none as an option', async () => {
    const stressTraps = corrections.filter(
      ({ correctionType }) => correctionType === 'wrongStress',
    );
    expect(stressTraps.length).toBeGreaterThan(0);
    const trapForms = new Set(
      stressTraps.flatMap(({ standardEquivalents }) => standardEquivalents),
    );

    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const round of await playCorrections(await run(seed))) {
        expect(askedOf(round).correctionType).not.toBe('wrongStress');
        expect(round.options.filter(({ text }) => trapForms.has(text))).toEqual([]);
      }
    }
  });

  it('fills a Game whose Unknown Entries include every stress trap with other Corrections', async () => {
    const stressTraps = corrections.filter(
      ({ correctionType }) => correctionType === 'wrongStress',
    );
    const app = await run(5);
    for (const { id } of stressTraps) await app.knowledge.tap(id, 'unknown');
    await app.knowledge.tap(
      corrections.find(({ correctionType }) => correctionType === 'calque')?.id ?? '',
      'unknown',
    );
    expect(app.game.state.modes).toContainEqual({
      modeId: 'correction',
      entryKind: 'correction',
      canStart: true,
    });

    const rounds = await playCorrections(app);

    expect(rounds).toHaveLength(GAME_ROUNDS);
    expect(rounds.map((round) => askedOf(round).correctionType)).not.toContain('wrongStress');
    expect(rounds.map((round) => askedOf(round).correctionType)).toContain('calque');
  });

  it("shows the Correction's explanation on the sheet", async () => {
    for (const round of await playCorrections(await run(11))) {
      const asked = askedOf(round);
      expect(round.answer?.sheet).toEqual({
        answer: { text: asked.standardEquivalents[0], stressedVowels: [] },
        example: undefined,
        explanation: asked.explanation,
      });
    }
  });
});
