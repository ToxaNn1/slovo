import { withoutStress, type EntryRowModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { entryRowSubtitle } from './entry-row-text';
import { useEdition } from '../providers/EditionProvider';
import {
  entryRow,
  fontScaleCap,
  rowPadding,
  space,
  STACK_AT_FONT_SCALE,
  typeStyle,
} from '../tokens';
import { rowActionProps, SwipeableRow, type RowAction } from '../primitives/SwipeableRow';
import { useTokens } from '../providers/TokensProvider';

/** An action of an Entry row. */
export type EntryRowAction = RowAction;

/** The day on a row's chip: when it was added, Seen or is due, today's in the accent colour. */
export interface EntryRowDay {
  readonly label: string;
  readonly today: boolean;
}

/**
 * One Entry in a list (Favorites, Collections, History, Hidden and «Вчу»),
 * built from the Core's Entry row: its title over its second line, in the
 * Edition's words (a Correction's «замість …»), on one line. The trailing
 * text is what the screen puts on the right (a kind, a time). A row of the
 * Saved lists carries its `day` on a chip on the right instead (board 09),
 * and its second line wraps. A tap opens the Entry; the actions slide out
 * from the right and are VoiceOver actions too.
 *
 * A screen can put its own line under the title (`subtitle`) and a button
 * after the text (`accessory`, the Hidden screen's «Повернути»). A row with no
 * `onPress` is read, not opened. Needs a `GestureHandlerRootView` above it.
 */
export function EntryRow({
  row,
  day,
  trailing,
  subtitle: ownSubtitle,
  accessibilityLabel: ownAccessibilityLabel,
  accessory,
  onPress,
  actions = [],
  testID = `entry-row-${row.entryId}`,
}: {
  row: EntryRowModel;
  /** The day on a chip on the right, read last; the second line then wraps. */
  day?: EntryRowDay;
  trailing?: string;
  /** The line under the title, in place of the row's second line. */
  subtitle?: string;
  /** What VoiceOver reads for the row, in place of the title, subtitle and trailing text. */
  accessibilityLabel?: string;
  /** A button after the text, outside the row's own tap. */
  accessory?: ReactNode;
  onPress?: () => void;
  actions?: readonly EntryRowAction[];
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { fontScale } = useWindowDimensions();
  const subtitle = ownSubtitle ?? entryRowSubtitle(strings.correctionCard, row);
  // The voices break a word at the Stress mark, so VoiceOver reads the row without it.
  const accessibilityLabel = withoutStress(
    ownAccessibilityLabel ??
      [row.title, subtitle, trailing, day?.label]
        .filter((part) => part !== undefined && part !== '')
        .join(', '),
  );
  const hasAccessory = accessory !== undefined;
  const stacked = hasAccessory && fontScale > STACK_AT_FONT_SCALE;

  const lines = (
    <>
      <View style={styles.titleLine}>
        <Text
          // Beside a button the Lemma stops growing at 1.3×, so it never breaks a word.
          maxFontSizeMultiplier={hasAccessory ? fontScaleCap.number : undefined}
          style={[typeStyle('listWord', tokens), styles.title, { color: colors.ink }]}
        >
          {row.title}
        </Text>
        {trailing !== undefined && (
          <Text
            style={[typeStyle('rowTrailing', tokens), styles.trailing, { color: colors.muted }]}
          >
            {trailing}
          </Text>
        )}
      </View>
      <Text
        style={[typeStyle('rowSub', tokens), { color: colors.muted }]}
        numberOfLines={hasAccessory || day !== undefined ? undefined : 1}
      >
        {subtitle}
      </Text>
    </>
  );
  const text =
    day === undefined ? (
      lines
    ) : (
      <View style={styles.withDay}>
        <View style={styles.lines}>{lines}</View>
        <View
          testID={`${testID}-day`}
          style={[
            styles.day,
            { backgroundColor: day.today ? colors.accent : colors.surfaceSunken },
          ]}
        >
          <Text
            maxFontSizeMultiplier={fontScaleCap.number}
            style={[
              typeStyle('rowTrailing', tokens),
              { color: day.today ? colors.onAccent : colors.ink },
            ]}
          >
            {day.label}
          </Text>
        </View>
      </View>
    );
  const textStyle = [
    styles.row,
    hasAccessory && styles.rowBesideAccessory,
    stacked && styles.rowAboveAccessory,
  ];

  return (
    <SwipeableRow
      testID={testID}
      actions={actions}
      containerStyle={[styles.container, { borderColor: colors.line }]}
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
              { backgroundColor: colors.background },
              pressed && styles.pressed,
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
  // The design's word rows sit in from the screen's edge, a hairline under each.
  container: { borderBottomWidth: 1, marginHorizontal: space[5] },
  pressed: { opacity: entryRow.pressedOpacity },
  row: {
    minHeight: entryRow.minHeight,
    paddingVertical: rowPadding,
    paddingHorizontal: entryRow.inset,
    gap: entryRow.lineGap,
  },
  // The button takes the right edge, so the text stops short of it and the row's padding moves out.
  withAccessory: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: entryRow.inset,
    gap: space[3],
  },
  rowBesideAccessory: { flex: 1, paddingRight: 0 },
  // At the largest text sizes the button drops under the text instead of squeezing it.
  withAccessoryStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingLeft: entryRow.inset,
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
  title: { flexShrink: 1 },
  // The day's chip keeps its width; the lines take the rest and wrap.
  withDay: { flexDirection: 'row', alignItems: 'center', gap: entryRow.dayGap },
  lines: { flex: 1, gap: entryRow.lineGap },
  day: {
    flexShrink: 0,
    minHeight: entryRow.day.height,
    paddingHorizontal: entryRow.day.paddingHorizontal,
    borderRadius: entryRow.day.radius,
    justifyContent: 'center',
  },
  trailing: { flexShrink: 0 },
});
