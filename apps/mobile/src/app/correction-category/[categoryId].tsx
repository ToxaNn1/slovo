import { correctionGrid, RailScreenHero, useTokens } from '@slovo/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { useCorrectionCategories } from '@/categories/categories';
import { editionStrings } from '@/edition/edition';

/**
 * A Category of Corrections' screen, from its tile in k2. Till the Category
 * screen of Corrections ticket (#1616) fills it, it shows the Rail screen
 * hero alone: the Category's name and description under «Категорія», with
 * no progress yet. An id the Language Pack doesn't have returns home.
 */
export default function CorrectionCategoryRoute() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categories = useCorrectionCategories();
  const { colors } = useTokens();
  const router = useRouter();
  const place = categories.findIndex(({ id }) => id === categoryId);
  const category = categories[place];
  if (category === undefined) return <Redirect href="/" />;
  const [glyph] =
    correctionGrid.shapes[place % correctionGrid.shapes.length] ?? correctionGrid.shapes[0];
  return (
    <ScrollView
      testID="correction-category"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <RailScreenHero
        id="correction-category-hero"
        glyph={glyph}
        kicker={editionStrings.dashboard.category.quiet}
        title={category.displayName}
        description={category.description}
        progress=""
        done={0}
        mascot="waits"
        back={{
          testID: 'correction-category-back',
          label: editionStrings.dashboard.correctionTypes.title,
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
