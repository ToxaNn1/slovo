import type { Media } from '@slovo/core';
import type { MediaSource } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { watchIllustration, type IllustrationSource } from './illustration-source';

/** A Core media whose Word `w1` has the Illustration given, which a test changes as files arrive. */
function fakeMedia(illustration: MediaSource<number>, { failing = false } = {}) {
  const used: string[] = [];
  const state = { illustration };
  const media: Media<number> = {
    ofWord: () =>
      failing
        ? Promise.reject(new Error('The pack is closed'))
        : Promise.resolve({ recording: { kind: 'absent' }, illustration: state.illustration }),
    prefetch: () => Promise.resolve(),
    downloadRecording: () => Promise.resolve({ kind: 'absent' }),
    used(wordId, kind, voice) {
      used.push(`${wordId}:${kind}:${voice}`);
      return Promise.resolve();
    },
    patchApplied: () => Promise.resolve(),
  };
  return { media, used, state };
}

/** Watches `w1`'s Illustration and answers what it showed, and a way to signal a file arriving. */
function watch(media: Media<number>) {
  const shown: (IllustrationSource | undefined)[] = [];
  /** Signals a file arriving, while the watch listens; nothing once it stopped. */
  let arrived: (() => void) | undefined;
  const stop = watchIllustration({
    media: () => Promise.resolve(media),
    wordId: 'w1',
    voice: 'taras',
    arrivals: (listener) => {
      arrived = listener;
      return () => {
        arrived = undefined;
      };
    },
    show: (source) => {
      shown.push(source);
    },
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { shown, stop, arrive: () => arrived?.(), settle };
}

describe('the Illustration a Word card shows', () => {
  it('is the bundled Starter Media asset', async () => {
    const { media } = fakeMedia({ kind: 'bundled', asset: 7 });
    const { shown, settle } = watch(media);
    await settle();

    expect(shown).toEqual([7]);
  });

  it('is the cached file, which it marks used', async () => {
    const { media, used } = fakeMedia({ kind: 'cached', uri: 'file:///cache/w1.png' });
    const { shown, settle } = watch(media);
    await settle();

    expect(shown).toEqual([{ uri: 'file:///cache/w1.png' }]);
    expect(used).toEqual(['w1:illustration:taras']);
  });

  it('is none while the file is remote, and fills in once it arrives in the cache', async () => {
    const { media, state } = fakeMedia({ kind: 'remote', url: 'https://media/w1.png' });
    const { shown, settle, arrive } = watch(media);
    await settle();
    expect(shown).toEqual([undefined]);

    state.illustration = { kind: 'cached', uri: 'file:///cache/w1.png' };
    arrive();
    await settle();

    expect(shown).toEqual([undefined, { uri: 'file:///cache/w1.png' }]);
  });

  it('marks the file used once, however many files arrive after', async () => {
    const { media, used, state } = fakeMedia({ kind: 'remote', url: 'https://media/w1.png' });
    const { shown, settle, arrive } = watch(media);
    await settle();
    state.illustration = { kind: 'cached', uri: 'file:///cache/w1.png' };
    arrive();
    await settle();
    arrive();
    arrive();
    await settle();

    expect(shown).toEqual([undefined, { uri: 'file:///cache/w1.png' }]);
    expect(used).toEqual(['w1:illustration:taras']);
  });

  it('is none when the Word has none or the media cannot be read', async () => {
    const absent = watch(fakeMedia({ kind: 'absent' }).media);
    const failing = watch(fakeMedia({ kind: 'bundled', asset: 7 }, { failing: true }).media);
    await absent.settle();

    expect(absent.shown).toEqual([undefined]);
    expect(failing.shown).toEqual([undefined]);
  });

  it('shows nothing more once stopped', async () => {
    const { media, state } = fakeMedia({ kind: 'remote', url: 'https://media/w1.png' });
    const { shown, settle, arrive, stop } = watch(media);
    stop();
    state.illustration = { kind: 'bundled', asset: 7 };
    arrive();
    await settle();

    expect(shown).toEqual([]);
  });
});
