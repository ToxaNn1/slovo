import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, withAlpha } from '../tokens';

/** The button's size, the Stats pill's height beside it. */
const BUTTON_SIZE = 40;

/**
 * The magnifier of the «Головна» header, which opens Search. A round button
 * the size of the Stats pill beside it; VoiceOver reads «Пошук».
 */
export function SearchButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID="search-button"
      accessibilityRole="button"
      accessibilityLabel={strings.search.title}
      {...voice}
      onPress={onPress}
      // The 40 pt circle takes taps a little beyond its edge, to the 44 pt touch target.
      hitSlop={(minTouchTarget - BUTTON_SIZE) / 2}
      style={({ pressed }) => [
        styles.button,
        // The border of the Stats pill, at 35% of the accent.
        { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 0.35) },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Circle cx={10.5} cy={10.5} r={6.5} fill="none" stroke={colors.accent} strokeWidth={1.8} />
        <Path d="M15.5 15.5 20 20" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
