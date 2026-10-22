import type { Correction, EditionConfig, Entry, Idiom, Word } from '@slovo/contracts';
import { STRESS_MARK, withoutStress } from '@slovo/core';

import type { BuildError } from './build-error';

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
  const { marksStress, vowels, alphabet, lemmaPunctuation = [] } = config.languageTraits;
  // Longest first, so a letter written with several characters wins over its first character.
  const lemmaTokens = [...alphabet, ...lemmaPunctuation].toSorted((a, b) => b.length - a.length);
  const categoryIds = new Set(config.categories.map((category) => category.id));
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

    if (!marksStress) {
      if (word.stress.length > 0) fail('stress', 'Not allowed: the Edition does not mark Stress');
      continue;
    }
    if (word.stress.length === 0) {
      fail('stress', 'Required: the Edition marks Stress');
      continue;
    }
    const letters = Array.from(word.lemma);
    word.stress.forEach((position, index) => {
      const letter = letters[position];
      if (letter === undefined) {
        fail(
          `stress.${String(index)}`,
          `Position ${String(position)} is out of range for the ${String(letters.length)}-letter Lemma`,
        );
      } else if (
        vowels !== undefined &&
        !vowels.includes(letter.toLocaleLowerCase(config.locale))
      ) {
        fail(`stress.${String(index)}`, `Position ${String(position)} is "${letter}", not a vowel`);
      }
    });
  }

  for (const { file, entry: correction } of corrections) {
    const fail = (field: string, message: string) => {
      errors.push({ file, entryId: correction.id, field, message });
    };
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
