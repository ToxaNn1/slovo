import { collectionFeedPage, type Composition } from '@slovo/core';
import { useCallback } from 'react';

import { editionStrings } from '../edition/edition';
import { ListFeedScreen, readCards, type ListFeedRead } from '../categories/list-feed';

/** A Curated Collection's live Entries of every kind, in its order, opened on `from`. */
async function readCollection(
  composition: Composition,
  collectionId: string,
  from: string,
): Promise<ListFeedRead | undefined> {
  const screen = await composition.curatedCollections.screen(collectionId);
  if (screen === undefined) return undefined;
  return {
    name: screen.collection.name,
    pageAt: (position) => collectionFeedPage(screen, from, position),
    cards: await readCards(
      composition,
      screen.entries.map(({ entryId }) => entryId),
    ),
  };
}

/**
 * A Curated Collection's Feed: the collection's live Entries alone,
 * each kind on its own card, from the Entry tapped on its screen on in its
 * order and round again after the last, endlessly, each card's kicker naming
 * its place, «Добірка · Мішанина · 2 з 3». It makes nothing Seen and leaves
 * History as it was; its back tile, named for the collection, returns to the
 * collection's screen.
 */
export function CuratedCollectionFeedScreen({
  collectionId,
  from,
}: {
  collectionId: string;
  from: string;
}) {
  const read = useCallback(
    (open: Composition) => readCollection(open, collectionId, from),
    [collectionId, from],
  );
  return (
    <ListFeedScreen
      read={read}
      failure="Could not read the Entries of a Curated Collection"
      kicker={editionStrings.dashboard.curatedCollection.feedKicker}
      testID="curated-collection-feed"
    />
  );
}
