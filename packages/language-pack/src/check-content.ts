import type { Correction, EditionConfig, Entry, Word } from '@slovo/contracts';

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
): BuildError[] {
  const errors: BuildError[] = [];
  const { marksStress, vowels } = config.languageTraits;
  const categoryIds = new Set(config.categories.map((category) => category.id));
  const correctionIds = new Set(corrections.map(({ entry }) => entry.id));
  const fileById = new Map<string, string>();

  for (const { file, entry } of [...words, ...corrections]) {
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
  return errors;
}
