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

/** Downloads the media of the Words the Feed shows next, in the Narrator Voice the reader chose (ADR 0099). */
export async function prefetchAhead(
  shell: Shell,
  wordIds: readonly string[],
  voice: string,
): Promise<void> {
  if (wordIds.length === 0) return;
  await (await shellMedia(shell)).prefetch(wordIds, voice);
}

/**
 * A Word's Illustration for its card (ADR 0099): the Starter Media asset or
 * the cached file, none while the file is still remote, filled in once it
 * arrives. The caller passes the reader's Narrator Voice, so media never
 * imports settings (settings → feed → media is one way).
 */
export function useWordIllustration(wordId: string, voice: string): IllustrationSource | undefined {
  const shell = useShell();
  const [shown, setShown] = useState<{ wordId: string; source: IllustrationSource | undefined }>();
  useEffect(
    () =>
      watchIllustration({
        media: () => shellMedia(shell),
        wordId,
        voice,
        arrivals: onMediaArrived,
        show: (source) => {
          setShown({ wordId, source });
        },
      }),
    [shell, wordId, voice],
  );
  return shown?.wordId === wordId ? shown.source : undefined;
}
