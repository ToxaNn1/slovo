import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from './EditionProvider';
import { minTouchTarget, space, withAlpha } from './tokens';
import { useTokens } from './TokensProvider';

/** The pill's height, from the design. */
const PILL_HEIGHT = 40;

/** How far the largest text sizes of iOS may scale the number, so it stays inside the 40 pt pill. */
const NUMBER_MAX_FONT_SCALE = 1.3;

/**
 * The Stats pill in the Feed's top row: a flame and the Streak, on the
 * surface fill with an accent border. A tap opens the stats sheet. VoiceOver
 * reads it whole as a button, such as «Статистика: серія 12 днів».
 */
export function StatsPill({ streak, onPress }: { streak: number; onPress: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  return (
    <Pressable
      testID="stats-pill"
      accessibilityRole="button"
      accessibilityLabel={count(strings.stats.pillLabel, streak)}
      {...voice}
      onPress={onPress}
      // The 40 pt pill takes taps a little beyond its edge, to the 44 pt touch target.
      hitSlop={(minTouchTarget - PILL_HEIGHT) / 2}
      style={({ pressed }) => [
        styles.pill,
        // The design draws the accent border at 35%.
        { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 0.35) },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.6 1 2.6 2 3C11 8.6 11 6 12 3z"
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.8}
        />
      </Svg>
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[styles.streak, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {streak}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1] + 2,
  },
  streak: { fontSize: 15, fontWeight: '700' },
});
