import { withoutStress, type EntryRowModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { entryRowSubtitle } from './entry-row-text';
import { useEdition } from '../providers/EditionProvider';
import { entryRow, rowPadding, space, STACK_AT_FONT_SCALE, typeSize } from '../tokens';
import { rowActionProps, SwipeableRow, type RowAction } from '../primitives/SwipeableRow';
import { useTokens } from '../providers/TokensProvider';

/** An action of an Entry row. */
export type EntryRowAction = RowAction;

/** How far the largest text sizes of iOS may scale a title that shares its row with a button. */
const ACCESSORY_TITLE_MAX_FONT_SCALE = 1.3;

/**
 * One Entry in a list (Favorites, Collections, History, Hidden and «Вчу»),
 * built from the Core's Entry row: its title over its second line, in the
 * Edition's words (a Correction's «замість …»), on one line. The trailing
 * text is what the screen puts on the right (a date, a kind, a time). A tap
 * opens the Entry; the actions slide out from the right and are VoiceOver
 * actions too.
 *
 * A screen can put its own line under the title (`subtitle`) and a button
 * after the text (`accessory`, the Hidden screen's «Повернути»). A row with no
 * `onPress` is read, not opened. Needs a `GestureHandlerRootView` above it.
 */
export function EntryRow({
  row,
  trailing,
  subtitle: ownSubtitle,
  accessibilityLabel: ownAccessibilityLabel,
  accessory,
  onPress,
  actions = [],
  compact = false,
  testID = `entry-row-${row.entryId}`,
}: {
  row: EntryRowModel;
  trailing?: string;
  /** The line under the title, in place of the row's second line. */
  subtitle?: string;
  /** What VoiceOver reads for the row, in place of the title, subtitle and trailing text. */
  accessibilityLabel?: string;
  /** A button after the text, outside the row's own tap. */
  accessory?: ReactNode;
  onPress?: () => void;
  actions?: readonly EntryRowAction[];
  /**
   * Only the title and the trailing text, on a tighter row whose separator is
   * inset to the text, as History draws its rows.
   */
  compact?: boolean;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const { fontScale } = useWindowDimensions();
  const subtitle =
    ownSubtitle ?? (compact ? undefined : entryRowSubtitle(strings.correctionCard, row));
  // The voices break a word at the Stress mark, so VoiceOver reads the row without it.
  const accessibilityLabel = withoutStress(
    ownAccessibilityLabel ??
      [row.title, subtitle, trailing]
        .filter((part) => part !== undefined && part !== '')
        .join(', '),
  );
  const hasAccessory = accessory !== undefined;
  const stacked = hasAccessory && fontScale > STACK_AT_FONT_SCALE;

  const text = (
    <>
      <View style={styles.titleLine}>
        <Text
          // Beside a button the Lemma stops growing at 1.3×, so it never breaks a word.
          maxFontSizeMultiplier={hasAccessory ? ACCESSORY_TITLE_MAX_FONT_SCALE : undefined}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {row.title}
        </Text>
        {trailing !== undefined && (
          <Text style={[styles.trailing, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
            {trailing}
          </Text>
        )}
      </View>
      {subtitle !== undefined && (
        <Text
          style={[styles.subtitle, { color: colors.inkSecondary, fontFamily: fontFamilies.ui }]}
          numberOfLines={hasAccessory ? undefined : 1}
        >
          {subtitle}
        </Text>
      )}
    </>
  );
  const textStyle = [
    styles.row,
    compact && styles.rowCompact,
    hasAccessory && styles.rowBesideAccessory,
    stacked && styles.rowAboveAccessory,
  ];

  return (
    <SwipeableRow
      testID={testID}
      actions={actions}
      containerStyle={[
        styles.container,
        { borderColor: colors.line },
        compact && styles.containerCompact,
      ]}
    >
      <View
        style={[
          { backgroundColor: colors.background },
          hasAccessory && styles.withAccessory,
          stacked && styles.withAccessoryStacked,
        ]}
      >
        {onPress === undefined ? (
          <View
            testID={`${testID}-text`}
            accessible
            accessibilityLabel={accessibilityLabel}
            {...voice}
            style={textStyle}
          >
            {text}
          </View>
        ) : (
          <Pressable
            testID={`${testID}-open`}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            {...rowActionProps(actions)}
            {...voice}
            onPress={onPress}
            style={({ pressed }) => [
              textStyle,
              { backgroundColor: pressed ? colors.surfaceSunken : colors.background },
            ]}
          >
            {text}
          </Pressable>
        )}
        {accessory}
      </View>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: 1 },
  containerCompact: { marginHorizontal: space[6] },
  row: {
    minHeight: entryRow.minHeight,
    paddingVertical: rowPadding,
    paddingHorizontal: space[6],
    gap: entryRow.lineGap,
  },
  rowCompact: {
    minHeight: entryRow.compactMinHeight,
    paddingVertical: space[3],
    paddingHorizontal: 0,
  },
  // The button takes the right edge, so the text stops short of it and the row's padding moves out.
  withAccessory: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space[6],
    gap: space[3],
  },
  rowBesideAccessory: { flex: 1, paddingRight: 0 },
  // At the largest text sizes the button drops under the text instead of squeezing it.
  withAccessoryStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingLeft: space[6],
    paddingBottom: rowPadding,
  },
  rowAboveAccessory: { flex: 0, alignSelf: 'stretch', paddingLeft: 0, paddingBottom: space[2] },
  // At the largest text sizes the trailing text drops under the title instead of squeezing it.
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: entryRow.titleGap,
  },
  title: { flexShrink: 1, fontSize: typeSize.subhead, fontWeight: '500' },
  trailing: { flexShrink: 0, fontSize: typeSize.smallLabel, fontWeight: '500' },
  subtitle: { fontSize: typeSize.caption, lineHeight: typeSize.caption * 1.4 },
});
