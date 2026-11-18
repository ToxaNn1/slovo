import { BackLink, CuratedCollectionGrid, space, useTokens } from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCuratedCollectionGrid, useOpenCuratedCollection } from '@/dashboard/curated-collection';
import { editionStrings } from '@/edition/edition';

/**
 * The grid of every Curated Collection published by today (ADR 0178), opened
 * from the «SLOVO пропонує» rail's header, as k1 draws the Categories: its
 * title with their number, three columns of tiles in the rail's order, a tile
 * opening its collection's screen. With none to show it returns to the Dashboard.
 */
export default function CuratedCollectionsRoute() {
  const cards = useCuratedCollectionGrid();
  const open = useOpenCuratedCollection();
  const { colors } = useTokens();
  const router = useRouter();
  if (cards.length === 0) return <Redirect href="/" />;
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <CuratedCollectionGrid
        testID="curated-collections"
        header={
          <View style={styles.bar}>
            <BackLink
              testID="curated-collections-back"
              label={editionStrings.tabs.home}
              onPress={() => {
                router.back();
              }}
            />
          </View>
        }
        cards={cards}
        onOpen={open}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', paddingHorizontal: space[3], paddingTop: space[2] },
});
