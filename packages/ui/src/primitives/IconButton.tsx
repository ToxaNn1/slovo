import { Pressable, StyleSheet } from 'react-native';

import { useTokens } from '../providers/TokensProvider';
import { disabledOpacity, iconButton, pressedFade } from '../tokens';
import { Icon, type IconName } from './Icon';

/**
 * The design's 44-point icon button: an icon of the set on a sunken square
 * of `radius.tile`, or on the ink for a loud one. A press dims it; disabled,
 * it is dimmed and takes no press.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  ink = false,
  disabled = false,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Drawn on the ink with a background-coloured icon, as the Entry's back and share. */
  ink?: boolean;
  disabled?: boolean;
  testID?: string | undefined;
}) {
  const { colors, radii } = useTokens();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radii.tile,
          backgroundColor: ink ? colors.ink : colors.surfaceSunken,
          opacity: disabled ? disabledOpacity : pressed ? pressedFade : 1,
        },
      ]}
    >
      <Icon name={icon} size={iconButton.icon} color={ink ? colors.background : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: iconButton.side,
    height: iconButton.side,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
