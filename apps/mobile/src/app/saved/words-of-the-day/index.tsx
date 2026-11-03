import { BackLink, ScreenTitle, space, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { WordOfTheDayArchiveList } from '@/saved/word-of-the-day-archive-list';

const { wordOfTheDayArchive: strings } = editionStrings;

/** «Слова дня» on its own screen: a back link to Saved and the title over the list. */
export default function WordOfTheDayArchiveScreen() {
  const { colors } = useTokens();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <WordOfTheDayArchiveList
        header={() => (
          <>
            <View style={styles.bar}>
              <BackLink
                testID="words-of-the-day-back"
                label={editionStrings.tabs.saved}
                onPress={() => {
                  router.back();
                }}
              />
            </View>
            <View style={styles.header}>
              <ScreenTitle>{strings.title}</ScreenTitle>
            </View>
          </>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { paddingLeft: space[3], paddingTop: space[2] },
  header: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[2] },
});
