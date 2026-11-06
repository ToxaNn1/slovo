import type { Plural } from '@slovo/contracts';
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
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import type { ListHeader } from '@/saved/list-header';

/** What a Saved list screen shows beside its title. */
export type TitleAside =
  /** How many Entries the list holds, spoken in the Edition's plural form; a line runs under it once there is one. */
  | {
      readonly kind: 'count';
      readonly value: number;
      readonly forms: Plural;
      readonly testID: string;
    }
  /** A quiet note, such as how many Entries History keeps. */
  | { readonly kind: 'note'; readonly text: string; readonly testID: string }
  | { readonly kind: 'none' };

/**
 * A Saved list on its own screen: a back link to Saved with the list's tool
 * beside it, the title with its aside, then the list, which draws the header
 * over its rows.
 */
export function SavedListScreen({
  name,
  title,
  aside,
  list,
}: {
  /** Names the screen's test IDs, e.g. `favorites-back`. */
  readonly name: string;
  readonly title: string;
  readonly aside: TitleAside;
  readonly list: (header: ListHeader) => ReactElement;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  const router = useRouter();

  const header: ListHeader = (tool) => (
    <>
      <View style={styles.bar}>
        <BackLink
          testID={`${name}-back`}
          label={editionStrings.tabs.saved}
          onPress={() => {
            router.back();
          }}
        />
        {tool}
      </View>
      {aside.kind === 'count' ? (
        <View
          style={[
            styles.title,
            styles.countTitle,
            aside.value > 0 && { borderBottomWidth: 1, borderColor: colors.line },
          ]}
        >
          <ScreenTitle>{title}</ScreenTitle>
          <Text
            testID={aside.testID}
            accessibilityLabel={count(aside.forms, aside.value)}
            {...voice}
            style={[typeStyle('collectionCount', tokens), { color: colors.accent }]}
          >
            {String(aside.value)}
          </Text>
        </View>
      ) : aside.kind === 'note' ? (
        <View style={[styles.title, styles.noteTitle]}>
          <ScreenTitle>{title}</ScreenTitle>
          <Text
            testID={aside.testID}
            {...voice}
            style={[typeStyle('meta', tokens), { color: colors.muted }]}
          >
            {aside.text}
          </Text>
        </View>
      ) : (
        <View style={[styles.title, styles.bareTitle]}>
          <ScreenTitle>{title}</ScreenTitle>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      {list(header)}
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
  title: { paddingHorizontal: space[6], paddingTop: space[2] },
  countTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingBottom: rowPadding,
  },
  noteTitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space[3],
    paddingBottom: space[2],
  },
  bareTitle: { paddingBottom: space[2] },
});
