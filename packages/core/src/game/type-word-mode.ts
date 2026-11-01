import { firstOccurrence, mainEquivalentOf, plays } from './correction-mode';
import type { GameMode } from './game-mode';

/**
 * «Впиши слово», the Core's typed Correction mode (ADR 0052), on while the
 * Edition turns Corrections on: a Round shows a Correction's «people often
 * say» sentence, its non-standard form marked where the sentence holds it as
 * written, and the reader types the Correction's main standard equivalent,
 * compared the way `typedAnswerMatches` does. It asks about no stress trap,
 * since the comparison ignores Stress marks (ADR 0045). Its sheet shows the
 * main standard equivalent and the Correction's explanation.
 */
export const typeWordMode: GameMode = {
  id: 'type-word',
  group: 'words',
  entryKind: 'correction',
  isOn: (edition) =>
    edition.isFeatureEnabled('gameTypeWord') && edition.isFeatureEnabled('corrections'),
  buildRound({ answer }) {
    if (answer.kind !== 'correction' || !plays(answer)) return undefined;
    const prompt = answer.examplePair.nonStandard;
    const highlight = firstOccurrence(prompt, answer.nonStandardForm);
    const right = mainEquivalentOf(answer);
    return {
      form: 'typed',
      prompt,
      ...(highlight === undefined ? {} : { highlight }),
      expected: right,
      sheet: {
        answer: { text: right, stressedVowels: [] },
        example: undefined,
        explanation: answer.explanation,
      },
    };
  },
};
