import { listEditions, openEdition } from '@slovo/language-pack/edition';
import type { Edition } from '@slovo/server-core';

/**
 * Every Edition in an editions folder, each with its config and strings
 * checked against the contracts and its content manifest (ADR 0011, 0035).
 * Throws an EditionFolderError naming the broken file when an Edition can't
 * be read, so the server doesn't start with it.
 */
export function readEditions(editionsDir: string): Edition[] {
  return listEditions(editionsDir).map((editionId) => {
    const edition = openEdition(editionsDir, editionId);
    return {
      config: edition.config,
      strings: edition.read('strings'),
      manifest: edition.read('manifest'),
    };
  });
}
