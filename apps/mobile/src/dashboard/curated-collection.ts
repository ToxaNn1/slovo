import type { Composition, CuratedCollectionScreen as Screen } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { keep } from '../keep';
import { useOpenScreen } from '../use-open-screen';

/** What a Curated Collection's screen draws and does. */
export interface CuratedCollectionScreen {
  /**
   * The collection, its Entries and «Знаю X з N»; `undefined` until the first
   * read ends, `null` for an id with no screen (not on the rail, or the switch off).
   */
  readonly screen: Screen | null | undefined;
  /** Its tile's place on the rail, which picks its pictogram; 0 once it left the rail. */
  readonly place: number;
  /** «+ Додати»: copies it into the reader's Collections. */
  readonly add: () => void;
  /** Opens an Entry's card, which makes nothing Seen (ADR 0076). */
  readonly openEntry: (entryId: string) => void;
}

/**
 * A Curated Collection's screen (ADR 0076), read again on each change the
 * Core tells of, so a Knowledge Mark or a copy shows at once.
 */
export function useCuratedCollectionScreen(collectionId: string): CuratedCollectionScreen {
  const composition = useComposition();
  const { curatedCollections } = composition;
  const openScreen = useOpenScreen();
  const [read, setRead] = useState<{ in: Composition; id: string; screen: Screen | null }>();
  useEffect(() => {
    let active = true;
    // Only the latest read is shown: an earlier one that ends after it is dropped.
    let latest = 0;
    const reread = () => {
      latest += 1;
      const mine = latest;
      curatedCollections.screen(collectionId).then(
        (screen) => {
          if (active && mine === latest)
            setRead({ in: composition, id: collectionId, screen: screen ?? null });
        },
        (error: unknown) => {
          logError('Could not read a Curated Collection', error);
        },
      );
    };
    reread();
    const stop = curatedCollections.subscribe(reread);
    return () => {
      active = false;
      stop();
    };
  }, [composition, curatedCollections, collectionId]);
  const name = read?.screen?.collection.name ?? '';
  return {
    // A read of a composition since reopened, or of another collection, is not shown.
    screen: read?.in === composition && read.id === collectionId ? read.screen : undefined,
    place: Math.max(
      0,
      curatedCollections.rail.findIndex(({ collection }) => collection.id === collectionId),
    ),
    add: () => {
      void keep('the copy of a Curated Collection', curatedCollections.add(collectionId));
    },
    // The Entry route of Search opens the card through `entryCard`, with the way back named.
    openEntry: (entryId) => {
      openScreen(`/search/${entryId}?back=${encodeURIComponent(name)}`);
    },
  };
}
