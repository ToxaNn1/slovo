import type { Media, RecordingMedia } from '@slovo/core';

import { logError } from '../diagnostics/log';

/** What the Recording player plays: a bundled asset id or a cached file. */
export type RecordingSource = number | { readonly uri: string };

/**
 * What a tap finds for a Word in the chosen Narrator Voice: its Recording, or
 * why it has none to play: Recordings in other voices only, none at all
 * (or media that cannot be read), or a Recording not cached that could not
 * download, offline (ADR 0195).
 */
export type RecordingLookup =
  | { readonly kind: 'found'; readonly source: RecordingSource }
  | { readonly kind: 'missing'; readonly reason: 'other-voices' | 'no-recording' | 'offline' };

/**
 * The Recording a Pronunciation plays for a Word (ADR 0099): the bundled
 * Starter Media, else the cached file, else the file downloaded from the
 * Media Store at the tap. The Recording is the one in `voice`, the Narrator
 * Voice that reads the Word; when there is none to play, the lookup says why.
 */
export async function recordingSourceOf(
  media: Media<number>,
  wordId: string,
  voice: string,
): Promise<RecordingLookup> {
  let source: RecordingMedia<number>;
  try {
    source = (await media.ofWord(wordId, voice)).recording;
  } catch (error) {
    logError('Could not read the Recording of a Word', error);
    return { kind: 'missing', reason: 'no-recording' };
  }
  try {
    if (source.kind === 'remote') source = await media.downloadRecording(wordId, voice);
    switch (source.kind) {
      case 'bundled':
        return { kind: 'found', source: source.asset };
      case 'cached':
        await media.used(wordId, 'recording', voice);
        return { kind: 'found', source: { uri: source.uri } };
      case 'remote':
        return { kind: 'missing', reason: 'offline' };
      case 'other-voices':
        return { kind: 'missing', reason: 'other-voices' };
      case 'absent':
        return { kind: 'missing', reason: 'no-recording' };
    }
  } catch (error) {
    logError('Could not download the Recording of a Word', error);
    return { kind: 'missing', reason: 'offline' };
  }
}
