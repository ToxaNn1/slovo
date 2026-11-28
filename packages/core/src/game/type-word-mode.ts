import { mainEquivalentOf, plays } from './correction-mode';
import type { GameMode } from './game-mode';

/**
 * «Впиши слово», the Core's typed Correction mode, on while the
 * Edition turns Corrections on: a Round shows a Correction's «people often
 * say» sentence, its non-standard form marked where the sentence holds it as
 * written, and the reader types the Correction's standard form, compared by
 * its Comparison Key as a typed answer: any of its standard equivalents is
 * right, the main one shown as the answer. It asks about no stress trap,
 * since the comparison ignores Stress marks. Its sheet shows the
 * main standard equivalent and the Correction's explanation.
 */
export const typeWordMode: GameMode = {
  id: 'type-word',
  group: 'new',
  presentation: { head: 'ink', card: 'instead' },
  entryKind: 'correction',
  isOn: (edition) => edition.isFeatureEnabled('gameTypeWord'),
  buildRound({ answer, comparison }) {
    if (answer.kind !== 'correction' || !plays(answer)) return undefined;
    const prompt = answer.examplePair.nonStandard;
    const highlight = comparison.find(prompt, answer.nonStandardForm);
    const right = mainEquivalentOf(answer);
    const alsoRight = answer.standardEquivalents.slice(1);
    return {
      form: 'typed',
      prompt,
      ...(highlight === undefined ? {} : { highlight }),
      expected: right,
      ...(alsoRight.length === 0 ? {} : { alsoRight }),
      sheet: {
        answer: { text: right, stressedVowels: [] },
        example: undefined,
        explanation: answer.explanation,
      },
    };
  },
};
