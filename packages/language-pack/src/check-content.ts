import type { Correction, EditionConfig, Entry, Idiom, Word } from '@slovo/contracts';
import { STRESS_MARK, withoutStress } from '@slovo/core';

import type { BuildError } from './build-error';

/**
 * Checks that each Stress position of a text falls on one of its letters, and
 * on a vowel when the Edition names its vowels; `fail` gets the index of each
 * position that does not, and why.
 */
export function checkStress(
  config: EditionConfig,
  { text, stress, named }: { text: string; stress: readonly number[]; named: string },
  fail: (index: number, message: string) => void,
): void {
  const { vowels } = config.languageTraits;
  const letters = Array.from(text);
  stress.forEach((position, index) => {
    const letter = letters[position];
    if (letter === undefined) {
      fail(
        index,
        `Position ${String(position)} is out of range for the ${String(letters.length)}-letter ${named}`,
      );
    } else if (vowels !== undefined && !vowels.includes(letter.toLocaleLowerCase(config.locale))) {
      fail(index, `Position ${String(position)} is "${letter}", not a vowel`);
    }
  });
}

/** An Entry that passed the schema, with the file it was authored in. */
export interface Authored<T extends Entry> {
  readonly file: string;
  readonly entry: T;
}

/**
 * The checks the schema can't make on one Entry alone: they need the Edition
 * config or the other Entries.
 */
