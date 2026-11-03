import { HISTORY_CAP } from '@slovo/core';
import { BackLink, fill, ScreenTitle, space, typeStyle, useEdition, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { HistoryList } from '@/saved/history-list';

const { history: strings } = editionStrings;

/** History on its own screen: a back link to Saved and «Очистити», the title with how many Entries History keeps, then the list. */
export default function HistoryScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <HistoryList
        header={(clear) => (
          <>
            <View style={styles.bar}>
              <BackLink
                testID="history-back"
                label={editionStrings.tabs.saved}
                onPress={() => {
                  router.back();
                }}
              />
              {clear}
            </View>
            <View style={styles.header}>
              <ScreenTitle>{strings.title}</ScreenTitle>
              <Text
                testID="history-limit"
                {...voice}
                style={[typeStyle('meta', tokens), { color: colors.muted }]}
              >
                {fill(strings.limit, { count: String(HISTORY_CAP) })}
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space[3],
    paddingRight: space[6],
    paddingTop: space[2],
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space[3],
    paddingHorizontal: space[6],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
});
