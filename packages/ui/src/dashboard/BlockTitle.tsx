import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { typeStyle } from '../tokens';

/**
 * A block's title on the Dashboard, from the board: the title in ink at the
 * start, read by VoiceOver as a header, and a muted note or count at the
 * end, on one baseline.
 */
export function BlockTitle({
  title,
  note,
  testID,
}: {
  title: string;
  note?: string | undefined;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.row}>
      <Text
        {...voice}
        accessibilityRole="header"
        style={[styles.title, typeStyle('blockTitle', tokens), { color: colors.ink }]}
      >
        {title}
      </Text>
      {note !== undefined && (
        <Text {...voice} style={[typeStyle('blockNote', tokens), { color: colors.muted }]}>
          {note}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { flexShrink: 1 },
});
