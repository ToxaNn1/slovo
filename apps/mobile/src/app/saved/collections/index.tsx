import { BackLink, ScreenTitle, space, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { CollectionsList } from '@/saved/collections-list';

/** Collections on their own screen: a back link to Saved and «+», the title, then the list. */
export default function CollectionsScreen() {
  const { colors } = useTokens();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <CollectionsList
        header={(add) => (
          <>
            <View style={styles.bar}>
              <BackLink
                testID="collections-back"
                label={editionStrings.tabs.saved}
                onPress={() => {
                  router.back();
                }}
              />
              {add}
            </View>
            <View style={styles.header}>
              <ScreenTitle>{editionStrings.collections.title}</ScreenTitle>
            </View>
          </>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    paddingTop: space[2],
  },
  header: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[4] },
});
