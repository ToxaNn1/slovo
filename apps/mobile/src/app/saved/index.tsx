import {
  OrnamentBand,
  SavedCard,
  SavedCardTitles,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../composition';
import { editionStrings } from '../../edition';
import { useFavoriteList } from '../../favorites';
import { LoadFailed } from '../../language-pack';

const { favorites: strings } = editionStrings;

/** How many of the newest Lemmas the Favorites card shows. */
const NEWEST_SHOWN = 3;

/**
 * The Saved tab's overview: a card per list with its count. Favorites comes
 * first, on the ink fill, with its newest Lemmas and the ornament band
 * (Decor slot 2). Collections and History join it later in 0.3.
 */
export default function SavedScreen() {
  const composition = useComposition();
  const favorites = useFavoriteList();
  const { colors } = useTokens();
  const { count } = useEdition();
  const router = useRouter();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  return (
    <SafeAreaView
      testID="saved"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle>{editionStrings.tabs.saved}</ScreenTitle>
        {composition.status === 'ready' && (
          <SavedCard
            testID="saved-favorites"
            primary
            title={strings.title}
            count={favorites.length}
            accessibilityLabel={`${strings.title}, ${count(strings.count, favorites.length)}`}
            onPress={() => {
              router.push('/saved/favorites');
            }}
          >
            <SavedCardTitles
              titles={favorites.slice(0, NEWEST_SHOWN).map((favorite) => favorite.row.title)}
            />
            <OrnamentBand />
          </SavedCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: 14,
    paddingHorizontal: space[5],
    paddingTop: space[6],
    paddingBottom: space[8],
  },
});
