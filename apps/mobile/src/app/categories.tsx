import { CategoryGrid, categoryGrid, useTokens } from '@slovo/ui';
import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCategories } from '@/categories/categories';
import { gridBox } from '@/categories/grid-box';
import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';

/**
 * k1, the grid of every Category of Words, opened from the Dashboard rail's
 * header, its only door: «Категорії» with their number, three columns of
 * tiles, a tile opening its Category. With none to show it returns home.
 */
export default function CategoriesRoute() {
  const categories = useCategories();
  const openScreen = useOpenScreen();
  const { colors } = useTokens();
  if (categories.length === 0) return <Redirect href="/" />;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <CategoryGrid
        testID="categories"
        title={editionStrings.dashboard.categories.title}
        count={String(categories.length)}
        tiles={categories.map(({ id, displayName }) => ({ id, name: displayName }))}
        columns={3}
        box={gridBox}
        shapes={categoryGrid.shapes}
        onOpen={(categoryId) => {
          openScreen(`/category/${categoryId}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
