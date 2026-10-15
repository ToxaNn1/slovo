import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  GAME_ROUNDS,
  loadEdition,
  openComposition,
  openUserState,
  renderStress,
  type Composition,
  type CurrentGame,
  type Random,
  type Round,
  type UserStateChanges,
  type UserStatePort,
  type Word,
} from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';

// The Core's Game over the real Ukrainian Language Pack, opened through the
// Core composition (spec #215, seam 1). It lives here because only this
// package can build and read a pack in Node.

const editionDir = fileURLToPath(new URL('../../../editions/uk', import.meta.url));

const ukrainian = loadEdition(
  JSON.parse(readFileSync(join(editionDir, 'edition.json'), 'utf8')) as unknown,
);

let workDir: string;
let pack: NodeLanguagePack;
let words: readonly Word[];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-game-'));
  const outFile = join(workDir, 'language-pack.db');
  if (!buildLanguagePack({ editionDir, outFile }).ok) {
    throw new Error('The Ukrainian Language Pack does not build');
  }
  pack = openLanguagePack(outFile);
  words = await pack.listWords();
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

async function run(seed: number, port = createMemoryUserStatePort(new Map())) {
  return openComposition({
    content: pack,
    edition: ukrainian,
    userState: await openUserState({ port }),
    clock: { now: () => new Date('2026-10-15T09:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
    random: seededRandom(seed),
  });
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
    app.game.answer(right);
    asked.push({ answer, options, round: current(app).round });
    await app.game.next();
  }
  return asked;
}

describe('«Вгадай слово» over the Ukrainian Language Pack', () => {
  it('offers the mode to a new reader and plays a full Game of 15 different Words', async () => {
    const app = await run(7);
    expect(app.game.state.modes).toEqual([{ modeId: 'guess-word', canStart: true }]);

    const asked = await playGame(app);

    expect(asked).toHaveLength(GAME_ROUNDS);
    expect(new Set(asked.map(({ answer }) => answer.id)).size).toBe(GAME_ROUNDS);
    expect(current(app)).toMatchObject({ roundsPassed: 15, lives: 5, status: 'won' });
  });

  it("offers three Distractors of the answer's part of speech, none with the answer's Lemma", async () => {
    for (const seed of [1, 2, 3]) {
      for (const { answer, options } of await playGame(await run(seed))) {
        expect(
          options.filter((option) => option.partOfSpeech === answer.partOfSpeech),
        ).toHaveLength(4);
        expect(new Set(options.map((option) => option.lemma)).size).toBe(4);
      }
    }
  });

  it('shows the Lemma and its first Example, with its author, on the sheet', async () => {
    for (const { answer, round } of await playGame(await run(11))) {
      expect(round.answer?.sheet).toEqual({
        answer: expect.objectContaining({ text: renderStress(answer) }) as unknown,
        example: answer.examples[0],
      });
    }
  });

  it('tops the Distractors up with other Words for the only verb of a one-Category Mix', async () => {
    const verbRounds: Asked[] = [];
    for (let seed = 1; verbRounds.length === 0 && seed <= 40; seed += 1) {
      const app = await run(seed);
      for (const { id } of ukrainian.categories.filter(({ id }) => id !== 'human-body')) {
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
  });

  it('writes no Seen, no History and no Active Day while it is played', async () => {
    const { port, writes } = recordingPort(new Map());
    const app = await run(5, port);
    writes.length = 0;

    await playGame(app);

    expect(writes).toEqual([]);
  });
});
