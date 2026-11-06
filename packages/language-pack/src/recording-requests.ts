import { renderStress } from '@slovo/contracts';

import type { EditionFiles } from './edition-folder';

/** One Recording to generate: a Word in a Narrator Voice, and the text the voice reads. */
export interface RecordingRequest {
  readonly voice: string;
  readonly wordId: string;
  /** The Lemma with a combining acute after each stressed vowel; a Word without Stress goes as is. */
  readonly text: string;
}

/** Which Recordings to ask for: every Word in every voice, or only those a voice has no Recording of. */
export type RecordingScope = 'all' | 'missing';

/**
 * The Recordings to generate for an Edition (ADR 0083): its Words in each of
 * its Narrator Voices, voices in the config's order and Words in the
 * Edition's stable order. Only Words are recorded.
 */
export function recordingRequests(
  edition: EditionFiles,
  scope: RecordingScope,
): RecordingRequest[] {
  const { voices } = edition.read('config').narratorVoices;
  const { words } = edition.entries();
  const folder = edition.recordings();
  return voices.flatMap(({ id: voice }) => {
    const recorded = new Set(
      scope === 'all'
        ? []
        : folder.flatMap((entry) =>
            entry.kind === 'folder' && entry.name === voice ? entry.files : [],
          ),
    );
    return words
      .filter(({ entry }) => !recorded.has(`${entry.id}.mp3`))
      .map(({ entry }) => ({ voice, wordId: entry.id, text: renderStress(entry) }));
  });
}
