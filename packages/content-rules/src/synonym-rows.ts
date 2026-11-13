import type { EditionConfig, SynonymRow, Word } from '@slovo/contracts';

import { checkStress } from './entries';
import type { Authored, Refusal, RuleName } from './refusal';

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
  checksFile: (file: string) => boolean = () => true,
): Refusal[] {
  const errors: Refusal[] = [];
  const wordIds = new Set(words.map(({ entry }) => entry.id));

  for (const { file, entry: row } of synonymRows) {
    // Every rule here is a rule of one row alone.
    if (!checksFile(file)) continue;
    const fail = (rule: RuleName, field: string, message: string) => {
      errors.push({ rule, file, entryId: row.id, field, message });
    };

    const rowWords = [
      { field: 'dominant', word: row.dominant },
      ...row.members.map((word, place) => ({ field: `members.${String(place)}`, word })),
    ];
    for (const { field, word } of rowWords) {
      if (word.wordId !== undefined && !wordIds.has(word.wordId)) {
        fail('synonym-row-word', `${field}.wordId`, `Unknown Word "${word.wordId}"`);
      }
      checkStress(
        config,
        { text: word.text, stress: word.stress, named: 'text' },
        (index, message) => {
          fail('stress', `${field}.stress.${String(index)}`, message);
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
          'unique-synonym-text',
          `members.${String(place)}.text`,
          `Same text as members.${String(first)}: a row names each word once`,
        );
      }
    });
  }
  return errors;
}
