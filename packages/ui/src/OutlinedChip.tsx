import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from './EditionProvider';
import { typeSize, withAlpha } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * A short label in an accent outline, such as a register («розм.») or a
 * Correction Type («росіянізм»). The register's chip is the tighter one.
 */
export function OutlinedChip({
  text,
  accessibilityLabel,
  testID,
  size,
}: {
  text: string;
  /** What VoiceOver says, where it differs from the text. */
  accessibilityLabel: string;
  testID: string;
  size: 'tight' | 'roomy';
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      {...voice}
      style={[
        styles.chip,
        size === 'tight' ? styles.tight : styles.roomy,
        { borderColor: withAlpha(colors.accent, 0.45), borderRadius: radii.chip },
      ]}
    >
      <Text style={[styles.text, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1 },
  tight: { paddingHorizontal: 7, paddingVertical: 2 },
  roomy: { paddingHorizontal: 9, paddingVertical: 4 },
  text: { fontSize: typeSize.outlinedChip, fontWeight: '600' },
});
