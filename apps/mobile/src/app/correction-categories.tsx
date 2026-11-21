import {
  BackLink,
  categoryGrid,
  CorrectionCategoryGrid,
  CorrectionTypeGrid,
  space,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBlockCategories } from '@/categories/categories';
import { useComposition } from '@/composition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';

/**
 * The grid the header of the Dashboard's «Виправлення» rail opens. With
 * `correctionTypeGrid` the rail's Correction Types alone, each opening its
 * type's screen (owner 15.11); off, k2, two columns of the
 * Categories of Corrections, a tile opening its Category, which with no
 * Category to show returns to the Dashboard.
 */
export default function CorrectionCategoriesRoute() {
  const typeGrid = useEditionInEffect().isFeatureEnabled('correctionTypeGrid');
  const { colors } = useTokens();
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      {typeGrid ? <TypeGrid /> : <CategoryGrid />}
    </SafeAreaView>
  );
}

/** Back to the Dashboard (owner 15.11), scrolling with the grid. */
function Back() {
  const router = useRouter();
  return (
    <BackLink
      testID="correction-categories-back"
      label={editionStrings.tabs.home}
      onPress={() => {
        router.back();
      }}
    />
  );
}

function TypeGrid() {
  const { correctionTypes } = useComposition();
  const openScreen = useOpenScreen();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* The gap under the back link is k1's, between its back link and its title. */}
      <View style={[styles.bar, styles.barOverTitle]}>
        <Back />
      </View>
      <CorrectionTypeGrid
        testID="correction-types"
        title={editionStrings.dashboard.correctionTypes.title}
        tiles={correctionTypes.tiles}
        onOpen={(type) => {
          openScreen(`/correction-type/${type}`);
        }}
      />
    </ScrollView>
  );
}

function CategoryGrid() {
  const categories = useBlockCategories('correction');
  const openScreen = useOpenScreen();
  if (categories.length === 0) return <Redirect href="/" />;
  return (
    <CorrectionCategoryGrid
      testID="correction-categories"
      header={
        <View style={styles.bar}>
          <Back />
        </View>
      }
      title={editionStrings.dashboard.correctionCategories.title}
      tiles={categories.map(({ id, displayName }) => ({ id, name: displayName }))}
      onOpen={(categoryId) => {
        openScreen(`/correction-category/${categoryId}`);
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: categoryGrid.padding.bottom },
  bar: { flexDirection: 'row', paddingHorizontal: space[3], paddingTop: space[2] },
  barOverTitle: { paddingBottom: categoryGrid.titleGap },
});
