import type { Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import { checkContent } from './check-content';
import { readEdition } from './read-edition';

/**
 * Checks Words that are not in the Edition yet with the build's own checks,
 * against the Edition's existing Words and Corrections, and returns the
 * errors that belong to the new Words. The Words must have passed the Word
 * schema. Each is located in the file it would be authored in, so an error
 * reads as the build would print it. The errors of the existing content are
 * left out: `pnpm build:pack` reports those.
 */
export function checkNewWords(editionDir: string, words: readonly Word[]): BuildError[] {
  const {
    config,
    words: existing,
    corrections,
    errors,
  } = readEdition(editionDir, {
    registryRequired: false,
  });
  if (config === undefined) return [...errors];

  const drafts = words.map((entry) => ({ file: `content/words/${entry.id}.json`, entry }));
  const draftFiles = new Set(drafts.map(({ file }) => file));
  return checkContent(config, [...existing, ...drafts], corrections).filter(({ file }) =>
    draftFiles.has(file),
  );
}
