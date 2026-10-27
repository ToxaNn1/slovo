import type {
  DistractorRule,
  Entry,
  Example,
  Idiom,
  SynonymRow,
  SynonymRowDominant,
  Tip,
  Word,
} from '@slovo/contracts';

import {
  ROUND_OPTIONS,
  shuffled,
  type GameMode,
  type RoundContent,
  type RoundOption,
  type TextRange,
} from './game-mode';
import type { AskableEntry } from '../entries/entries';
import type { Random } from '../ports';
import { renderStress, STRESS_MARK, stressedVowelsOf, withoutStress } from '../entries/stress';

/**
 * The Words a Distractor may be, best first, by each Distractor rule an
 * Edition may choose. `same-part-of-speech`: the Words of the answer's part of
 * speech in a random order, then the others in a random order.
 */
const distractorOrder: Record<
  DistractorRule,
  (answer: Word, others: readonly Word[], random: Random) => Word[]
> = {
  'same-part-of-speech': (answer, others, random) => [
    ...shuffled(
      others.filter((word) => word.partOfSpeech === answer.partOfSpeech),
      random,
    ),
    ...shuffled(
      others.filter((word) => word.partOfSpeech !== answer.partOfSpeech),
      random,
    ),
  ],
};

/** The Definitions `definitionOf` has told apart, by Entry: every Round compares the answer with all eligible Entries. */
const definitions = new WeakMap<Word | Idiom, string>();

/** A primary Definition as the reader tells it apart: without case, extra spaces or Stress marks. */
function definitionOf(entry: Word | Idiom): string {
  let definition = definitions.get(entry);
  if (definition === undefined) {
    definition = withoutStress(entry.primaryDefinition).toLowerCase().replace(/\s+/g, ' ').trim();
    definitions.set(entry, definition);
  }
  return definition;
}

/** A Word's option, its Lemma with Stress; homonyms share a Lemma, so they never meet in a Round. */
const wordOptions = {
  optionOf: (word: Word): RoundOption => ({
    text: renderStress(word),
    stressedVowels: stressedVowelsOf(word),
  }),
  keyOf: ({ lemma }: Word) => lemma,
};

/** An idiom's option, its expression, which carries no Stress. */
const idiomOptions = {
  optionOf: ({ expression }: Idiom): RoundOption => ({ text: expression, stressedVowels: [] }),
  keyOf: ({ expression }: Idiom) => expression,
};

/** An idiom proper: a place name never plays (ADR 0046). */
const isIdiomProper = (entry: Entry): entry is Idiom =>
  entry.kind === 'idiom' && entry.idiomType === 'idiom';

/** The Rounds of a Game that ask a Word in an Example with a gap, when one has its Lemma (spec #772, L10). */
const GAP_ROUNDS = { first: 6, last: 10 };

/**
 * The first Round of a Game that asks a Word's Definition for the Word typed
 * (spec #772, L10), unless another eligible Word has the same Definition.
 */
const FIRST_TYPED_ROUND = 11;

/**
 * The Round that asks the Word's primary Definition for the Word typed, with
 * no blanks; its sheet shows the Lemma with its Stress and its first Example,
 * if it has one.
 */
const typedRound = (word: Word): RoundContent => ({
  form: 'typed',
  prompt: word.primaryDefinition,
  expected: word.lemma,
  sheet: { answer: wordOptions.optionOf(word), example: word.examples[0] },
});

/** What stands for the Lemma in an Example with a gap. */
const GAP = '…';

/**
 * The gap in a Round's prompt, the highlight that stands for the Lemma in an
 * Example, which the shell reads aloud as a gap; nothing in another Round.
 */
export const gapOf = ({
  prompt,
  highlight,
}: {
  readonly prompt: string;
  readonly highlight?: TextRange | undefined;
}): TextRange | undefined =>
  highlight !== undefined && prompt.slice(highlight.start, highlight.end) === GAP
    ? highlight
    : undefined;

