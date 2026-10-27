import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { outlinedChipPadding, typeSize, withAlpha } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * A short label in an accent outline, such as a register («розм.»), a
 * Correction Type («росіянізм») or a group of Search results («Слова»). The
 * register's chip is the tighter one.
 */
export function OutlinedChip({
  text,
  accessibilityLabel,
  accessibilityRole,
  testID,
  size,
}: {
  text: string;
  /** What VoiceOver says, where it differs from the text. */
  accessibilityLabel: string;
  /** `header` where the chip heads a group, as VoiceOver's headings rotor finds it. */
  accessibilityRole?: 'header';
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
      accessibilityRole={accessibilityRole}
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
  tight: {
    paddingHorizontal: outlinedChipPadding.tight.horizontal,
    paddingVertical: outlinedChipPadding.tight.vertical,
  },
  roomy: {
    paddingHorizontal: outlinedChipPadding.roomy.horizontal,
    paddingVertical: outlinedChipPadding.roomy.vertical,
  },
  text: { fontSize: typeSize.outlinedChip, fontWeight: '600' },
});
