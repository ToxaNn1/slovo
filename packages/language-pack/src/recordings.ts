import { renderStress, type EditionConfig, type Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import type { Authored } from '@slovo/content-rules';
import type { RecordingFolderEntry } from './edition-folder';

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