/** A character that belongs to a word: a letter, a mark, a digit, an apostrophe or a hyphen. */
const wordCharacter = /[\p{L}\p{M}\p{N}'’ʼ-]/u;

/**
 * Where the text has the Lemma as written, a whole word, its case and Stress
 * marks set aside, the Stress marks of the match within it; nothing when it
 * has none.
 */
function lemmaIn(text: string, lemma: string): TextRange | undefined {
  const sought = withoutStress(lemma).toLowerCase();
  /** The places of the text's characters but its Stress marks. */
  const places = [...text.matchAll(new RegExp(`[^${STRESS_MARK}]`, 'gu'))].map(
    ({ index }) => index,
  );
  const plain = withoutStress(text).toLowerCase();
  if (plain.length !== places.length) return undefined;
  for (let at = plain.indexOf(sought); at >= 0; at = plain.indexOf(sought, at + 1)) {
    const after = at + sought.length;
    if (wordCharacter.test(plain.charAt(at - 1)) || wordCharacter.test(plain.charAt(after))) {
      continue;
    }
    return { start: places[at] ?? 0, end: places[after] ?? text.length };
  }
  return undefined;
}

/**
 * The first Example of the Word with its Lemma as written, which a gap takes
 * the place of, for a Round from `GAP_ROUNDS.first` to `GAP_ROUNDS.last`;
 * nothing in another Round or without such an Example.
 */
function gapIn(
  word: Word,
  round: number,
): { prompt: string; highlight: TextRange; example: Example } | undefined {
  if (round < GAP_ROUNDS.first || round > GAP_ROUNDS.last) return undefined;
  for (const example of word.examples) {
    const found = lemmaIn(example.text, word.lemma);
    if (found === undefined) continue;
    const { text } = example;
    return {
      prompt: `${text.slice(0, found.start)}${GAP}${text.slice(found.end)}`,
      highlight: { start: found.start, end: found.start + GAP.length },
      example,
    };
  }
  return undefined;
}

/**
 * The Round that asks the answer's primary Definition, or the Example with a
 * gap given, with three Distractors from the candidates, best first, no two
 * options with the same `keyOf`; nothing when fewer than three are left.
 */
function roundOf<T extends Word | Idiom>(
  answer: T,
  candidates: readonly T[],
  { optionOf, keyOf }: { optionOf: (entry: T) => RoundOption; keyOf: (entry: T) => string },
  random: Random,
  gap?: ReturnType<typeof gapIn>,
): RoundContent | undefined {
  const distractors: T[] = [];
  const keys = new Set([keyOf(answer)]);
  for (const candidate of candidates) {
    if (distractors.length === ROUND_OPTIONS - 1) break;
    if (keys.has(keyOf(candidate))) continue;
    keys.add(keyOf(candidate));
    distractors.push(candidate);
  }
  if (distractors.length < ROUND_OPTIONS - 1) return undefined;
  const options = shuffled([answer, ...distractors], random);
  return {
    form: 'pick',
    prompt: gap?.prompt ?? answer.primaryDefinition,
    ...(gap === undefined ? {} : { highlight: gap.highlight }),
    options: options.map(optionOf),
    correct: options.indexOf(answer),
    sheet: { answer: optionOf(answer), example: gap?.example ?? answer.examples[0] },
  };
}

/** How many Synonym Rows must be eligible for any of them to play (spec #730). */
const ROWS_TO_PLAY = 4;

/** A word of a Synonym Row as it reads: its text with its Stress. */
export const rowWordOption = ({ text, stress }: SynonymRowDominant): RoundOption => ({
  text: renderStress({ lemma: text, stress }),
  stressedVowels: stressedVowelsOf({ lemma: text, stress }),
});

/** A word of a Synonym Row as the reader tells it apart: its text without case, whatever its Stress. */
const rowTextOf = ({ text }: SynonymRowDominant) => text.toLowerCase();

/**
 * The Round that asks for a synonym of the row's dominant: one of its
 * members, drawn at random, is right, and the three Distractors are members
 * of three other rows, one of each, whose text is not in the row asked, nor
 * another option's. Nothing with fewer than `ROWS_TO_PLAY` eligible rows, or
 * fewer than three such members.
 */
function synonymRound(
  answer: SynonymRow,
  eligible: readonly AskableEntry[],
  random: Random,
): RoundContent | undefined {
  const others = eligible.filter(
    (entry): entry is SynonymRow => entry.kind === 'synonymRow' && entry.id !== answer.id,
  );
  if (others.length + 1 < ROWS_TO_PLAY) return undefined;
  const taken = new Set([answer.dominant, ...answer.members].map(rowTextOf));
  const distractors: SynonymRowDominant[] = [];
  for (const row of shuffled(others, random)) {
    if (distractors.length === ROUND_OPTIONS - 1) break;
    const [member] = shuffled(
      row.members.filter((each) => !taken.has(rowTextOf(each))),
      random,
    );
    if (member === undefined) continue;
    taken.add(rowTextOf(member));
    distractors.push(member);
  }
  const [right] = shuffled(answer.members, random);
  if (right === undefined || distractors.length < ROUND_OPTIONS - 1) return undefined;
  const options = shuffled([right, ...distractors], random);
  return {
    form: 'pick',
    prompt: rowWordOption(answer.dominant).text,
    options: options.map(rowWordOption),
    correct: options.indexOf(right),
    sheet: { answer: rowWordOption(right), example: answer.example },
  };
}

/** An answer to a Tip's own question, which carries no Stress. */
const tipAnswerOption = (text: string): RoundOption => ({ text, stressedVowels: [] });

/**
 * The Round that is the Tip's own question: its prompt, and its right answer
 * and three wrong ones in a random order (spec #730).
 */
function tipRound({ gameQuestion, example }: Tip, random: Random): RoundContent {
  const { prompt, rightAnswer, wrongAnswers } = gameQuestion;
  const options = shuffled([rightAnswer, ...wrongAnswers], random);
  return {
    form: 'pick',
    prompt,
    options: options.map(tipAnswerOption),
    correct: options.indexOf(rightAnswer),
    sheet: { answer: tipAnswerOption(rightAnswer), example },
  };
}

/**
 * «Вгадай слово», the Core's Definition → Word mode, which asks about idioms
 * too (ADR 0046). A Round shows the answer's primary Definition and four
 * options, none with the answer's primary Definition, so the prompt fits one
 * option only. In Rounds 6–10 a Word's Round shows instead its first Example
 * with the Lemma as written, a gap in its place, which the Round marks; a
 * Word with no such Example is asked by its Definition (ADR 0052). From Round
 * 11 a Word's Round asks its Definition for the Word typed, compared the way
 * `typedAnswerMatches` does, and its sheet shows the Lemma with its Stress; a
 * Word whose Definition another eligible Word shares is asked by a pick
 * instead, so the Round keeps one right answer. A pick of a Word offers four
 * Lemmas with their Stress, the three Distractors by the Edition's Distractor
 * rule, no two with the same Lemma, so homonyms never share a Round. An idiom's Round offers four idioms, the
 * three Distractors drawn at random from the other idioms; a place name is
 * never asked or offered. Its sheet shows the answer and its first Example,
 * if it has one. It asks about Synonym Rows too, with no quota, only while at
 * least 4 are eligible: a row's Round shows its dominant with its Stress, for
 * the screen to ask «Що є синонімом до „{домінанта}“?», and offers one member
 * of the row and three members of other rows (see `synonymRound`); its sheet
 * shows that member and the row's Example, if it has one. It asks about Tips
 * too, with no quota: a Tip's Round is its own question (see `tipRound`); its
 * sheet shows the right answer and the Tip's Example, if it has one.
 */
export const guessWord: GameMode = {
  id: 'guess-word',
  entryKind: 'word',
  alsoAsks: ['idiom', 'synonymRow', 'tip'],
  isOn: () => true,
  buildRound({ answer, eligible, round, random, edition }) {
    if (answer.kind === 'word') {
      const definition = definitionOf(answer);
      const words = eligible.filter((entry): entry is Word => entry.kind === 'word');
      const others = words.filter((entry) => definitionOf(entry) !== definition);
      const sharesDefinition = words.some(
        (entry) => entry.id !== answer.id && definitionOf(entry) === definition,
      );
      if (round >= FIRST_TYPED_ROUND && !sharesDefinition) return typedRound(answer);
      const order = distractorOrder[edition.languageTraits.distractorRule](answer, others, random);
      return roundOf(answer, order, wordOptions, random, gapIn(answer, round));
    }
    if (answer.kind === 'synonymRow') return synonymRound(answer, eligible, random);
    if (answer.kind === 'tip') return tipRound(answer, random);
    if (!isIdiomProper(answer)) return undefined;
    const definition = definitionOf(answer);
    const others = eligible.filter(
      (entry): entry is Idiom => isIdiomProper(entry) && definitionOf(entry) !== definition,
    );
    return roundOf(answer, shuffled(others, random), idiomOptions, random);
  },
};
