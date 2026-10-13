import type { EntryRowModel } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from './EditionProvider';
import { space } from './tokens';
import { rowActionProps, SwipeableRow, type RowAction } from './SwipeableRow';
import { useTokens } from './TokensProvider';

/** An action of an Entry row. */
export type EntryRowAction = RowAction;

/**
 * One Entry in a list (Favorites, History and later Collections), built
 * from the Core's row model: a Word's Lemma with its Stress over its
 * Definition on one line, or a Correction's standard equivalent over the
 * non-standard form it replaces. The trailing text is what the screen puts
 * on the right (a date, a kind, a time). A tap opens the Entry; the actions
 * slide out from the right and are VoiceOver actions too. Needs a
 * `GestureHandlerRootView` above it.
 */
export function EntryRow({
  row,
  trailing,
  onPress,
  actions = [],
  compact = false,
  testID = `entry-row-${row.entryId}`,
}: {
  row: EntryRowModel;
  trailing?: string;
  onPress: () => void;
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
  let subtitle: string | undefined;
  if (!compact) {
    subtitle =
      row.kind === 'word'
        ? row.definition
        : fill(strings.correctionCard.insteadOf, { form: row.nonStandardForm });
  }

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
      <Pressable
        testID={`${testID}-open`}
        accessibilityRole="button"
        accessibilityLabel={[row.title, subtitle, trailing]
          .filter((part) => part !== undefined && part !== '')
          .join(', ')}
        {...rowActionProps(actions)}
        {...voice}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          compact && styles.rowCompact,
          { backgroundColor: pressed ? colors.surfaceSunken : colors.background },
        ]}
      >
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}>
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
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </Pressable>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: 1 },
  containerCompact: { marginHorizontal: space[6] },
  row: { minHeight: 60, paddingVertical: 14, paddingHorizontal: space[6], gap: 3 },
  rowCompact: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 0 },
  // At the largest text sizes the trailing text drops under the title instead of squeezing it.
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  title: { flexShrink: 1, fontSize: 22, fontWeight: '500' },
  trailing: { flexShrink: 0, fontSize: 12, fontWeight: '500' },
  subtitle: { fontSize: 14, lineHeight: 14 * 1.4 },
});
