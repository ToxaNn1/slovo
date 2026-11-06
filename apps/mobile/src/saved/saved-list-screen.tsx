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
  | { readonly kind: 'count'; readonly value: number; readonly forms: Plural }
  /** A quiet note, such as how many Entries History keeps. */
  | { readonly kind: 'note'; readonly text: string }
  | { readonly kind: 'none' };

/** The row of the back link, laid out as each screen laid it out: with the tool beside it under a note. */
const backRow: Record<TitleAside['kind'], 'countBack' | 'bar' | 'bareBack'> = {
  count: 'countBack',
  note: 'bar',
  none: 'bareBack',
};

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
  /** Names the screen's test IDs, e.g. `favorites-back` and `favorites-count`. */
  readonly name: string;
  readonly title: string;
  readonly aside: TitleAside;
  readonly list: (header: ListHeader) => ReactElement;
}) {
  const { colors } = useTokens();
  const router = useRouter();

  const header: ListHeader = (tool) => (
    <>
      <View style={styles[backRow[aside.kind]]}>
        <BackLink
          testID={`${name}-back`}
          label={editionStrings.tabs.saved}
          onPress={() => {
            router.back();
          }}
        />
        {tool}
      </View>
      <TitleRow name={name} title={title} aside={aside} />
    </>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      {list(header)}
    </SafeAreaView>
  );
}

/** The title of a Saved list with its aside, test IDs named `${name}-count` and `${name}-note`. */
function TitleRow({
  name,
  title,
  aside,
}: {
  readonly name: string;
  readonly title: string;
  readonly aside: TitleAside;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  switch (aside.kind) {
    case 'count':
      return (
        <View
          style={[
            styles.title,
            styles.countTitle,
            aside.value > 0 && { borderBottomWidth: 1, borderColor: colors.line },
          ]}
        >
          <ScreenTitle>{title}</ScreenTitle>
          <Text
            testID={`${name}-count`}
            accessibilityLabel={count(aside.forms, aside.value)}
            {...voice}
            style={[typeStyle('collectionCount', tokens), { color: colors.accent }]}
          >
            {String(aside.value)}
          </Text>
        </View>
      );
    case 'note':
      return (
        <View style={[styles.title, styles.noteTitle]}>
          <ScreenTitle>{title}</ScreenTitle>
          <Text
            testID={`${name}-note`}
            {...voice}
            style={[typeStyle('meta', tokens), { color: colors.muted }]}
          >
            {aside.text}
          </Text>
        </View>
      );
    case 'none':
      return (
        <View style={[styles.title, styles.bareTitle]}>
          <ScreenTitle>{title}</ScreenTitle>
        </View>
      );
  }
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
  countBack: { paddingHorizontal: space[3], paddingTop: space[2] },
  bareBack: { paddingLeft: space[3], paddingTop: space[2] },
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
