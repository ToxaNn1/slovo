import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, space, typeStyle } from '../tokens';

/**
 * The label over what Search shows (board 09, screen 78): «Нещодавно»,
 * «Продовжуй вводити» or «Знайдено» in muted capitals, and with `onClear` a
 * smaller «Очистити» on the right, which empties the recent queries.
 */
export function SearchLabel({
  text,
  onClear,
  testID,
}: {
  text: string;
  onClear?: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  return (
    <View style={styles.row}>
      <Text
        testID={testID}
        accessibilityRole="header"
        {...voice}
        style={[typeStyle('sectionLabel', tokens), styles.label, { color: colors.muted }]}
      >
        {text}
      </Text>
      {onClear !== undefined && (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={strings.search.clear}
          {...voice}
          onPress={onClear}
          style={styles.clear}
        >
          <Text style={[typeStyle('recentClear', tokens), { color: colors.accentText }]}>
            {strings.search.clear}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space[3],
  },
  label: { flexShrink: 1 },
  clear: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
