import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from './EditionProvider';
import { minTouchTarget, typeSize, withAlpha } from './tokens';
import { useTokens } from './TokensProvider';

/** How far the largest text sizes of iOS may scale the label. */
const LABEL_MAX_FONT_SCALE = 1.3;

/**
 * A quiet button on a list row, such as «Повернути»: the label in the accent
 * colour inside a thin accent outline, at least 44 pt tall.
 */
export function OutlineButton({
  label,
  accessibilityLabel = label,
  onPress,
  testID,
}: {
  label: string;
  /** What VoiceOver reads, where it differs from the label. */
  accessibilityLabel?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: withAlpha(colors.accent, 0.45),
          backgroundColor: pressed ? colors.surfaceSunken : 'transparent',
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
        style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 6,
  },
  label: { fontSize: typeSize.body, fontWeight: '700' },
});
