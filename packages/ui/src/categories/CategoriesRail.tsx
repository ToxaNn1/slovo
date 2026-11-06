import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BlockTitle } from '../dashboard/BlockTitle';
import { useEdition } from '../providers/EditionProvider';
import { categoryTile, dashboard } from '../tokens';
import { CategoryTile, toneByPosition, type CategoryTone } from './CategoryTile';
import type { GridTile } from './CategoryGrid';

const box = {
  width: categoryTile.width,
  height: categoryTile.height,
  radius: categoryTile.radius,
  padding: categoryTile.padding,
  big: categoryTile.big,
  small: categoryTile.small,
  name: 'categoryName',
} as const;

/**
 * The Categories rail of the Dashboard (spec #1604): «Категорії» with the
 * number of Categories, a button that opens the grid of them all, over a
 * horizontal row of the home board's tiles, one per Category, the tones and
 * shape pairs by position unless `toneAt` gives a tile's tone (a quiet
 * Category's muted one). A tile opens its Category; it shows no count.
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
  const { strings, voice } = useEdition();
  const { title } = strings.dashboard.categories;
  const count = String(tiles.length);
  return (
    <>
      <Pressable
        testID="dashboard-categories-title"
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${count}`}
        accessibilityLanguage={voice.accessibilityLanguage}
        onPress={onOpenAll}
        hitSlop={{ top: 14 }}
        style={styles.title}
      >
        <View pointerEvents="none">
          <BlockTitle title={title} note={count} />
        </View>
      </Pressable>
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
            shapes={categoryTile.shapes[index % categoryTile.shapes.length] ?? ['circle', 'circle']}
            box={box}
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
  title: {
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.titleGap,
  },
  rail: {
    gap: categoryTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
});
