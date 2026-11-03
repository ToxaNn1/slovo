import {
  BackLink,
  rowPadding,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useLearningList } from '@/saved/learning';
import { LearningList } from '@/saved/learning-list';
import { useShown } from '@/shown-in-effect';

const { learning: strings } = editionStrings;

/**
 * The «Вчу» list on its own screen, while Knowledge Marks are on in effect:
 * a back link to Saved, the title with how many Entries it holds, then the list.
 */
export default function LearningScreen() {
  // Turned off remotely while the reader is on it: its tab goes, and so does the screen.
  if (!useShown().learning) return <Redirect href="/saved" />;
  return <Learning />;
}

function Learning() {
  const list = useLearningList();
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <LearningList
        header={() => (
          <>
            <View style={styles.back}>
              <BackLink
                testID="learning-back"
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
                testID="learning-count"
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
