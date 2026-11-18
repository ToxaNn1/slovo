import type { CuratedCollectionCard, CuratedCollectionPictogram } from '@slovo/core';
import { ScrollView, StyleSheet } from 'react-native';

import { CategoryTile, shapeAt, toneByPosition } from './CategoryTile';
import { useEdition } from '../providers/EditionProvider';
import { categoryRailBox, categoryTile, correctionGrid, dashboard } from '../tokens';
import { RailHeader } from '../dashboard/RailHeader';

/**
 * The «SLOVO пропонує» rail of the Dashboard (ADR 0076, 0178), drawn as the
 * Categories rail: its title with the count of every collection published by
 * today over a horizontal row of Category tiles, one per card, the tones by
 * position. A tile draws the pictogram of the Category its collection names,
 * as that Category's own tile does, its name and count of Entries, «Нова»
 * until it is opened and «Додано ✓» once it is copied; a tap opens its screen.
 */
export function CuratedCollectionsRail({
  cards,
  published,
  onOpen,
}: {
  cards: readonly CuratedCollectionCard[];
  /** Every collection published by today, which the header counts. */
  published: number;
  onOpen: (collectionId: string) => void;
}) {
  const { strings, count } = useEdition();
  const { curatedCollectionsTitle, curatedCollectionCount, curatedCollectionNew } =
    strings.dashboard;
  const { added: addedMark } = strings.dashboard.curatedCollection;
  return (
    <>
      <RailHeader
        testID="dashboard-curated-collections-title"
        title={curatedCollectionsTitle}
        note={String(published)}
      />
      <ScrollView
        testID="dashboard-curated-collections"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {cards.map(({ collection: { id, name, entryIds }, pictogram, state, added }, index) => {
          const mark = state === 'new' ? curatedCollectionNew : added ? addedMark : undefined;
          const entries = count(curatedCollectionCount, entryIds.length);
          return (
            <CategoryTile
              key={id}
              testID={`dashboard-curated-collection-${id}`}
              name={name}
              count={entries}
              mark={mark}
              accessibilityLabel={[mark, name, entries]
                .filter((part) => part !== undefined)
                .join('. ')}
              tone={toneByPosition(index)}
              shapes={shapesOf(pictogram)}
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

/** The shapes of the Category a pictogram names, as its own tile draws them. */
function shapesOf(pictogram: CuratedCollectionPictogram | undefined) {
  if (pictogram === undefined) return undefined;
  const shapes = pictogram.of === 'category' ? categoryTile.shapes : correctionGrid.shapes;
  return shapeAt(shapes, pictogram.position);
}

const styles = StyleSheet.create({
  rail: {
    gap: categoryTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
});
