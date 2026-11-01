import type { Idiom } from '@slovo/contracts';

import { ROUND_OPTIONS, type GameMode, type RoundOption } from './game-mode';
import { shuffled } from '../shuffled';

const folded = (text: string) => text.toLowerCase();

const optionOf = (text: string): RoundOption => ({ text, stressedVowels: [] });

/** An idiom proper or a proverb: a place name never plays, its meaning being its story (ADR 0046). */
const plays = (idiom: Idiom): boolean => idiom.idiomType !== 'placeName';

/**
 * «Фразеологізми», the Core's Idiom meaning mode (ADR 0052), on while the
 * Edition turns Idioms on: a Round shows an idiom's or a proverb's expression
 * and four meanings, its primary Definition among them. The three
 * Distractors are the primary Definitions of other eligible Idioms that
 * play, of the same Idiom Type first, never one of this Idiom's own
 * Definitions, no two options alike. A place name is never asked or offered.
 * Its sheet shows the primary Definition and the Idiom's first Example, if it
 * has one.
 */
export const idiomMeaningMode: GameMode = {
  id: 'idiom-meaning',
  group: 'idioms',
  entryKind: 'idiom',
  isOn: (edition) =>
    edition.isFeatureEnabled('gameIdiomMeaning') && edition.isFeatureEnabled('idioms'),
  buildRound({ answer, eligible, random }) {
    if (answer.kind !== 'idiom' || !plays(answer)) return undefined;
    const right = answer.primaryDefinition;
    const taken = new Set([right, ...answer.extraDefinitions].map(folded));
    const others = eligible.filter(
      (entry): entry is Idiom => entry.kind === 'idiom' && entry.id !== answer.id && plays(entry),
    );
    const distractors: string[] = [];
    for (const other of [
      ...shuffled(
        others.filter(({ idiomType }) => idiomType === answer.idiomType),
        random,
      ),
      ...shuffled(
        others.filter(({ idiomType }) => idiomType !== answer.idiomType),
        random,
      ),
    ]) {
      if (distractors.length === ROUND_OPTIONS - 1) break;
      const text = other.primaryDefinition;
      if (taken.has(folded(text))) continue;
      taken.add(folded(text));
      distractors.push(text);
    }
    if (distractors.length < ROUND_OPTIONS - 1) return undefined;
    const options = shuffled([right, ...distractors], random);
    return {
      form: 'pick',
      prompt: answer.expression,
      options: options.map(optionOf),
      correct: options.indexOf(right),
      sheet: { answer: optionOf(right), example: answer.examples[0] },
    };
  },
};
