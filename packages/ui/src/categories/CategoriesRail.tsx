import { ScrollView, StyleSheet } from 'react-native';

import { RailHeader } from '../dashboard/RailHeader';
import { useEdition } from '../providers/EditionProvider';
import { categoryRailBox, categoryTile, dashboard } from '../tokens';
import { CategoryTile, shapeAt, toneByPosition, type CategoryTone } from './CategoryTile';
import type { GridTile } from './CategoryGrid';

/**
 * The Categories rail of the Dashboard (spec #1604): «Категорії» with the
 * number of Categories, a button that opens the grid of them all, over a
 * horizontal row of the Dashboard's tiles, one per Category, the tones and
 * shape pairs by position unless `toneAt` gives a tile's tone (a quiet
 * Category's quiet one). A tile opens its Category; it shows no count.
 */
export function CategoriesRail({
  tiles,
  toneAt = toneByPosition,
  onOpenAll,
  onOpen,
}: {
  tiles: readonly GridTile[];
  /** A tile's tone by its place; the boards' tones by position unless given. */
  toneAt?: (index: number) => CategoryTone;
  onOpenAll: () => void;
  onOpen: (id: string) => void;
}) {
  const { strings } = useEdition();
  const { title } = strings.dashboard.categories;
  return (
    <>
      <RailHeader
        testID="dashboard-categories-title"
        title={title}
        note={String(tiles.length)}
        onPress={onOpenAll}
      />
      <ScrollView
        testID="dashboard-categories"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {tiles.map(({ id, name }, index) => (
          <CategoryTile
            key={id}
            testID={`dashboard-category-${id}`}
            name={name}
            tone={toneAt(index)}
            shapes={shapeAt(categoryTile.shapes, index)}
            box={categoryRailBox}
            onPress={() => {
              onOpen(id);
            }}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: categoryTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
});
