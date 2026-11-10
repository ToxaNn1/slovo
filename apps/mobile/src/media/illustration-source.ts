import type { Media } from '@slovo/core';

import { logError } from '../diagnostics/log';

/** What a Word card draws as its Illustration: a bundled asset id or a cached file. */
export type IllustrationSource = number | { readonly uri: string };

/** The Illustration of a Word the device holds now: the Starter Media asset or the cached file, else none. */
async function illustrationSourceOf(
  media: Media<number>,
  wordId: string,
): Promise<IllustrationSource | undefined> {
  const source = (await media.ofWord(wordId)).illustration;
  switch (source.kind) {
    case 'bundled':
      return source.asset;
    case 'cached':
      await media.used(wordId, 'illustration');
      return { uri: source.uri };
    default:
      return undefined;
  }
}

/**
 * Shows a Word's Illustration (ADR 0099): the bundled Starter Media, else the
 * cached file, else none while the file is still in the Media Store; each
 * file that arrives in the cache reads it again, so a card fills in once its
 * download lands. A card never downloads an Illustration itself: the Feed's
 * prefetch does. Media that cannot be read shows none. Answers the stop.
 */
export function watchIllustration({
  media,
  wordId,
  arrivals,
  show,
}: {
  media: () => Promise<Media<number>>;
  wordId: string;
  arrivals: (listener: () => void) => () => void;
  show: (source: IllustrationSource | undefined) => void;
}): () => void {
  let watching = true;
  const read = async () => {
    let source: IllustrationSource | undefined;
    try {
      source = await illustrationSourceOf(await media(), wordId);
    } catch (error) {
      logError('Could not get the Illustration of a Word', error);
    }
    if (watching) show(source);
  };
  void read();
  const stopArrivals = arrivals(() => void read());
  return () => {
    watching = false;
    stopArrivals();
  };
}
