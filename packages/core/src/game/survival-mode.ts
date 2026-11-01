import { correctionMode } from './correction-mode';
import type { GameMode } from './game-mode';
import { guessWord } from './guess-word';

/**
 * «Виживання», the Core's endless mode (ADR 0052), on while the Edition turns
 * the mode and Corrections on: 3 Lives and no Round limit, its Rounds taking
 * turns between Words and Corrections, so about half each. A Word's Round is
 * a «Вгадай слово» Definition pick at every Round, with no stages; a
 * Correction's is a Round of «Обери правильне». It refuses while Corrections
 * are out of the Mix, since it mixes them with Words, and its result is the
 * Rounds passed.
 */
export const survivalMode: GameMode = {
  id: 'survival',
  group: 'challenge',
  entryKind: 'correction',
  alsoAsks: ['word'],
  lives: 3,
  roundLimit: 'none',
  takesTurns: true,
  isOn: (edition) =>
    edition.isFeatureEnabled('gameSurvival') && edition.isFeatureEnabled('corrections'),
  buildRound(input) {
    if (input.answer.kind === 'word') return guessWord.buildRound({ ...input, round: 1 });
    return correctionMode.buildRound(input);
  },
};
