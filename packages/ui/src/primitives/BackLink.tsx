import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { fontScaleCap, iconButton, pressedFade, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { Icon } from './Icon';

/**
 * The back control at the top of a pushed screen, as the board draws it: the
 * 44-point back tile, and beside it, muted, the name of the screen it returns to.
 */
export function BackLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [styles.link, { opacity: pressed ? pressedFade : 1 }]}
    >
      <View
        style={[styles.tile, { borderRadius: radii.tile, backgroundColor: colors.surfaceSunken }]}
      >
        <Icon name="back" size={iconButton.icon} color={colors.ink} />
      </View>
      <Text
        // At the largest accessibility sizes the screen's name would break across lines.
        maxFontSizeMultiplier={fontScaleCap.number}
        numberOfLines={1}
        style={[styles.label, typeStyle('backLink', tokens), { color: colors.muted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[3],
  },
  tile: {
    width: iconButton.side,
    height: iconButton.side,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flexShrink: 1 },
});
