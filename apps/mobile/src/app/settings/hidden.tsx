import {
  BackHeader,
  Button,
  rowPadding,
  space,
  STACK_AT_FONT_SCALE,
  typeStyle,
  UndoToastProvider,
  useEdition,
  useListScroll,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useHiddenScreenModel, useHiddenShow } from '@/mix/hidden';
import type { HiddenRowModel } from '@/mix/hidden-screen';
import { ListTopButton } from '@/shell/list-top';

const strings = editionStrings.hidden;

/**
 * Settings › Приховані записи (board 11, screen 88): everything hidden from the
 * Feed in one list, the Hidden Categories, the kinds out of the Mix and the
 * Hidden Entries, each with its name, its kind and «Показати», which brings
 * it back and shows an undo toast. Nothing hidden says so.
 */
export default function HiddenScreen() {
  return (
    <UndoToastProvider>
      <HiddenList />
    </UndoToastProvider>
  );
}

function HiddenList() {
  const { rows } = useHiddenScreenModel();
  const show = useHiddenShow();
  const { colors } = useTokens();
  const router = useRouter();
  const scroll = useListScroll<FlatList<HiddenRowModel>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  return (
    <SafeAreaView
      testID="hidden"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList<HiddenRowModel>
        ref={listRef}
        onScroll={onListScroll}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={({ testID }) => testID}
        renderItem={({ item, index }) => (
          <HiddenRow
            row={item}
            first={index === 0}
            last={index === rows.length - 1}
            onShow={() => {
              show(item);
            }}
          />
        )}
        ListHeaderComponent={
          <HiddenHeader
            empty={rows.length === 0}
            onBack={() => {
              router.back();
            }}
          />
        }
      />
      <ListTopButton scroll={scroll} />
    </SafeAreaView>
  );
}

/** Above the list: back link, title, subtitle, and the empty line. */
function HiddenHeader({ empty, onBack }: { empty: boolean; onBack: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View style={styles.header}>
      <BackHeader
        titleRole="settingsSubTitle"
        title={strings.title}
        back={{ label: editionStrings.settings.title, testID: 'hidden-back', onPress: onBack }}
      />
      <View style={styles.titles}>
        <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
          {strings.subtitle}
        </Text>
      </View>
      {empty && (
        <Text
          testID="hidden-empty"
          {...voice}
          style={[typeStyle('sub', tokens), styles.empty, { color: colors.muted }]}
        >
          {strings.empty}
        </Text>
      )}
    </View>
  );
}

/** A row of the one list, inside its one card: the name over its kind, and «Показати». */
function HiddenRow({
  row: { testID, name, kindLabel, showLabel },
  first,
  last,
  onShow,
}: {
  row: HiddenRowModel;
  first: boolean;
  last: boolean;
  onShow: () => void;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.line },
        first
          ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radii.card }
          : styles.divided,
        first && { borderTopRightRadius: radii.card },
        last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomLeftRadius: radii.card,
          borderBottomRightRadius: radii.card,
        },
        stacked && styles.rowStacked,
      ]}
    >
      <View style={styles.names}>
        <Text
          {...voice}
          // A name stops growing at 1.3×, so it never breaks a word.
          maxFontSizeMultiplier={1.3}
          style={[typeStyle('hiddenName', tokens), { color: colors.ink }]}
        >
          {name}
        </Text>
        <Text {...voice} style={[typeStyle('hiddenKind', tokens), { color: colors.muted }]}>
          {kindLabel}
        </Text>
      </View>
      <Button
        size="small"
        variant="neutral"
        testID={`${testID}-show`}
        label={strings.show}
        accessibilityLabel={showLabel}
        onPress={onShow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[4], paddingBottom: space[8] },
  header: { paddingTop: space[2], paddingBottom: space[3] },
  titles: { gap: space[2], paddingTop: space[2] },
  empty: { marginTop: space[6] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: rowPadding,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  // At the largest text sizes the button drops under the name instead of squeezing it.
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  names: { flex: 1, minWidth: 0, gap: space[1] },
});
