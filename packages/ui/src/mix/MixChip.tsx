import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * A chip of the Mix: a Category, or «Усі». On is filled ink, off is the
 * surface with a line border; «Усі» is filled accent while everything is on
 * (`feature` marks it). A disabled chip, the last Category in the Mix, is
 * dimmed and reads its hint to VoiceOver.
 */
export function MixChip({
  label,
  on,
  onPress,
  disabled = false,
  accessibilityHint,
  feature = false,
  testID,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  feature?: boolean;
  testID?: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const fillColor = on ? (feature ? colors.accent : colors.ink) : colors.surface;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={disabled ? accessibilityHint : undefined}
      accessibilityState={{ selected: on, disabled }}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: fillColor,
          borderColor: on ? fillColor : colors.line,
          borderRadius: radii.chip,
          opacity: disabled ? DISABLED_OPACITY : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: on ? colors.background : colors.ink, fontFamily: fontFamilies.ui },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** How much the chip of the last Category in the Mix is dimmed. */
const DISABLED_OPACITY = 0.5;

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderWidth: 1,
  },
  label: { fontSize: typeSize.body, fontWeight: '600' },
});
