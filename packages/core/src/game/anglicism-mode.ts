import type { AskableEntry } from '../entries/entries';
import { correctionMode } from './correction-mode';
import type { GameMode } from './game-mode';

const isAnglicism = (entry: AskableEntry): boolean =>
  entry.kind === 'correction' && entry.correctionType === 'anglicism';

/**
 * «Англіцизми», the Core's anglicism mode (ADR 0052), on while the Edition
 * turns the mode and Corrections on: «Обери правильне» with Correction Type
 * `anglicism` only. Its Rounds ask about anglicisms alone and their three
 * Distractors are the main standard equivalents of other anglicisms, so it
 * can't start with fewer than 15 eligible anglicisms.
 */
export const anglicismMode: GameMode = {
  id: 'anglicism',
  entryKind: 'correction',
  isOn: (edition) =>
    edition.isFeatureEnabled('gameAnglicism') && edition.isFeatureEnabled('corrections'),
  buildRound(input) {
    if (!isAnglicism(input.answer)) return undefined;
    return correctionMode.buildRound({ ...input, eligible: input.eligible.filter(isAnglicism) });
  },
};
