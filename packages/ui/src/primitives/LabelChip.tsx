import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { labelChipPadding, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * A short label on a sunken fill, such as a register («розм.»), a
 * Correction Type («росіянізм») or a group of Search results («Слова»). The
 * register's chip is the tighter one.
 */
export function LabelChip({
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
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      {...voice}
      style={[
        size === 'tight' ? styles.tight : styles.roomy,
        { backgroundColor: colors.surfaceSunken, borderRadius: radii.chip },
      ]}
    >
      <Text style={[typeStyle('labelChip', tokens), { color: colors.ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tight: {
    paddingHorizontal: labelChipPadding.tight.horizontal,
    paddingVertical: labelChipPadding.tight.vertical,
  },
  roomy: {
    paddingHorizontal: labelChipPadding.roomy.horizontal,
    paddingVertical: labelChipPadding.roomy.vertical,
  },
});
