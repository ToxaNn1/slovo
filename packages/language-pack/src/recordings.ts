import { readFileSync } from 'node:fs';

import type { EditionConfig, Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import type { Authored } from './check-content';
import { RECORDINGS_DIR, type RecordingFolderEntry } from './edition-folder';

/** How many Words a Narrator Voice has no Recording of. */
export interface MissingRecordings {
  readonly voice: string;
  readonly count: number;
}

/**
 * The Recordings that would break in the app (ADR 0083): a folder of a
 * Narrator Voice the Edition does not declare, a file that is not an mp3,
 * and a Recording of a Word id the Edition does not have. `isWord` tells
 * whether the Edition has a Word of that id, broken or not, so a broken Word
 * reports its own problem only. A Word without a Recording is no error: the
 * device's voice reads it, and `missingRecordings` counts it.
 */
export function recordingErrors(
  config: EditionConfig,
  isWord: (id: string) => boolean,
  folder: readonly RecordingFolderEntry[],
  pathOf: (voice: string, name: string) => string,
): BuildError[] {
  const voices = new Set(config.narratorVoices.voices.map(({ id }) => id));
  const sample = config.narratorVoices.sample.word;
  const sampleErrors: BuildError[] = isWord(sample)
    ? []
    : [
        {
          file: 'edition.json',
          field: 'narratorVoices.sample.word',
          message: `No Word ${sample} in the Edition`,
        },
      ];
  return sampleErrors.concat(
    folder.flatMap((entry): BuildError[] => {
      const shown = `${RECORDINGS_DIR}/${entry.name}`;
      if (entry.kind === 'file') return [{ file: shown, message: 'Not a Narrator Voice folder' }];
      if (!voices.has(entry.name))
        return [{ file: shown, message: `No Narrator Voice ${entry.name} in the Edition config` }];
      return entry.files.flatMap((name): BuildError[] => {
        const file = `${shown}/${name}`;
        if (!name.endsWith('.mp3') || !isMp3(readFileSync(pathOf(entry.name, name))))
          return [{ file, message: 'Not an mp3' }];
        const wordId = name.slice(0, -'.mp3'.length);
        return isWord(wordId) ? [] : [{ file, message: `No Word ${wordId} in the Edition` }];
      });
    }),
  );
}

/** For each Narrator Voice, in the config's order, how many Words it has no Recording of. */
export function missingRecordings(
  config: EditionConfig,
  words: readonly Authored<Word>[],
  folder: readonly RecordingFolderEntry[],
): MissingRecordings[] {
  return config.narratorVoices.voices.map(({ id }) => {
    const files = new Set(
      folder.flatMap((entry) => (entry.kind === 'folder' && entry.name === id ? entry.files : [])),
    );
    return {
      voice: id,
      count: words.filter(({ entry }) => !files.has(`${entry.id}.mp3`)).length,
    };
  });
}

/** Whether the bytes open as an mp3: an ID3 tag or an MPEG audio frame. */
function isMp3(bytes: Buffer): boolean {
  if (bytes.toString('latin1', 0, 3) === 'ID3') return true;
  const [first, second] = bytes;
  return first === 0xff && second !== undefined && (second & 0xe0) === 0xe0;
}
