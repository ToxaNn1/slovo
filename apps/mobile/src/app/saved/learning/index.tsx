import { MascotIn } from '@/mascot/mascot';
import {
  BackLink,
  EmptyState,
  LearningRow,
  rowPadding,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useLearningList } from '@/saved/learning';
import { useShown } from '@/shown-in-effect';

const { learning: strings } = editionStrings;

/**
 * The «Вчу» list, while Knowledge Marks are on in effect: every Entry the
 * reader is learning, the next Review first, each row with its Review day. A
 * tap opens the Entry screen. The list is the Core's own: it has no rename,
 * delete or swipe action, and an Entry leaves it once it is Learned or its mark
 * is removed.
 */
export default function LearningScreen() {
  // Turned off remotely while the reader is on it: its card goes, and so does the screen.
  if (!useShown().learning) return <Redirect href="/saved" />;
  return <Learning />;
}

function Learning() {
  const list = useLearningList();
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  const router = useRouter();
  const openScreen = useOpenScreen();

  return (
    <SafeAreaView
      testID="learning"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={list}
        keyExtractor={(entry) => entry.entryId}
        renderItem={({ item: entry }) => (
          <LearningRow
            entry={entry}
            onPress={() => {
              openScreen(`/saved/learning/${entry.entryId}`);
            }}
          />
        )}
        ListHeaderComponent={
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
        }
        ListFooterComponent={
          list.length > 0 ? (
            <Text
              {...voice}
              style={[typeStyle('meta', tokens), styles.footer, { color: colors.muted }]}
            >
              {strings.footer}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            mascot={<MascotIn state="empty" />}
            testID="learning-empty"
            title={strings.empty.title}
            message={strings.empty.message}
          />
        }
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
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
  footer: { marginHorizontal: space[6], marginTop: space[4] },
});
