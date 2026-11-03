import {
  BackLink,
  rowPadding,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useFavoriteList } from '@/saved/favorites';
import { FavoritesList } from '@/saved/favorites-list';

const { favorites: strings } = editionStrings;

/** Favorites on their own screen: a back link to Saved, the title with how many Entries it holds, then the list. */
export default function FavoritesScreen() {
  const list = useFavoriteList();
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <FavoritesList
        header={() => (
          <>
            <View style={styles.back}>
              <BackLink
                testID="favorites-back"
                label={editionStrings.tabs.saved}
                onPress={() => {
                  router.back();
                }}
              />
            </View>
            <View
              style={[
                styles.header,
                list.length > 0 && { borderBottomWidth: 1, borderColor: colors.line },
              ]}
            >
              <ScreenTitle>{strings.title}</ScreenTitle>
              <Text
                testID="favorites-count"
                accessibilityLabel={count(strings.count, list.length)}
                {...voice}
                style={[typeStyle('collectionCount', tokens), { color: colors.accent }]}
              >
                {String(list.length)}
              </Text>
            </View>
          </>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingTop: space[2],
    paddingBottom: rowPadding,
  },
});
