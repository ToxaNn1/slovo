import { readFileSync } from 'node:fs';

import { renderStress, type EditionConfig, type Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import type { Authored } from './check-content';
import { RECORDED_TEXTS_FILE, RECORDINGS_DIR, type RecordingFolderEntry } from './edition-folder';

/** How many live Words a Narrator Voice has no Recording of their current text. */
export interface MissingRecordings {
  readonly voice: string;
  readonly count: number;
}

/**
 * The Recordings that would break in the app (ADR 0083): a folder of a
 * Narrator Voice the Edition does not declare, a file that is not an mp3,
 * a folder inside a voice folder, a texts file that does not map Word ids to
 * texts, and a Recording of a Word id the Edition does not have. `isWord` tells
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
      const textsErrors: BuildError[] =
        entry.texts.kind === 'invalid'
          ? [
              {
                file: `${shown}/${RECORDED_TEXTS_FILE}`,
                message: 'Not a map of Word id to the text its Recording was made from',
              },
            ]
          : [];
      const folderErrors = entry.folders.map((name): BuildError => ({
        file: `${shown}/${name}`,
        message: 'Not an mp3',
      }));
      const fileErrors = entry.files.flatMap((name): BuildError[] => {
        const file = `${shown}/${name}`;
        if (!name.endsWith('.mp3') || !isMp3(readFileSync(pathOf(entry.name, name))))
          return [{ file, message: 'Not an mp3' }];
        const wordId = name.slice(0, -'.mp3'.length);
        return isWord(wordId) ? [] : [{ file, message: `No Word ${wordId} in the Edition` }];
      });
      return [...textsErrors, ...folderErrors, ...fileErrors];
    }),
  );
}

/**
 * For each Narrator Voice, in the config's order, how many live Words it has
 * no Recording of their current text: no mp3, or one made from another text.
 * A Retired Word needs no Recording.
 */
export function missingRecordings(
  config: EditionConfig,
  words: readonly Authored<Word>[],
  folder: readonly RecordingFolderEntry[],
): MissingRecordings[] {
  return config.narratorVoices.voices.map(({ id }) => ({
    voice: id,
    count: unrecorded(id, words, folder).length,
  }));
}

/**
 * The text a Narrator Voice reads for a Word: its Lemma with a combining
 * acute after its first stressed vowel (ADR 0083). A Word with more than one
 * valid Stress is recorded once, in its first; a Word without Stress goes as is.
 */
export function recordingText(word: Pick<Word, 'lemma' | 'stress'>): string {
  return renderStress({ lemma: word.lemma, stress: word.stress.slice(0, 1) });
}

/**
 * The live Words, in the given order, that a Narrator Voice has no Recording
 * of their current text: no mp3, or no recorded text equal to `recordingText`.
 */
export function unrecorded<W extends Authored<Word>>(
  voice: string,
  words: readonly W[],
  folder: readonly RecordingFolderEntry[],
): W[] {
  const voiceFolder = folder.find((entry) => entry.kind === 'folder' && entry.name === voice);
  const files = new Set(voiceFolder?.kind === 'folder' ? voiceFolder.files : []);
  const texts =
    voiceFolder?.kind === 'folder' && voiceFolder.texts.kind === 'texts'
      ? voiceFolder.texts.byWord
      : new Map<string, string>();
  return words.filter(
    ({ entry }) =>
      !entry.retired &&
      !(files.has(`${entry.id}.mp3`) && texts.get(entry.id) === recordingText(entry)),
  );
}

/** Whether the bytes open as an mp3: an ID3 tag or an MPEG audio frame. */
function isMp3(bytes: Buffer): boolean {
  if (bytes.toString('latin1', 0, 3) === 'ID3') return true;
  const [first, second] = bytes;
  return first === 0xff && second !== undefined && (second & 0xe0) === 0xe0;
}
