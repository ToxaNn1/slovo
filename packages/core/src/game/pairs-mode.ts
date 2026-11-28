import type { Word } from '@slovo/contracts';

import type { AskableEntry } from '../entries/entries';
import { renderStress, stressedVowelsOf } from '../entries/stress';
import { ROUND_OPTIONS, type GameMode, type GridPair } from './game-mode';
import { fitsDefinitionOf } from './guess-word';
import { shuffled } from '../shuffled';

/**
 * The Words that may share a grid with the answer, best first: the Words of
 * the answer's part of speech, then the others, each group kept in the
 * Game's order so that the Words it would ask next, the weak ones at their
 * places, come first.
 */
const gridOrder = (answer: Word, others: readonly Word[]): Word[] => [
  ...others.filter((word) => word.partOfSpeech === answer.partOfSpeech),
  ...others.filter((word) => word.partOfSpeech !== answer.partOfSpeech),
];

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
 * «Пари», the Core's pairs mode, on when the Edition turns it on:
 * a Round is a grid of up to 4 Words and their primary Definitions, each
 * shuffled apart, whose every pair is a Round of its own, so that a Game's 15
 * Rounds are grids of 4, 4, 4 and 3 pairs. A grid holds at least 2 pairs and
 * never leaves a single Round to the Game, which would make a grid of one
 * pair: with 5 Rounds left it holds 3, and when too few Words may share it
 * there is no grid about the answer. A grid holds the answer and the
 * Words the Game would ask next. First come the ones the reader is weak on
 * whose places the grid reaches; one of them that may not sit in the grid
 * gives its place to the next weak one and moves to a later grid. Then comes a
 * weak one that may not share a grid with another still to come, ahead of its
 * place, so that the two never meet at the Game's last grid, which neither
 * could leave. Then come the Words of the answer's part of speech, then the
 * others. No two Words of a grid share a Lemma, none fits the primary
 * Definition of another by one of its own Definitions, primary or extra, and
 * no two are synonyms, so each Word
 * has one right Definition. A wrong pair costs a Life and marks Unknown the Word tapped,
 * whose Definition was matched wrongly. Each pair's sheet shows its Word and
 * the Word's first Example, if it has one.
 */
export const pairsMode: GameMode = {
  id: 'pairs',
  group: 'meaning',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gamePairs'),
  buildRound({ answer, next, weakNext, upTo, random, comparison }) {
    if (answer.kind !== 'word') return undefined;
    /**
     * Whether the two Words may not share a grid: they share a Lemma, or
     * either fits the other's Definition, so a pair would have two right matches.
     */
    const apart = (one: Word, other: Word) =>
      one.lemma === other.lemma ||
      fitsDefinitionOf(comparison, one, other) ||
      fitsDefinitionOf(comparison, other, one);
    const size = Math.min(ROUND_OPTIONS, upTo);
    const words = next.filter(isWord);
    // The grid's places after the answer's are those of the first Words the Game would ask next.
    const due = words.slice(0, size - 1).filter(({ id }) => weakNext.has(id));
    const later = words.slice(size - 1).filter(({ id }) => weakNext.has(id));
    const grid = [answer];
    /** Puts in the grid, in order, the Words that may sit in it, while it has places and until it has `enough`. */
    function take(candidates: readonly Word[], enough = () => false): void {
      for (const word of candidates) {
        if (grid.length >= size || enough()) return;
        if (!grid.some((placed) => apart(placed, word))) grid.push(word);
      }
    }
    take(due);
    take(later, () => grid.length > due.length);
    take(
      later.filter((word) =>
        [...due, ...later].some((other) => other !== word && apart(word, other)),
      ),
    );
    take(gridOrder(answer, words));
    // A grid that would leave a single Round gives its last place to a later grid.
    if (upTo - grid.length === 1) grid.pop();
    if (grid.length < 2) return undefined;
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
