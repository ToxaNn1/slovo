import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { disabledOpacity, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * How far the largest text sizes of iOS may scale the label, so the button
 * never outgrows its screen.
 */
const LABEL_MAX_FONT_SCALE = 1.3;

/**
 * The primary button: the ink fill with a label in the background colour,
 * `radius.button`, 56 pt tall (design `color.primaryButton`). The Edition's
 * ink and background tokens carry both Themes, so it knows no Theme. While
 * its request is on the way it shows a spinner beside the label and takes no
 * press; disabled, it is dimmed and takes none either.
 */
export function PrimaryButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Whether the request of the button is on the way. */
  busy?: boolean | undefined;
  disabled?: boolean | undefined;
  testID?: string | undefined;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy || disabled }}
      {...voice}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.ink,
          borderRadius: radii.button,
          opacity: disabled && !busy ? disabledOpacity : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {busy && <ActivityIndicator color={colors.background} />}
        <Text
          maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
          style={[styles.label, { color: colors.background, fontFamily: fontFamilies.ui }]}
        >
          {label}
        </Text>
      </View>
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
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { flexShrink: 1, fontSize: typeSize.button, fontWeight: '700', textAlign: 'center' },
});
