import { CorrectionCategoryGrid, useTokens } from '@slovo/ui';
import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCorrectionCategories } from '@/categories/categories';
import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';

/**
 * k2, the grid of every Category of Corrections, opened from the header of
 * the Dashboard's «Виправлення» rail, its only door: two columns of tiles,
 * a tile opening its Category. With none to show it returns home.
 */
export default function CorrectionCategoriesRoute() {
  const categories = useCorrectionCategories();
  const openScreen = useOpenScreen();
  const { colors } = useTokens();
  if (categories.length === 0) return <Redirect href="/" />;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <CorrectionCategoryGrid
        testID="correction-categories"
        title={editionStrings.dashboard.correctionTypes.title}
        tiles={categories.map(({ id, displayName }) => ({ id, name: displayName }))}
        onOpen={(categoryId) => {
          openScreen(`/correction-category/${categoryId}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
