import { BackLink, CategoryGrid, categoryGrid, categoryGridBox, space, useTokens } from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBlockCategories, useTonesOf } from '@/categories/categories';
import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';

/**
 * k1, the grid of every Category of Words, opened from the Dashboard rail's
 * header, its only door: «Категорії» with their number, three columns of
 * tiles, a quiet Category's in its quiet tone, a tile opening its Category.
 * With none to show it returns to the Dashboard.
 */
export default function CategoriesRoute() {
  const categories = useBlockCategories('word');
  const tonesOf = useTonesOf('quietGrid');
  const openScreen = useOpenScreen();
  const { colors } = useTokens();
  const router = useRouter();
  if (categories.length === 0) return <Redirect href="/" />;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <CategoryGrid
        testID="categories"
        header={
          // Back to the Dashboard, the grid's only door (owner 15.11), scrolling with the title.
          <View style={styles.bar}>
            <BackLink
              testID="categories-back"
              label={editionStrings.tabs.home}
              onPress={() => {
                router.back();
              }}
            />
          </View>
        }
        title={editionStrings.dashboard.categories.title}
        count={String(categories.length)}
        tiles={categories.map(({ id, displayName }) => ({ id, name: displayName }))}
        columns={3}
        box={categoryGridBox}
        shapes={categoryGrid.shapes}
        toneAt={tonesOf(categories)}
        onOpen={(categoryId) => {
          openScreen(`/category/${categoryId}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', paddingHorizontal: space[3], paddingTop: space[2] },
});
