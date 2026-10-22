import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import {
  disabledOpacity,
  minTouchTarget,
  outlineButtonRadius,
  space,
  typeSize,
  withAlpha,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the label. */
const LABEL_MAX_FONT_SCALE = 1.3;
/** How far they may scale the label of a paired button, so both buttons stay on one line. */
const PAIRED_LABEL_MAX_FONT_SCALE = 1.2;

/**
 * A quiet button, such as «Повернути» on a list row: the label in the accent
 * colour inside a thin accent outline, at least 44 pt tall. A selected button
 * is filled with the accent colour, and a disabled one is dimmed.
 */
export function OutlineButton({
  label,
  accessibilityLabel = label,
  accessibilityHint,
  onPress,
  selected,
  disabled = false,
  paired = false,
  testID,
}: {
  label: string;
  /** What VoiceOver reads, where it differs from the label. */
  accessibilityLabel?: string;
  /** What VoiceOver adds about the button after its label. */
  accessibilityHint?: string | undefined;
  onPress: () => void;
  /** For a button that is one of a choice: whether it is the chosen one. */
  selected?: boolean;
  /** Dimmed, and takes no press. */
  disabled?: boolean;
  /** One of two buttons side by side, such as «Знаю» and «Не знаю»: wider, with a label that stops growing sooner. */
  paired?: boolean;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        paired && styles.paired,
        {
          opacity: disabled ? disabledOpacity : 1,
          borderColor: selected === true ? colors.accent : withAlpha(colors.accent, 0.45),
          backgroundColor:
            selected === true ? colors.accent : pressed ? colors.surfaceSunken : 'transparent',
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={paired ? PAIRED_LABEL_MAX_FONT_SCALE : LABEL_MAX_FONT_SCALE}
        style={[
          styles.label,
          {
            color: selected === true ? colors.background : colors.accent,
            fontFamily: fontFamilies.ui,
          },
        ]}
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
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: outlineButtonRadius,
  },
  paired: { paddingHorizontal: space[5] },
  label: { fontSize: typeSize.body, fontWeight: '700' },
});