export function checkContent(
  config: EditionConfig,
  words: readonly Authored<Word>[],
  corrections: readonly Authored<Correction>[],
  idioms: readonly Authored<Idiom>[],
): BuildError[] {
  const errors: BuildError[] = [];
  const {
    marksStress,
    vowels,
    alphabet,
    lemmaPunctuation = [],
    expressionPunctuation = [],
  } = config.languageTraits;
  // Longest first, so a letter written with several characters wins over its first character.
  const lemmaTokens = [...alphabet, ...lemmaPunctuation].toSorted((a, b) => b.length - a.length);
  const categoryIds = new Set(config.categories.map((category) => category.id));
  const correctionCategoryIds = new Set(config.correctionCategories.map(({ id }) => id));
  const categoriesRequiringHistory = new Set(config.categoriesRequiringHistory);
  const originCodes = new Set(config.originLanguages.map(({ code }) => code));
  const correctionIds = new Set(corrections.map(({ entry }) => entry.id));
  const fileById = new Map<string, string>();

  for (const { file, entry } of [...words, ...corrections, ...idioms]) {
    const firstFile = fileById.get(entry.id);
    if (firstFile === undefined) {
      fileById.set(entry.id, file);
    } else {
      const message = `Duplicate id, already used in ${firstFile}`;
      errors.push({ file, entryId: entry.id, field: 'id', message });
    }
  }

  // Homonyms are separate Words with their own Definitions, so two live Words
  // with the same Lemma and primary Definition are one Word authored twice.
  const wordByLemmaAndDefinition = new Map<string, Authored<Word>>();

  for (const { file, entry } of [...words, ...corrections, ...idioms]) {
    for (const [field, message] of mixedScriptWords(entry)) {
      errors.push({ file, entryId: entry.id, field, message });
    }
  }

  for (const { file, entry: word } of words) {
    const fail = (field: string, message: string) => {
      errors.push({ file, entryId: word.id, field, message });
    };

    const stray = strayCharacter(word.lemma.toLocaleLowerCase(config.locale), lemmaTokens);
    if (stray !== undefined) {
      const code = codePointLabel(stray);
      fail(
        'lemma',
        /\p{M}/u.test(stray)
          ? `Holds the combining mark ${code}: mark Stress in the stress field and write every letter whole`
          : `"${stray}" (${code}) is not a letter of the alphabet or punctuation the Edition allows`,
      );
    }

    if (!word.retired) {
      const key = JSON.stringify([word.lemma, word.primaryDefinition.trim()]);
      const first = wordByLemmaAndDefinition.get(key);
      if (first === undefined) {
        wordByLemmaAndDefinition.set(key, { file, entry: word });
      } else if (first.entry.id !== word.id) {
        fail(
          'primaryDefinition',
          `Same Lemma and primary Definition as ${first.entry.id} in ${first.file}: author it once, or retire one of them`,
        );
      }
    }

    word.correctionIds.forEach((id, index) => {
      if (!correctionIds.has(id)) {
        fail(`correctionIds.${String(index)}`, `Unknown Correction "${id}"`);
      }
    });

    if (!categoryIds.has(word.categoryId)) {
      fail('categoryId', `Unknown Category "${word.categoryId}"`);
    }

    if (word.history === undefined && categoriesRequiringHistory.has(word.categoryId)) {
      fail('history', `Required: Category "${word.categoryId}" requires history`);
    }

    if (word.origin !== undefined && !originCodes.has(word.origin)) {
      fail(
        'origin',
        `Unknown origin language "${word.origin}": the Edition's originLanguages list no such code`,
      );
    }

    if (!marksStress) {
      if (word.stress.length > 0) fail('stress', 'Not allowed: the Edition does not mark Stress');
      continue;
    }
    if (word.stress.length === 0) {
      fail('stress', 'Required: the Edition marks Stress');
      continue;
    }
    checkStress(
      config,
      { text: word.lemma, stress: word.stress, named: 'Lemma' },
      (index, message) => {
        fail(`stress.${String(index)}`, message);
      },
    );
  }

  // An expression holds words, so it may also hold a space, its letters in
  // either case, such as a place name's capital, and the Edition's
  // expression punctuation, such as a proverb's comma.
  const expressionTokens = [
    ...alphabet.flatMap((letter) => [letter, letter.toLocaleUpperCase(config.locale)]),
    ...lemmaPunctuation,
    ...expressionPunctuation,
    ' ',
  ].toSorted((a, b) => b.length - a.length);
  // A live Idiom's expression, in lower case, names one Idiom only.
  const idiomByExpression = new Map<string, Authored<Idiom>>();

  for (const { file, entry: idiom } of idioms) {
    const fail = (message: string) => {
      errors.push({ file, entryId: idiom.id, field: 'expression', message });
    };

    const stray = strayCharacter(idiom.expression, expressionTokens);
    if (stray !== undefined) {
      fail(
        `"${stray}" (${codePointLabel(stray)}) is not a letter of the alphabet, punctuation or space the Edition allows`,
      );
    }

    if (!idiom.retired) {
      const expression = idiom.expression.toLocaleLowerCase(config.locale);
      const first = idiomByExpression.get(expression);
      if (first === undefined) {
        idiomByExpression.set(expression, { file, entry: idiom });
      } else if (first.entry.id !== idiom.id) {
        fail(
          `Same expression as ${first.entry.id} in ${first.file}: author it once, or retire one of them`,
        );
      }
    }
  }

  for (const { file, entry: correction } of corrections) {
    const fail = (field: string, message: string) => {
      errors.push({ file, entryId: correction.id, field, message });
    };
    if (!correctionCategoryIds.has(correction.categoryId)) {
      fail('categoryId', `Unknown Category "${correction.categoryId}"`);
    }
    const texts: readonly (readonly [field: string, text: string])[] = [
      ['nonStandardForm', correction.nonStandardForm],
      ...correction.standardEquivalents.map(
        (text, index) => [`standardEquivalents.${String(index)}`, text] as const,
      ),
      ['explanation', correction.explanation],
      ['examplePair.nonStandard', correction.examplePair.nonStandard],
      ['examplePair.standard', correction.examplePair.standard],
    ];

    if (correction.correctionType !== 'wrongStress') {
      for (const [field, text] of texts) {
        if (text.includes(STRESS_MARK)) {
          fail(field, 'Not allowed: only a wrong-stress Correction writes Stress marks');
        }
      }
      continue;
    }
    if (!marksStress) {
      fail('correctionType', 'Not allowed: the Edition does not mark Stress');
      continue;
    }

    // A stress trap's forms carry their Stress: a mark after a vowel in each.
    const forms = texts.slice(0, 1 + correction.standardEquivalents.length);
    for (const [field, text] of forms) {
      if (!text.includes(STRESS_MARK)) {
        fail(field, 'Required: a wrong-stress Correction writes a Stress mark in each form');
        continue;
      }
      const characters = Array.from(text);
      characters.forEach((character, index) => {
        if (character !== STRESS_MARK) return;
        const letter = characters[index - 1];
        if (letter === undefined || !vowels?.includes(letter.toLocaleLowerCase(config.locale))) {
          fail(field, `The Stress mark follows "${letter ?? ''}", not a vowel`);
        }
      });
    }

    // The two forms are one word said two ways, so only their Stress differs.
    const sameWord = (text: string) => withoutStress(text).toLocaleLowerCase(config.locale);
    const nonStandard = sameWord(correction.nonStandardForm);
    correction.standardEquivalents.forEach((equivalent, index) => {
      if (sameWord(equivalent) !== nonStandard) {
        fail(
          `standardEquivalents.${String(index)}`,
          "A wrong-stress Correction's forms differ only in their Stress marks",
        );
      }
    });
  }
  return errors;
}

