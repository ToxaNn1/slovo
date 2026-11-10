import type { EditionConfig } from '@slovo/contracts';

import type { BuildError } from './build-error';

/**
 * The sample Word the voice screen reads (ADR 0083) must be a Word of the
 * Edition. `isWord` tells whether the Edition has a Word of that id, broken
 * or not, so a broken Word reports its own problem only.
 */
export function sampleWordErrors(
  config: EditionConfig,
  isWord: (id: string) => boolean,
): BuildError[] {
  const sample = config.narratorVoices.sample.word;
  return isWord(sample)
    ? []
    : [
        {
          file: 'edition.json',
          field: 'narratorVoices.sample.word',
          message: `No Word ${sample} in the Edition`,
        },
      ];
}
