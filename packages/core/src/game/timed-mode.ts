import type { GameMode } from './game-mode';
import { guessWord } from './guess-word';

/** How long a Game of «На час» lasts, in milliseconds of play (ADR 0137). */
const TIMED_GAME_LENGTH = 20_000;

/**
 * «На час», the Core's mode against the clock (ADR 0052): 20 seconds of play
 * and no Lives, so a mistake simply moves on, with no answer sheet. Its
 * Rounds are «Вгадай слово» Definition picks of Words at every Round, with no
 * stages, and its result is the right answers.
 */
export const timedMode: GameMode = {
  id: 'timed',
  group: 'speed',
  entryKind: 'word',
  lives: 'none',
  roundLimit: 'none',
  timeLimit: TIMED_GAME_LENGTH,
  movesOn: true,
  isOn: (edition) => edition.isFeatureEnabled('gameTimed'),
  buildRound: (input) => guessWord.buildRound({ ...input, round: 1 }),
};