const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Armenian', 'Georgian', 'Hebrew', 'Arabic'].map(
  (name) => ({ name, pattern: new RegExp(`\\p{Script=${name}}`, 'u') }),
);

/**
 * The fields the script check leaves out. A Lemma and an Idiom's expression
 * hold only the Edition's alphabet, which is checked already. The etymology
 * quotes forms of other languages in their scholarly spelling, such as
 * Proto-Slavic *světъ with its Cyrillic yer.
 */
const UNCHECKED_SCRIPT_FIELDS = new Set(['lemma', 'expression', 'etymology']);

/**
 * The words of an Entry's text that mix letters of two scripts, such as a Latin
 * "i" copied into a Cyrillic word: they look right but break search and screen
 * readers. Each comes as its dotted field and the message.
 */
function mixedScriptWords(entry: Entry): [field: string, message: string][] {
  const found: [string, string][] = [];
  const visit = (value: unknown, field: string) => {
    if (typeof value === 'string') {
      const words = (value.match(/[\p{L}\p{M}]+/gu) ?? []).map(scriptedWord);
      words.forEach(({ word, letters, main }, index) => {
        const stray = letters.find(({ script }) => script !== main);
        const before = words[index - 1]?.main;
        const after = words[index + 1]?.main;
        if (stray !== undefined) {
          found.push([
            field,
            `The word "${word}" mixes ${main ?? ''} and ${stray.script} letters (${letterLabel(stray.letter)}): write each word in one script`,
          ]);
        } else if (
          // A one-letter word, such as a Latin "i" for the conjunction, in another script than the words around it.
          letters.length === 1 &&
          before !== undefined &&
          before === after &&
          before !== main
        ) {
          found.push([
            field,
            `The word "${word}" stands in ${main ?? ''} between ${before} words (${letterLabel(word)}): write each word in one script`,
          ]);
        }
      });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, `${field}.${String(index)}`);
      });
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        if (field === '' && UNCHECKED_SCRIPT_FIELDS.has(key)) continue;
        visit(item, field === '' ? key : `${field}.${key}`);
      }
    }
  };
  visit(entry, '');
  return found;
}

/** A word's letters with their scripts, and the script most of them are in: the first letter's on a tie. */
function scriptedWord(word: string): {
  word: string;
  letters: { letter: string; script: string }[];
  main: string | undefined;
} {
  const letters = Array.from(word).flatMap((letter) => {
    const script = SCRIPTS.find(({ pattern }) => pattern.test(letter));
    return script === undefined ? [] : [{ letter, script: script.name }];
  });
  const count = (script: string) => letters.filter((letter) => letter.script === script).length;
  const main = letters
    .map(({ script }) => script)
    .reduce<string | undefined>((best, script) => {
      return best === undefined || count(script) > count(best) ? script : best;
    }, undefined);
  return { word, letters, main };
}

function letterLabel(letter: string): string {
  return `"${letter}" ${codePointLabel(letter)}`;
}

/** The first character of the text that no token covers, reading the tokens off from the start. */
function strayCharacter(text: string, tokens: readonly string[]): string | undefined {
  let rest = text;
  while (rest !== '') {
    const token = tokens.find((candidate) => rest.startsWith(candidate));
    if (token === undefined) return Array.from(rest)[0];
    rest = rest.slice(token.length);
  }
  return undefined;
}

/** A character's Unicode code point, such as U+0301. */
function codePointLabel(character: string): string {
  const hex = (character.codePointAt(0) ?? 0).toString(16).toUpperCase();
  return `U+${hex.padStart(4, '0')}`;
}
