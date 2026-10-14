import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from './EditionProvider';
import { space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * How far the largest text sizes of iOS may scale the label, so the button
 * never outgrows its screen.
 */
const LABEL_MAX_FONT_SCALE = 1.3;

/**
 * The primary button: the ink fill with a label in the background colour,
 * `radius.button`, 56 pt tall (design `color.primaryButton`). The Edition's
 * ink and background tokens carry both Themes, so it knows no Theme.
 */
export function PrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string | undefined;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.ink, borderRadius: radii.button, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text
        maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
        style={[styles.label, { color: colors.background, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: typeSize.button, fontWeight: '700' },
});
