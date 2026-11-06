import { categoryGrid, RailScreenHero, useTokens } from '@slovo/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { useCategories } from '@/categories/categories';
import { editionStrings } from '@/edition/edition';

/**
 * A Category's screen, from its tile on the rail or in k1. Till the Category
 * screen ticket (#1613) fills it, it shows the Rail screen hero alone: the
 * Category's name and description under «Категорія», with no progress yet.
 * An id the Language Pack doesn't have returns home.
 */
export default function CategoryRoute() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categories = useCategories();
  const { colors } = useTokens();
  const router = useRouter();
  const place = categories.findIndex(({ id }) => id === categoryId);
  const category = categories[place];
  if (category === undefined) return <Redirect href="/" />;
  const [glyph] = categoryGrid.shapes[place % categoryGrid.shapes.length] ?? categoryGrid.shapes[0];
  return (
    <ScrollView testID="category" style={[styles.screen, { backgroundColor: colors.background }]}>
      <RailScreenHero
        id="category-hero"
        glyph={glyph}
        kicker={editionStrings.dashboard.category.quiet}
        title={category.displayName}
        description={category.description}
        progress=""
        done={0}
        mascot="waits"
        back={{
          testID: 'category-back',
          label: editionStrings.tabs.home,
          onPress: () => {
            router.back();
          },
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
