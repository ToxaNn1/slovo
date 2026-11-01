import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GAME_ROUNDS,
  openComposition,
  renderStress,
  type Composition,
  type Correction,
  type CurrentGame,
  type Idiom,
  type PlayedRound,
  type Random,
  type Round,
  type RoundOption,
  type TrackedUserState,
  type UserStateChanges,
  type Word,
  withoutStress,
} from '@slovo/core';
import { readFact, seedUserState } from '@slovo/core/testing';

import {
  buildLanguagePack,
  type ContentReport,
  openLanguagePack,
  type NodeLanguagePack,
} from './index';
import { ukrainian, ukrainianFolder } from './test-support';

/** The options of a Round of the pick form, the one every Core mode of 0.8.11 plays. */
function optionsOf(round: Round): readonly RoundOption[] {
  if (round.form !== 'pick') throw new Error(`Round ${String(round.number)} is no pick`);
  return round.options;
}

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
  corrections = (await pack.getEntries(await pack.listIds('correction'))).filter(
    (entry): entry is Correction => entry.kind === 'correction',
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

/** A seeded user state that keeps every write it is given. */
async function recordingUserState() {
  const userState = await seedUserState();
  const writes: UserStateChanges[] = [];
  return {
    writes,
    userState: {
      ...userState,
      write(changes) {
        writes.push(changes);
        return userState.write(changes);
      },
    } satisfies TrackedUserState,
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

/**
 * The UA Edition with every Game Mode off but «Вгадай слово», for the
 * tests that play many seeded Games of it: the other modes' planning would
 * draw on the same random source and slow every hide.
 */
const guessWordOnly: typeof ukrainian = {
  ...ukrainian,
  isFeatureEnabled: (feature) =>
    ukrainian.isFeatureEnabled(feature) &&
    (!/^game[A-Z]/.test(feature) || ['gameGuessWord', 'gameReview'].includes(feature)),
};

async function run(seed: number, userState?: TrackedUserState, edition = ukrainian) {
  const app = await openComposition({
    content: pack,
    edition,
    userState: userState ?? (await seedUserState()),
    clock: { now: () => new Date('2026-10-15T09:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
    random: seededRandom(seed),
  });
  return offersPlanned(app);
}

/** The composition of `run` with Synonym Rows and Tips out of the Mix, so the Game asks Words and Idioms. */
async function runWordsAndIdioms(seed: number, userState?: TrackedUserState, edition = ukrainian) {
  const app = await run(seed, userState, edition);
  await app.mix.setKind('synonymRow', false);
  await app.mix.setKind('tip', false);
  return app;
}

/**
 * The composition of `run` with Idioms, Synonym Rows and Tips out of the Mix,
 * so that «Вгадай слово» asks about Words alone, for the tests of Word Rounds.
 */
async function runWords(seed: number, userState?: TrackedUserState, edition = ukrainian) {
  const app = await runWordsAndIdioms(seed, userState, edition);
  await app.mix.setKind('idiom', false);
  return app;
}

/**
 * The composition of `runWords` with «Вгадай слово» the only Game Mode and
 * every Category but `human-body` hidden. Each hide plans the Rounds again,
 * so the tests hide once and play their Games in a row on one composition.
 */
async function humanBodyOnly(seed: number) {
  const app = await runWords(seed, undefined, guessWordOnly);
  for (const { id } of await pack.listCategories()) {
    if (id !== 'human-body') await app.hide({ kind: 'category', categoryId: id });
  }
  return app;
}

function current(app: Composition): CurrentGame {
  const game = app.game.state.current;
  if (game === undefined) throw new Error('No Game in play');
  return game;
}

/** A Round as it was asked: the Word it asks about and the Words it offers, none when typed. */
interface Asked {
  readonly answer: Word;
  readonly options: readonly Word[];
  readonly round: Round;
}

/** The Example the Round shows with a gap in it, if it is one of the Entry's (L10). */
const gappedIn = ({ examples }: Word | Idiom, { prompt, highlight }: Round) => {
  if (highlight === undefined) return undefined;
  const [before, after] = [prompt.slice(0, highlight.start), prompt.slice(highlight.end)];
  return examples.find(
    ({ text }) =>
      text.length > before.length + after.length && text.startsWith(before) && text.endsWith(after),
  );
};

/** Whether the Round asks about the Entry: by its primary Definition, or by its Example with a gap. */
const asks = (entry: Word | Idiom, round: Round) =>
  round.highlight === undefined
    ? entry.primaryDefinition === round.prompt
    : gappedIn(entry, round) !== undefined;

/** The Words that read as the option, with its Stress. */
const wordsReading = (text: string) => words.filter((word) => renderStress(word) === text);

/**
 * Plays a Game of «Вгадай слово» to its end, always right, and tells what
 * each Round asked. The answer is the option whose Word the Round asks
 * about, by its primary Definition or its Example with a gap, as the reader
 * would find it; of two homonyms that read alike, the one it asks about.
 */
async function playGame(app: Composition): Promise<Asked[]> {
  await app.game.start('guess-word');
  const asked: Asked[] = [];
  while (current(app).status === 'playing') {
    const { round } = current(app);
    if (round.form === 'typed') {
      // A typed Round asks a Definition no other eligible Word has, so the pack's one Word with it.
      const typed = words.filter((word) => asks(word, round));
      const [answer] = typed;
      if (answer === undefined || typed.length > 1) {
        throw new Error(`No one Word answers «${round.prompt}»`);
      }
      await app.game.answer({ form: 'typed', text: answer.lemma });
      asked.push({ answer, options: [], round: current(app).round });
      await app.game.next();
      continue;
    }
    const options = optionsOf(round).map(({ text }) => {
      const reading = wordsReading(text);
      const word = reading.find((candidate) => asks(candidate, round)) ?? reading[0];
      if (word === undefined) throw new Error(`No Word reads «${text}»`);
      return word;
    });
    const right = options.findIndex((word) => asks(word, round));
    const answer = options[right];
    if (answer === undefined) throw new Error(`No option answers «${round.prompt}»`);
    await app.game.answer({ form: 'pick', option: right });
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
      { modeId: 'stress', entryKind: 'word', canStart: true },
      { modeId: 'pairs', entryKind: 'word', canStart: true },
      { modeId: 'anagram', entryKind: 'word', canStart: true },
      { modeId: 'by-letters', entryKind: 'word', canStart: true },
      { modeId: 'type-word', entryKind: 'correction', canStart: true },
      { modeId: 'anglicism', entryKind: 'correction', canStart: true },
      {
        modeId: 'build-idiom',
        entryKind: 'idiom',
        canStart: false,
        refusal: 'idioms-out-of-mix',
      },
      {
        modeId: 'idiom-meaning',
        entryKind: 'idiom',
        canStart: false,
        refusal: 'idioms-out-of-mix',
      },
      { modeId: 'survival', entryKind: 'correction', canStart: true },
      { modeId: 'timed', entryKind: 'word', canStart: true },
      { modeId: 'origin', entryKind: 'word', canStart: true },
    ]);

    const asked = await playGame(app);

    expect(asked).toHaveLength(GAME_ROUNDS);
    expect(new Set(asked.map(({ answer }) => answer.id)).size).toBe(GAME_ROUNDS);
    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 5, status: 'won' });
  });

  it("offers three Distractors of the answer's part of speech, none with the answer's Lemma", async () => {
    // A part of speech with fewer than four Words (достеменно is the only adverb) fills up with others.
    const wordsOf = (partOfSpeech: Word['partOfSpeech']) =>
      words.filter((word) => word.partOfSpeech === partOfSpeech).length;
    // One composition plays three Games: opening one plans the Game over the whole pack, the slow part.
    const app = await runWords(1);
    for (let game = 0; game < 3; game += 1) {
      for (const { answer, options, round } of await playGame(app)) {
        if (round.form === 'typed') continue;
        expect(
          options.filter((option) => option.partOfSpeech === answer.partOfSpeech),
        ).toHaveLength(Math.min(4, wordsOf(answer.partOfSpeech)));
        expect(new Set(options.map((option) => option.lemma)).size).toBe(4);
      }
    }
  });

  it("never offers a Distractor with the answer's Definition, as «Кістлявий, худий.» three Words share", async () => {
    const definitionOf = (text: string) =>
      withoutStress(text).toLowerCase().replace(/\s+/g, ' ').trim();
    const shared = (definition: string) =>
      words.filter((word) => definitionOf(word.primaryDefinition) === definition).length > 1;
    const app = await humanBodyOnly(1);
    const asked: Asked[] = [];
    // Play Games until one asks a shared Definition, so new content never hides the case.
    for (
      let game = 1;
      game <= 20 && !asked.some(({ round }) => shared(definitionOf(round.prompt)));
      game += 1
    ) {
      asked.push(...(await playGame(app)));
    }

    expect(asked.some(({ round }) => shared(definitionOf(round.prompt)))).toBe(true);
    for (const { answer, round } of asked.filter(({ round }) => round.form === 'pick')) {
      const prompt = definitionOf(answer.primaryDefinition);
      expect(
        optionsOf(round).filter(({ text }) =>
          wordsReading(text).some((word) => definitionOf(word.primaryDefinition) === prompt),
        ),
      ).toHaveLength(1);
    }
  });

  it('shows the Lemma and its first Example, or the one with the gap, with its author, on the sheet', async () => {
    for (const { answer, round } of await playGame(await runWords(11))) {
      expect(round.answer?.sheet).toEqual({
        answer: expect.objectContaining({ text: renderStress(answer) }) as unknown,
        example: gappedIn(answer, round) ?? answer.examples[0],
      });
    }
  });

  it('tops the Distractors up with other Words for the only verb of a one-Category Mix', async () => {
    const app = await humanBodyOnly(1);
    const verbRounds: Asked[] = [];
    for (let game = 1; verbRounds.length === 0 && game <= 40; game += 1) {
      const asked = await playGame(app);
      expect(asked.every(({ answer }) => answer.categoryId === 'human-body')).toBe(true);
      verbRounds.push(...asked.filter(({ answer }) => answer.partOfSpeech === 'verb'));
    }

    expect(verbRounds.length).toBeGreaterThan(0);
    for (const { options } of verbRounds.filter(({ round }) => round.form === 'pick')) {
      expect(options.filter((option) => option.partOfSpeech === 'verb')).toHaveLength(1);
      expect(options.every((option) => option.categoryId === 'human-body')).toBe(true);
    }
  });

  it('writes no Seen, no History and no Active Day while it is played, only the confirmed Entries, its XP, its Best result and the Badges it earns', async () => {
    const { userState, writes } = await recordingUserState();
    const app = await runWords(6, userState);
    writes.length = 0;

    await playGame(app);

    const { roundsPassed, played } = current(app);
    const confirmed = writes.filter((write) =>
      [...write.keys()].every((key) => key.startsWith('confirmed.')),
    );
    expect(new Set(confirmed.flatMap((write) => [...write.keys()]))).toEqual(
      new Set(played.filter(({ right }) => right).map(({ entry }) => `confirmed.${entry.id}`)),
    );
    // The XP of a right Round goes in its own write; the XP of the finished
    // Game and of the new Best result share the Best result's write.
    const bestKey = 'game.best.guess-word';
    // Each Badge the Game earns goes in its own write of its XP log record.
    const badges = writes.filter((write) =>
      [...write.keys()].every((key) => key.startsWith('xp.badge-')),
    );
    expect(badges.every((write) => write.size === 1)).toBe(true);
    const others = writes.filter((write) => !confirmed.includes(write) && !badges.includes(write));
    const withBest = others.filter((write) => write.has(bestKey));
    expect(withBest).toHaveLength(1);
    expect(withBest[0]?.get(bestKey)).toBe(String(roundsPassed));
    expect(await readFact(userState, 'gameBest')).toEqual(new Map([['guess-word', roundsPassed]]));
    for (const write of others) {
      const xpKeys = [...write.keys()].filter((key) => key !== bestKey);
      expect(xpKeys.length).toBeGreaterThan(0);
      expect(xpKeys.every((key) => key.startsWith('xp.'))).toBe(true);
    }
    expect(others).toHaveLength(played.filter(({ right }) => right).length + 1);
  });
});

