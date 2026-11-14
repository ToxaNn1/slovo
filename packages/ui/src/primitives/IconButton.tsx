import { Pressable, StyleSheet } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { disabledOpacity, iconButton, pressedFade } from '../tokens';
import { Icon, type IconName } from './Icon';

/**
 * The design's 44-point icon button: an icon of the set on a sunken square
 * of `radius.tile`, on the ink for a loud one, or on the accent while what it
 * opens is open (board 09's «⋯»). A press dims it; disabled,
 * it is dimmed and takes no press.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  fill = 'sunken',
  disabled = false,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** The square's fill; on the ink and the accent the icon takes the colour that reads on it. */
  fill?: 'sunken' | 'ink' | 'accent';
  disabled?: boolean;
  testID?: string | undefined;
}) {
  const { colors, radii } = useTokens();
  const { voice } = useEdition();
  const paint = {
    sunken: { ground: colors.surfaceSunken, icon: colors.ink },
    ink: { ground: colors.ink, icon: colors.background },
    accent: { ground: colors.accent, icon: colors.onAccent },
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...voice}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radii.tile,
          backgroundColor: paint[fill].ground,
          opacity: disabled ? disabledOpacity : pressed ? pressedFade : 1,
        },
      ]}
    >
      <Icon name={icon} size={iconButton.icon} color={paint[fill].icon} />
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
