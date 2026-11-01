import { CROSSWORD_SIZE, type CrosswordDay, type CrosswordWord } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { GameXp } from './game-xp';
import { createInTurn } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { crosswordProgress } = userStateRecords;

/**
 * Reads the Daily Crossword's days from the Language Pack. The pack reader
 * gives it next to the Core's content read port.
 */
export interface CrosswordReadPort {
  /** The Daily Crossword of a date, `YYYY-MM-DD`, or undefined when the pack has no such day. */
  crosswordDay(date: string): Promise<CrosswordDay | undefined>;
}

/** A cell of the grid, by its row and column from 0, from the top left corner. */
export interface CrosswordPlace {
  readonly row: number;
  readonly column: number;
}

/** A word of the Daily Crossword as the reader sees it: no answer, only whether its cells hold it. */
export interface DailyCrosswordWord {
  readonly start: CrosswordPlace;
  readonly direction: CrosswordWord['direction'];
  readonly length: number;
  readonly clue: string;
  /** Whether every cell holds the word's right letter. */
  readonly right: boolean;
}

/**
 * How far the reader is with the day, for its card: no letter in the grid
 * («Почати»), some letters («Продовжити»), or every word right («✓ Розв'язано»).
 */
export type DailyCrosswordProgress = 'untouched' | 'started' | 'solved';

/** The Daily Crossword of a local date with the letters typed into it on this device. */
export interface DailyCrosswordState {
  /** The local date, `YYYY-MM-DD`. */
  readonly date: string;
  /** The letters typed, by row and column; a place no word reads through stays empty. */
  readonly letters: readonly (readonly (string | undefined)[])[];
  readonly words: readonly DailyCrosswordWord[];
  readonly progress: DailyCrosswordProgress;
}

/** Today's Daily Crossword in play. */
export interface DailyCrossword {
  readonly state: DailyCrosswordState;
  /**
   * Puts a letter, in lowercase, in a cell, or erases it with `undefined`,
   * and keeps the letters on this device. Nothing changes for a place no word
   * reads through, for text that is not one letter, or for a cell of a word
   * already right. A wrong letter is never marked.
   */
  setLetter(place: CrosswordPlace, letter: string | undefined): Promise<DailyCrosswordState>;
  /**
   * «Відкрити літеру»: puts the cell's right letter in it, over a wrong one,
   * with no penalty, and keeps it on this device. Nothing changes for a place
   * no word reads through.
   */
  openCell(place: CrosswordPlace): Promise<DailyCrosswordState>;
}

const placeKey = ({ row, column }: CrosswordPlace) => `${String(row)},${String(column)}`;

/** The places of a word's letters, in reading order. */
function placesOf({ row, column, direction, answer }: CrosswordWord): CrosswordPlace[] {
  return Array.from(answer, (_, i) =>
    direction === 'across' ? { row, column: column + i } : { row: row + i, column },
  );
}

const isRight = (word: CrosswordWord, letters: ReadonlyMap<string, string>) =>
  placesOf(word).every((place, i) => letters.get(placeKey(place)) === Array.from(word.answer)[i]);

function progressOf(
  day: CrosswordDay,
  letters: ReadonlyMap<string, string>,
): DailyCrosswordProgress {
  if (day.words.every((word) => isRight(word, letters))) return 'solved';
  return letters.size === 0 ? 'untouched' : 'started';
}

function stateOf(day: CrosswordDay, letters: ReadonlyMap<string, string>): DailyCrosswordState {
  return {
    date: day.date,
    letters: Array.from({ length: CROSSWORD_SIZE }, (_, row) =>
      Array.from({ length: CROSSWORD_SIZE }, (_, column) => letters.get(placeKey({ row, column }))),
    ),
    words: day.words.map((word) => ({
      start: { row: word.row, column: word.column },
      direction: word.direction,
      length: Array.from(word.answer).length,
      clue: word.clue,
      right: isRight(word, letters),
    })),
    progress: progressOf(day, letters),
  };
}

/**
 * Opens the Daily Crossword of the clock's local date with the letters this
 * device kept for it, or nothing when the Edition has it off (it is off while
 * the Game is) or the pack has no day for the date. A new local date starts
 * an empty grid: only the letters of the date they were typed on are kept, so
 * the shell opens it again when the next local day starts. A solved day stays
 * solved for the rest of that day, as its right words take no more letters. It is not a Game
 * and never touches Seen or Knowledge Marks; its letters stay on this device
 * with no Sync (ADR 0052). The letter that solves it appends its XP in the
 * same write, which the XP log gives once for the date (ADR 0066).
 */
export async function openDailyCrossword({
  content,
  userState,
  clock,
  edition,
  xp = { award: () => ({ changes: new Map(), amount: 0, commit: () => undefined }) },
  analytics,
}: {
  content: CrosswordReadPort;
  userState: UserState;
  clock: Clock;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  /** The XP log, which solving the day earns XP in; without it, as in tests of the grid alone, none. */
  xp?: GameXp;
  analytics?: Pick<Analytics, 'track'>;
}): Promise<DailyCrossword | undefined> {
  if (!edition.isFeatureEnabled('dailyCrossword')) return undefined;
  const date = todayKey(clock);
  const day = await content.crosswordDay(date);
  if (day === undefined) return undefined;

  const kept = await userState.read(crosswordProgress);
  let letters: ReadonlyMap<string, string> = new Map(
    kept?.date === date ? Object.entries(kept.letters) : [],
  );
  const inTurn = createInTurn();
  let state = stateOf(day, letters);

  const wordsAt = (place: CrosswordPlace) =>
    day.words.filter((word) => placesOf(word).some((at) => placeKey(at) === placeKey(place)));

  /** Keeps the cell's letter, or its erasure, on this device first, so a failed write changes nothing. */
  const keep = async (place: CrosswordPlace, letter: string | undefined) => {
    const next = new Map(letters);
    if (letter === undefined) next.delete(placeKey(place));
    else next.set(placeKey(place), letter);
    const solves = state.progress !== 'solved' && progressOf(day, next) === 'solved';
    const award = solves ? xp.award({ source: 'daily-crossword', date }) : undefined;
    await userState.write(
      new Map([
        ...crosswordProgress.change({ date, letters: Object.fromEntries(next) }),
        ...(award?.changes ?? []),
      ]),
    );
    award?.commit();
    letters = next;
    state = stateOf(day, letters);
    if (solves) await analytics?.track('dailyCrosswordSolved', { date }).catch(() => undefined);
    return state;
  };

  return {
    get state() {
      return state;
    },
    setLetter: (place, letter) =>
      inTurn(async () => {
        const words = wordsAt(place);
        const lowercase = letter?.toLowerCase();
        const fits = lowercase === undefined || /^\p{L}$/u.test(lowercase);
        if (words.length === 0 || !fits || words.some((word) => isRight(word, letters)))
          return state;
        return keep(place, lowercase);
      }),
    openCell: (place) =>
      inTurn(async () => {
        const [word] = wordsAt(place);
        if (word === undefined) return state;
        const index = placesOf(word).findIndex((at) => placeKey(at) === placeKey(place));
        const letter = Array.from(word.answer)[index];
        if (letter === undefined || letters.get(placeKey(place)) === letter) return state;
        return keep(place, letter);
      }),
  };
}
