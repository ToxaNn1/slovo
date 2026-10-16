import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { space, withAlpha } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the label, so the button never outgrows its screen. */
const LABEL_MAX_FONT_SCALE = 1.3;

/**
 * The secondary button: transparent with a hairline of ink, the label in ink,
 * `radius.button`, 50 pt tall, as «На головну» under the primary button.
 */
export function SecondaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
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
        {
          borderColor: withAlpha(colors.ink, 0.2),
          borderRadius: radii.button,
          backgroundColor: pressed ? colors.surfaceSunken : 'transparent',
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
        style={[styles.label, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: { fontSize: 15, fontWeight: '600' },
});
