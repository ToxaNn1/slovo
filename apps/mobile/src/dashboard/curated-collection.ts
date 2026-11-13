import type { Composition, CuratedCollectionScreen as Screen } from '@slovo/core';
import { useCallback } from 'react';

import { useComposition, useCompositionRead } from '../composition';
import { keep } from '../keep';
import { useOpenScreen } from '../use-open-screen';

/** What tells of a change to a Curated Collection's screen. */
const changes = (open: Composition) => open.curatedCollections;

/** What a Curated Collection's screen draws and does. */
export interface CuratedCollectionScreen {
  /**
   * The collection, its Entries and «Знаю X з N»; `undefined` until the first
   * read ends, `null` for an id with no screen (not on the rail, or the switch off).
   */
  readonly screen: Screen | null | undefined;
  /** Set once the read failed: reads the collection again. */
  readonly retry: (() => void) | undefined;
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
  const { curatedCollections } = useComposition();
  const openScreen = useOpenScreen();
  const read = useCallback(
    async (open: Composition) => (await open.curatedCollections.screen(collectionId)) ?? null,
    [collectionId],
  );
  const reading = useCompositionRead(read, 'Could not read a Curated Collection', changes);
  const screen = reading.status === 'ready' ? reading.value : undefined;
  const name = screen?.collection.name ?? '';
  return {
    screen,
    retry: reading.status === 'failed' ? reading.retry : undefined,
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
