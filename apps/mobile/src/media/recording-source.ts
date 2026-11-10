import type { Media } from '@slovo/core';

import { logError } from '../diagnostics/log';

/** What the Recording player plays: a bundled asset id or a cached file. */
export type RecordingSource = number | { readonly uri: string };

/**
 * The Recording a Pronunciation plays for a Word (ADR 0099): the bundled
 * Starter Media, else the cached file, else the file downloaded from the
 * Media Store at the tap. None when the Word has no Recording, the download
 * fails or the media cannot be read: the device voice reads it then.
 */
export async function recordingSourceOf(
  media: Media<number>,
  wordId: string,
): Promise<RecordingSource | undefined> {
  try {
    let source = (await media.ofWord(wordId)).recording;
    if (source.kind === 'remote') source = await media.downloadRecording(wordId);
    switch (source.kind) {
      case 'bundled':
        return source.asset;
      case 'cached':
        await media.used(wordId, 'recording');
        return { uri: source.uri };
      default:
        return undefined;
    }
  } catch (error) {
    logError('Could not get the Recording of a Word', error);
    return undefined;
  }
}
