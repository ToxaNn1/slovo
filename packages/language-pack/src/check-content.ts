import type { EditionConfig, Word } from '@slovo/contracts';

import type { BuildError } from './build-error';

/** A Word that passed the schema, with the file it was authored in. */
export interface AuthoredWord {
  readonly file: string;
  readonly word: Word;
}

/**
 * The checks the schema can't make on one Entry alone: they need the Edition
 * config or the other Entries.
 */
export function checkContent(config: EditionConfig, words: readonly AuthoredWord[]): BuildError[] {
  const errors: BuildError[] = [];
  const { marksStress, vowels } = config.languageTraits;
  const categoryIds = new Set(config.categories.map((category) => category.id));
  const fileById = new Map<string, string>();

  for (const { file, word } of words) {
    const fail = (field: string, message: string) => {
      errors.push({ file, entryId: word.id, field, message });
    };

    const firstFile = fileById.get(word.id);
    if (firstFile === undefined) fileById.set(word.id, file);
    else fail('id', `Duplicate id, already used in ${firstFile}`);

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
  return errors;
}
