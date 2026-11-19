import type { Media, RecordingMedia } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { recordingSourceOf } from './recording-source';

/** A Core media whose Word `w1` has the Recording given, and the Words it marked used or downloaded. */
function fakeMedia(
  recording: RecordingMedia<number>,
  {
    downloaded = recording,
    failing = false,
  }: { downloaded?: RecordingMedia<number>; failing?: boolean } = {},
) {
  const used: string[] = [];
  const downloads: string[] = [];
  const voices: string[] = [];
  const media: Media<number> = {
    ofWord(_wordId, voice) {
      voices.push(voice);
      return failing
        ? Promise.reject(new Error('The pack is closed'))
        : Promise.resolve({ recording, illustration: { kind: 'absent' } });
    },
    prefetch: () => Promise.resolve(),
    downloadRecording(wordId, voice) {
      downloads.push(`${wordId}:${voice}`);
      return downloaded.kind === 'remote'
        ? Promise.reject(new Error('Offline'))
        : Promise.resolve(downloaded);
    },
    used(wordId, kind, voice) {
      used.push(`${wordId}:${kind}:${voice}`);
      return Promise.resolve();
    },
    patchApplied: () => Promise.resolve(),
  };
  return { media, used, downloads, voices };
}

describe('the Recording a Pronunciation plays', () => {
  it('is the bundled Starter Media asset', async () => {
    const { media, downloads, voices } = fakeMedia({ kind: 'bundled', asset: 7 });

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({ kind: 'found', source: 7 });
    expect(voices).toEqual(['taras']);
    expect(downloads).toEqual([]);
  });

  it('is the cached file even when marking it used fails', async () => {
    const { media } = fakeMedia({ kind: 'cached', uri: 'file:///cache/w1.mp3' });
    media.used = () => Promise.reject(new Error('The cache order is locked'));

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'found',
      source: { uri: 'file:///cache/w1.mp3' },
    });
  });

  it('is the cached file, marked played so the cache keeps it longer', async () => {
    const { media, used } = fakeMedia({ kind: 'cached', uri: 'file:///cache/w1.mp3' });

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'found',
      source: { uri: 'file:///cache/w1.mp3' },
    });
    expect(used).toEqual(['w1:recording:taras']);
  });

  it('is downloaded first when the Media Store holds it and the cache does not', async () => {
    const { media, downloads, used } = fakeMedia(
      { kind: 'remote', url: 'https://media.slovo.test/w1.mp3' },
      { downloaded: { kind: 'cached', uri: 'file:///cache/w1.mp3' } },
    );

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'found',
      source: { uri: 'file:///cache/w1.mp3' },
    });
    expect(downloads).toEqual(['w1:taras']);
    expect(used).toEqual(['w1:recording:taras']);
  });

  it('is missing offline when the download fails', async () => {
    const { media } = fakeMedia({ kind: 'remote', url: 'https://media.slovo.test/w1.mp3' });

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'missing',
      reason: 'offline',
    });
  });

  it('is missing in the chosen voice when the Word has Recordings in other voices only', async () => {
    const { media, downloads } = fakeMedia({ kind: 'other-voices' });

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'missing',
      reason: 'other-voices',
    });
    expect(downloads).toEqual([]);
  });

  it('is missing when the Word has no Recording', async () => {
    const { media } = fakeMedia({ kind: 'absent' });

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'missing',
      reason: 'no-recording',
    });
  });

  it('is missing when the media cannot be read', async () => {
    const { media } = fakeMedia({ kind: 'bundled', asset: 7 }, { failing: true });

    expect(await recordingSourceOf(media, 'w1', 'taras')).toEqual({
      kind: 'missing',
      reason: 'no-recording',
    });
  });
});
