import type { Media } from '@slovo/core';

import { logError } from '../diagnostics/log';

/** What a Word card draws as its Illustration: a bundled asset id or a cached file. */
export type IllustrationSource = number | { readonly uri: string };

/** The Illustration of a Word the device holds now: the Starter Media asset or the cached file, else none. */
async function illustrationSourceOf(
  media: Media<number>,
  wordId: string,
  voice: string,
): Promise<IllustrationSource | undefined> {
  const source = (await media.ofWord(wordId, voice)).illustration;
  switch (source.kind) {
    case 'bundled':
      return source.asset;
    case 'cached':
      return { uri: source.uri };
    default:
      return undefined;
  }
}

/**
 * Shows a Word's Illustration (ADR 0099): the bundled Starter Media, else the
 * cached file, else none while the file is still in the Media Store; each
 * file that arrives in the cache reads it again until the card has its
 * Illustration, so a card fills in once its download lands and marks it used
 * once. A card never downloads an Illustration itself: the Feed's prefetch
 * does. Media that cannot be read shows none. Answers the stop.
 */
export function watchIllustration({
  media,
  wordId,
  voice,
  arrivals,
  show,
}: {
  media: () => Promise<Media<number>>;
  wordId: string;
  /** The Narrator Voice the reader chose, which the Core media reads a card's media in. */
  voice: string;
  arrivals: (listener: () => void) => () => void;
  show: (source: IllustrationSource | undefined) => void;
}): () => void {
  let watching = true;
  const read = async () => {
    try {
      const opened = await media();
      const source = await illustrationSourceOf(opened, wordId, voice);
      if (!watching) return;
      if (source !== undefined) stop();
      show(source);
      if (typeof source === 'object') await opened.used(wordId, 'illustration', voice);
    } catch (error) {
      logError('Could not get the Illustration of a Word', error);
      if (watching) show(undefined);
    }
  };
  const stopArrivals = arrivals(() => void read());
  const stop = () => {
    watching = false;
    stopArrivals();
  };
  void read();
  return stop;
}
