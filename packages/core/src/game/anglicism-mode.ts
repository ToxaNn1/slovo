import type { AskableEntry } from '../entries/entries';
import { correctionMode } from './correction-mode';
import type { GameMode, RoundContent, RoundOption, TextRange } from './game-mode';

const isAnglicism = (entry: AskableEntry): boolean =>
  entry.kind === 'correction' && entry.correctionType === 'anglicism';

/** Whether a text opens with a capital letter, one its lower case changes. */
const opensWithCapital = (text: string): boolean => {
  const first = text.charAt(0);
  return first !== first.toLowerCase();
};

/**
 * The sentence with a replacement in the place of its anglicism, opening
 * with a capital where the anglicism did, and the range of the replacement.
 */
function replacedIn(sentence: string, anglicism: TextRange, { text }: RoundOption): RoundOption {
  const replacement = opensWithCapital(sentence.slice(anglicism.start, anglicism.end))
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : text;
  return {
    text: sentence.slice(0, anglicism.start) + replacement + sentence.slice(anglicism.end),
    stressedVowels: [],
    highlight: { start: anglicism.start, end: anglicism.start + replacement.length },
  };
}

/** A Round whose options are its sentence with each replacement in place, when it marks its anglicism. */
function asSentences(round: RoundContent): RoundContent {
  const { highlight } = round;
  if (round.form !== 'pick' || highlight === undefined) return round;
  return {
    ...round,
    options: round.options.map((option) => replacedIn(round.prompt, highlight, option)),
  };
}

/**
 * «Англіцизми», the Core's anglicism mode (ADR 0052), on while the Edition
 * turns the mode and Corrections on: «Обери правильне» with Correction Type
 * `anglicism` only. Its Rounds ask about anglicisms alone and their three
 * Distractors are the main standard equivalents of other anglicisms, so it
 * can't start with fewer than 15 eligible anglicisms. Each option is the
 * sentence with a standard equivalent in the anglicism's place, opening with
 * a capital where the anglicism did, and tells the range of its replacement
 * (spec #1880); its sheet still names the main standard equivalent alone.
 */
export const anglicismMode: GameMode = {
  id: 'anglicism',
  group: 'new',
  entryKind: 'correction',
  isOn: (edition) => edition.isFeatureEnabled('gameAnglicism'),
  buildRound(input) {
    if (!isAnglicism(input.answer)) return undefined;
    const round = correctionMode.buildRound({
      ...input,
      eligible: input.eligible.filter(isAnglicism),
    });
    return round === undefined ? undefined : asSentences(round);
  },
};
