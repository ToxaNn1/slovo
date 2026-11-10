import type { Media } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useShell, type Shell } from '../shell-value';
import { onMediaArrived } from './device-media';
import { watchIllustration, type IllustrationSource } from './illustration-source';
import { followEditionInEffect, storeMedia } from './store-media';

/** The Core media of a shell's Language Pack, by the Feature Switches in effect. */
export async function shellMedia(shell: Shell): Promise<Media<number>> {
  const [{ store }, switches] = await Promise.all([
    shell.languagePack.opened(),
    shell.remoteSwitches.opened(),
  ]);
  followEditionInEffect(switches.edition);
  return storeMedia(store);
}

/** Downloads the media of the Words the Feed shows next (ADR 0099). */
export async function prefetchAhead(shell: Shell, wordIds: readonly string[]): Promise<void> {
  if (wordIds.length === 0) return;
  await (await shellMedia(shell)).prefetch(wordIds);
}

/**
 * A Word's Illustration for its card (ADR 0099): the Starter Media asset or
 * the cached file, none while the file is still remote, filled in once it
 * arrives.
 */
export function useWordIllustration(wordId: string): IllustrationSource | undefined {
  const shell = useShell();
  const [shown, setShown] = useState<{ wordId: string; source: IllustrationSource | undefined }>();
  useEffect(
    () =>
      watchIllustration({
        media: () => shellMedia(shell),
        wordId,
        arrivals: onMediaArrived,
        show: (source) => {
          setShown({ wordId, source });
        },
      }),
    [shell, wordId],
  );
  return shown?.wordId === wordId ? shown.source : undefined;
}
