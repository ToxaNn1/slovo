import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { disabledOpacity, onFill, space, typeSize, withAlpha } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the label, so the button never outgrows its screen. */
const LABEL_MAX_FONT_SCALE = 1.3;

/**
 * The secondary button: transparent with a hairline of ink, the label in ink,
 * `radius.button`, 50 pt tall, as «На головну» under the primary button. A
 * destructive one, such as deleting the Account, is filled with the
 * destructive colour, its label white, as a destructive swipe action. While
 * its request is on the way it shows a spinner beside the label and takes no
 * press; disabled, it is dimmed and takes none either.
 */
export function SecondaryButton({
  label,
  onPress,
  destructive = false,
  busy = false,
  disabled = false,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  /** Whether the request of the button is on the way. */
  busy?: boolean | undefined;
  disabled?: boolean | undefined;
  /** What VoiceOver reads after the label, such as why the button is disabled. */
  accessibilityHint?: string | undefined;
  testID?: string | undefined;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const labelColor = destructive ? onFill : colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy || disabled }}
      accessibilityHint={accessibilityHint}
      {...voice}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: destructive ? colors.destructive : withAlpha(colors.ink, 0.2),
          borderRadius: radii.button,
          backgroundColor: destructive
            ? colors.destructive
            : pressed
              ? colors.surfaceSunken
              : 'transparent',
          opacity: disabled && !busy ? disabledOpacity : destructive && pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {busy && <ActivityIndicator color={labelColor} />}
        <Text
          maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
          style={[styles.label, { color: labelColor, fontFamily: fontFamilies.ui }]}
        >
          {label}
        </Text>
      </View>
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
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { flexShrink: 1, fontSize: typeSize.body, fontWeight: '600', textAlign: 'center' },
});