describe('the idioms «Вгадай слово» asks about in the Ukrainian Language Pack', () => {
  it('asks idioms marked «Не знаю» with idioms only, never a place name, and Words with Words only', async () => {
    const idioms = (await pack.getEntries(await pack.listIds('idiom'))).filter(
      (entry): entry is Idiom => entry.kind === 'idiom',
    );
    const proper = idioms.filter(({ idiomType }) => idiomType === 'idiom');
    // The Entries by the text an option shows, built once: reading every Entry per option is slow.
    const byText = new Map<string, (Word | Idiom)[]>();
    for (const entry of [...words, ...idioms]) {
      const text = entry.kind === 'word' ? renderStress(entry) : entry.expression;
      byText.set(text, [...(byText.get(text) ?? []), entry]);
    }
    const offered = (round: Round) =>
      optionsOf(round).map(({ text }) => {
        const reading = byText.get(text) ?? [];
        const entry = reading.find((candidate) => asks(candidate, round)) ?? reading[0];
        if (entry === undefined) throw new Error(`No Entry reads «${text}»`);
        return entry;
      });
    const played: PlayedRound[] = [];
    // One composition plays three Games: opening one plans the Game over the whole pack, the slow part.
    const app = await runWordsAndIdioms(1);
    for (const { id } of idioms) await app.knowledge.tap(id, 'unknown');
    for (let game = 0; game < 3; game += 1) {
      await app.game.start('guess-word');
      while (current(app).status === 'playing') {
        const { round } = current(app);
        const typed = words.find((entry) => asks(entry, round));
        void app.game.answer(
          round.form === 'typed'
            ? { form: 'typed', text: typed?.lemma ?? '' }
            : { form: 'pick', option: offered(round).findIndex((entry) => asks(entry, round)) },
        );
        await app.game.next();
      }
      expect(current(app)).toMatchObject({ roundsPassed: GAME_ROUNDS, status: 'won' });
      played.push(...current(app).played);
    }

    for (const round of played.filter(({ form }) => form === 'pick')) {
      expect(offered(round).map(({ kind }) => kind)).toEqual(Array(4).fill(round.entry.kind));
    }
    const shown = played.flatMap((round) => [
      round.entry,
      ...(round.form === 'pick' ? offered(round) : []),
    ]);
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
    void app.game.answer({
      form: 'pick',
      option: optionsOf(round).findIndex(
        ({ text }) => text === askedOf(round).standardEquivalents[0],
      ),
    });
    rounds.push(current(app).round);
    await app.game.next();
  }
  return rounds;
}

describe('the anglicisms of the Ukrainian Language Pack', () => {
  it('builds the pack with at least 15 anglicisms and counts them in the report', () => {
    const anglicisms = corrections.filter(({ correctionType }) => correctionType === 'anglicism');

    expect(anglicisms.length).toBeGreaterThanOrEqual(15);
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
    // One composition plays four Games, as in the test of stress traps below.
    const app = await run(1);
    for (let game = 0; game < 4; game += 1) rounds.push(...(await playCorrections(app)));
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
    // One composition plays three Games, as in the test of stress traps below.
    const app = await run(1);
    for (let game = 0; game < 3; game += 1) {
      for (const round of await playCorrections(app)) {
        const asked = askedOf(round);
        const texts = optionsOf(round).map(({ text }) => text);
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
    const texts = optionsOf(round).map(({ text }) => text);
    expect(new Set(texts).size).toBe(4);
    const correct = round.answer?.form === 'pick' ? round.answer.correct : -1;
    expect(texts[correct]).toBe(asked.standardEquivalents[0]);
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

    // One composition plays six Games: opening one reads and plans over the whole pack, the slow part.
    const app = await run(1);
    for (let game = 0; game < 6; game += 1) {
      for (const round of await playCorrections(app)) {
        expect(askedOf(round).correctionType).not.toBe('wrongStress');
        expect(optionsOf(round).filter(({ text }) => trapForms.has(text))).toEqual([]);
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
