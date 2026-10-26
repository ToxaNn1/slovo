import type { EditionConfig, SynonymRow, Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checkStress, type Authored } from './check-content';

/**
 * The checks the schema can't make on a Synonym Row alone: they need the
 * Edition config or the Words. The schema already holds a row's shape: 5 to
 * 12 members, a shade note of at most 60 characters, at least one source.
 * A link to a Retired Word is no fault: the build drops it, and the dominant
 * or the member stays as plain text.
 */
export function checkSynonymRows(
  config: EditionConfig,
  words: readonly Authored<Word>[],
  synonymRows: readonly Authored<SynonymRow>[],
): BuildError[] {
  const errors: BuildError[] = [];
  const wordIds = new Set(words.map(({ entry }) => entry.id));

  for (const { file, entry: row } of synonymRows) {
    const fail = (field: string, message: string) => {
      errors.push({ file, entryId: row.id, field, message });
    };

    const rowWords = [
      { field: 'dominant', word: row.dominant },
      ...row.members.map((word, place) => ({ field: `members.${String(place)}`, word })),
    ];
    for (const { field, word } of rowWords) {
      if (word.wordId !== undefined && !wordIds.has(word.wordId)) {
        fail(`${field}.wordId`, `Unknown Word "${word.wordId}"`);
      }
      checkStress(
        config,
        { text: word.text, stress: word.stress, named: 'text' },
        (index, message) => {
          fail(`${field}.stress.${String(index)}`, message);
        },
      );
    }

    const placeByText = new Map<string, number>();
    row.members.forEach((member, place) => {
      const text = member.text.toLocaleLowerCase(config.locale);
      const first = placeByText.get(text);
      if (first === undefined) {
        placeByText.set(text, place);
      } else {
        fail(
          `members.${String(place)}.text`,
          `Same text as members.${String(first)}: a row names each word once`,
        );
      }
    });
  }
  return errors;
}
