import type { CuratedCollectionCard, CuratedCollectionPictogram } from '@slovo/core';
import type { ReactElement } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { CategoryGrid, type GridTile } from './CategoryGrid';
import { CategoryTile, shapeAt, toneByPosition } from './CategoryTile';
import type { TileShapeKind } from '../primitives/TileShape';
import { useEdition } from '../providers/EditionProvider';
import {
  categoryGridBox,
  categoryRailBox,
  categoryTile,
  correctionGrid,
  dashboard,
} from '../tokens';
import { RailHeader } from '../dashboard/RailHeader';

/**
 * The «SLOVO пропонує» rail of the Dashboard, drawn as the
 * Categories rail: its title with the count of every collection published by
 * today over a horizontal row of Category tiles, one per card, the tones by
 * position. A tile draws the pictogram of the Category its collection names,
 * as that Category's own tile does, its name and count of Entries, «Нова»
 * until it is opened and «Додано ✓» once it is copied; a tap opens its screen.
 * The header opens the grid of them all.
 */
export function CuratedCollectionsRail({
  cards,
  published,
  onOpenAll,
  onOpen,
}: {
  cards: readonly CuratedCollectionCard[];
  /** Every collection published by today, which the header counts. */
  published: number;
  onOpenAll: () => void;
  onOpen: (collectionId: string) => void;
}) {
  const { strings } = useEdition();
  const tileOf = useTileOf();
  return (
    <>
      <RailHeader
        testID="dashboard-curated-collections-title"
        title={strings.dashboard.curatedCollectionsTitle}
        note={String(published)}
        onPress={onOpenAll}
      />
      <ScrollView
        testID="dashboard-curated-collections"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {cards.map((card, index) => {
          const { id, name, count: line, mark, accessibilityLabel } = tileOf(card);
          return (
            <CategoryTile
              key={id}
              testID={`dashboard-curated-collection-${id}`}
              name={name}
              count={line}
              mark={mark}
              accessibilityLabel={accessibilityLabel ?? name}
              tone={toneByPosition(index)}
              shapes={shapesOf(card.pictogram)}
              box={categoryRailBox}
              onPress={() => {
                onOpen(id);
              }}
            />
          );
        })}
      </ScrollView>
    </>
  );
}

/**
 * The grid of every Curated Collection published by today, drawn
 * as the Categories' grid k1: its title with their number, three columns of
 * the rail's tiles in the given order, each with its pictogram, count of
 * Entries and marks; a tap opens its screen.
 */
export function CuratedCollectionGrid({
  cards,
  header,
  onOpen,
  testID,
}: {
  cards: readonly CuratedCollectionCard[];
  /** What goes over the title, such as the screen's back link. */
  header?: ReactElement | undefined;
  onOpen: (collectionId: string) => void;
  testID: string;
}) {
  const { strings } = useEdition();
  const tileOf = useTileOf();
  return (
    <CategoryGrid
      testID={testID}
      header={header}
      title={strings.dashboard.curatedCollectionsGridTitle}
      count={String(cards.length)}
      tiles={cards.map(tileOf)}
      columns={3}
      box={categoryGridBox}
      shapes={(index) => shapesOf(cards[index]?.pictogram)}
      onOpen={onOpen}
    />
  );
}

/**
 * A collection's tile: its name, its count of Entries, «Нова» until it is
 * opened, else «Додано ✓» once it is copied, read in that order.
 */
function useTileOf(): (card: CuratedCollectionCard) => GridTile {
  const { strings, count } = useEdition();
  const { curatedCollectionCount, curatedCollectionNew, curatedCollection } = strings.dashboard;
  return ({ collection: { id, name, entryIds }, state, added }) => {
    const mark =
      state === 'new' ? curatedCollectionNew : added ? curatedCollection.added : undefined;
    const entries = count(curatedCollectionCount, entryIds.length);
    return {
      id,
      name,
      count: entries,
      mark,
      accessibilityLabel: [mark, name, entries].filter((part) => part !== undefined).join('. '),
    };
  };
}

/** The shapes of the Category a pictogram names, as its own tile draws them. */
function shapesOf(pictogram: CuratedCollectionPictogram | undefined) {
  if (pictogram === undefined) return undefined;
  const shapes = pictogram.of === 'category' ? categoryTile.shapes : correctionGrid.shapes;
  return shapeAt(shapes, pictogram.position);
}

/**
 * The glyph of a Curated Collection's screen hero: the big shape its tile
 * draws, else a circle.
 */
export function curatedCollectionGlyph(
  pictogram: CuratedCollectionPictogram | undefined,
): TileShapeKind {
  return shapesOf(pictogram)?.[0] ?? 'circle';
}

const styles = StyleSheet.create({
  rail: {
    gap: categoryTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
});
