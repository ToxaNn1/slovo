import type { DistractorRule, Word } from '@slovo/contracts';

import type { AskableEntry } from '../entries/entries';
import { renderStress, stressedVowelsOf, withoutStress } from '../entries/stress';
import { ROUND_OPTIONS, type GameMode, type GridPair } from './game-mode';
import { shuffled } from '../shuffled';

/**
 * The Words that may share a grid with the answer, best first, by each
 * Distractor rule an Edition may choose, each group kept in the Game's order
 * so that the Words it would ask next, the weak ones first, come first.
 * `same-part-of-speech`: the Words of the answer's part of speech, then the others.
 */
const gridOrder: Record<DistractorRule, (answer: Word, others: readonly Word[]) => Word[]> = {
  'same-part-of-speech': (answer, others) => [
    ...others.filter((word) => word.partOfSpeech === answer.partOfSpeech),
    ...others.filter((word) => word.partOfSpeech !== answer.partOfSpeech),
  ],
};

/** A primary Definition as the reader tells it apart: without case, extra spaces or Stress marks. */
const definitionOf = ({ primaryDefinition }: Word) =>
  withoutStress(primaryDefinition).toLowerCase().replace(/\s+/g, ' ').trim();

const isWord = (entry: AskableEntry): entry is Word => entry.kind === 'word';

/** A Word's pair: its Lemma with Stress and its primary Definition; its sheet shows its first Example, if any. */
function pairOf(word: Word): GridPair {
  const option = { text: renderStress(word), stressedVowels: stressedVowelsOf(word) };
  return {
    entry: word,
    word: option,
    definition: word.primaryDefinition,
    sheet: { answer: option, example: word.examples[0] },
  };
}

/**
 * «Пари», the Core's pairs mode (ADR 0052), on when the Edition turns it on:
 * a Round is a grid of up to 4 Words and their primary Definitions, each
 * shuffled apart, whose every pair is a Round of its own, so that a Game's 15
 * Rounds are grids of 4, 4, 4 and 3 pairs. A grid holds the answer and the
 * Words the Game would ask next, by the Edition's Distractor rule; no two of
 * them share a Lemma or a primary Definition, so each Word has one right
 * Definition. A wrong pair costs a Life and marks Unknown the Word tapped,
 * whose Definition was matched wrongly. Each pair's sheet shows its Word and
 * the Word's first Example, if it has one.
 */
export const pairsMode: GameMode = {
  id: 'pairs',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gamePairs'),
  buildRound({ answer, next, upTo, random, edition }) {
    if (answer.kind !== 'word') return undefined;
    const others = gridOrder[edition.languageTraits.distractorRule](answer, next.filter(isWord));
    const grid = [answer];
    const lemmas = new Set([answer.lemma]);
    const definitions = new Set([definitionOf(answer)]);
    for (const word of others) {
      if (grid.length >= Math.min(ROUND_OPTIONS, upTo)) break;
      if (lemmas.has(word.lemma) || definitions.has(definitionOf(word))) continue;
      lemmas.add(word.lemma);
      definitions.add(definitionOf(word));
      grid.push(word);
    }
    const places = grid.map((_, place) => place);
    return {
      form: 'pairs',
      prompt: '',
      pairs: grid.map(pairOf),
      wordOrder: shuffled(places, random),
      definitionOrder: shuffled(places, random),
    };
  },
};
