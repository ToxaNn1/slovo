import type { EditionFiles } from './edition-folder';
import { recordingText, unrecorded } from './recordings';

/** One Recording to generate: a Word in a Narrator Voice, and the text the voice reads. */
export interface RecordingRequest {
  readonly voice: string;
  readonly wordId: string;
  /** The Lemma with a combining acute after its first stressed vowel (`recordingText`). */
  readonly text: string;
}

/**
 * Which Recordings to ask for: every live Word in every voice, or only those
 * a voice has no Recording of their current text.
 */
export type RecordingScope = 'all' | 'missing';

/**
 * The Recordings to generate for an Edition (ADR 0083): its Words in each of
 * its Narrator Voices, voices in the config's order and Words in the
 * Edition's stable order. Only live Words are recorded: a Retired Word never.
 */
export function recordingRequests(
  edition: EditionFiles,
  scope: RecordingScope,
): RecordingRequest[] {
  const { voices } = edition.read('config').narratorVoices;
  const { words } = edition.entries();
  const folder = edition.recordings();
  return voices.flatMap(({ id: voice }) =>
    (scope === 'all' ? unrecorded(voice, words, []) : unrecorded(voice, words, folder)).map(
      ({ entry }) => ({ voice, wordId: entry.id, text: recordingText(entry) }),
    ),
  );
}
