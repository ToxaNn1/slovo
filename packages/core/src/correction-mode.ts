import type { Correction } from '@slovo/contracts';

import { ROUND_OPTIONS, shuffled, type GameMode, type RoundOption, type TextRange } from './game';

/** Text as it compares to other text, regardless of case. */
const folded = (text: string) => text.toLowerCase();

/**
 * Where the text first holds the form, regardless of case; nothing when it
 * doesn't hold the form as written, such as when it holds an inflected form.
 * It compares stretch by stretch, so a letter whose lower case is longer never
 * shifts the range.
 */
function firstOccurrence(text: string, form: string): TextRange | undefined {
  const wanted = folded(form);
  for (let start = 0; start + form.length <= text.length; start += 1) {
    const end = start + form.length;
    if (folded(text.slice(start, end)) === wanted) return { start, end };
  }
  return undefined;
}

const optionOf = (text: string): RoundOption => ({ text, stressedVowels: [] });

/** A Correction's main standard equivalent, the right option of a Round that asks about it. */
const mainEquivalentOf = (correction: Correction) => correction.standardEquivalents[0] ?? '';

/**
 * «Обери правильне», the Core's Correction mode, on when the Edition turns
 * Corrections on: a Round shows a Correction's «people often say» sentence,
 * its non-standard form marked where the sentence holds it as written, and
 * four standard forms, the Correction's main standard equivalent among them.
 * The three Distractors are the main standard equivalents of other eligible
 * Corrections, of the same Correction Type first, never one of this
 * Correction's own equivalents, no two options alike (ADR 0024). Its sheet
 * shows the main standard equivalent and the Correction's explanation.
 */
export const correctionMode: GameMode = {
  id: 'correction',
  entryKind: 'correction',
  isOn: (edition) => edition.isFeatureEnabled('corrections'),
  buildRound({ answer, eligible, random }) {
    if (answer.kind !== 'correction') return undefined;
    const taken = new Set(answer.standardEquivalents.map(folded));
    const others = eligible.filter(
      (entry): entry is Correction => entry.kind === 'correction' && entry.id !== answer.id,
    );
    const distractors: string[] = [];
    for (const other of [
      ...shuffled(
        others.filter(({ correctionType }) => correctionType === answer.correctionType),
        random,
      ),
      ...shuffled(
        others.filter(({ correctionType }) => correctionType !== answer.correctionType),
        random,
      ),
    ]) {
      if (distractors.length === ROUND_OPTIONS - 1) break;
      const text = mainEquivalentOf(other);
      if (taken.has(folded(text))) continue;
      taken.add(folded(text));
      distractors.push(text);
    }
    if (distractors.length < ROUND_OPTIONS - 1) return undefined;
    const right = mainEquivalentOf(answer);
    const options = shuffled([right, ...distractors], random);
    const prompt = answer.examplePair.nonStandard;
    const highlight = firstOccurrence(prompt, answer.nonStandardForm);
    return {
      prompt,
      ...(highlight === undefined ? {} : { highlight }),
      options: options.map(optionOf),
      correct: options.indexOf(right),
      sheet: { answer: optionOf(right), example: undefined, explanation: answer.explanation },
    };
  },
};
