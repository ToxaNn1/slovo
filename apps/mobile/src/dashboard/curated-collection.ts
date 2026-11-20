import type {
  Composition,
  CuratedCollectionCard,
  CuratedCollectionPictogram,
  CuratedCollectionScreen as Screen,
} from '@slovo/core';
import { fill } from '@slovo/contracts';
import { useUndoToast } from '@slovo/ui';
import { useCallback } from 'react';

import { useComposition, useCompositionRead } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { useOpenScreen } from '../use-open-screen';
import { useEditionInEffect } from '../edition/remote-switches';

/**
 * A tile of the «SLOVO пропонує» rail or of its grid: marks the collection
 * opened, so «Нова» goes, and opens its screen.
 */
export function useOpenCuratedCollection(): (collectionId: string) => void {
  const { curatedCollections } = useComposition();
  const openScreen = useOpenScreen();
  return (collectionId) => {
    void keep('the opened Curated Collections', curatedCollections.open(collectionId));
    openScreen(`/curated-collection/${collectionId}`);
  };
}

/** The cards of every Curated Collection published by today, in the rail's order, as they change. */
export function useCuratedCollectionGrid(): readonly CuratedCollectionCard[] {
  const { curatedCollections } = useComposition();
  return useSubscribed(curatedCollections, (source) => source.grid);
}

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
  /** The pictogram its tile draws, whose big shape is the hero's glyph (ADR 0178). */
  readonly pictogram: CuratedCollectionPictogram | undefined;
  /** «+ Додати»: copies it into the reader's Collections and says so in a toast. */
  readonly add: () => void;
  /** «У Колекціях»: opens the reader's copy, the Collection made from it. */
  readonly openCopy: () => void;
  /**
   * Opens the collection's Feed from an Entry while `curatedCollectionFeed` is
   * on (ADR 0178), else its card; neither makes anything Seen (ADR 0076).
   */
  readonly openEntry: (entryId: string) => void;
}

/**
 * A Curated Collection's screen (ADR 0076), read again on each change the
 * Core tells of, so a Knowledge Mark or a copy shows at once.
 */
export function useCuratedCollectionScreen(collectionId: string): CuratedCollectionScreen {
  const { curatedCollections, collections } = useComposition();
  const openScreen = useOpenScreen();
  const curatedCollectionFeed = useEditionInEffect().isFeatureEnabled('curatedCollectionFeed');
  const showToast = useUndoToast();
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
    pictogram: curatedCollections.grid.find(({ collection }) => collection.id === collectionId)
      ?.pictogram,
    add: () => {
      void keep('the copy of a Curated Collection', curatedCollections.add(collectionId));
      showToast({
        message: fill(editionStrings.dashboard.curatedCollection.toasts.added, { name }),
      });
    },
    openCopy: () => {
      const copy = collections.list.find(({ source }) => source === collectionId);
      if (copy !== undefined) openScreen(`/saved/collections/${copy.id}`);
    },
    // The Entry route of Search opens the card through `entryCard`, with the way back named.
    openEntry: (entryId) => {
      if (curatedCollectionFeed) {
        openScreen(`/curated-collection-feed/${collectionId}?from=${encodeURIComponent(entryId)}`);
        return;
      }
      openScreen(`/search/${entryId}?back=${encodeURIComponent(name)}`);
    },
  };
}
