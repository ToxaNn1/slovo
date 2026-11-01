import { Pressable, StyleSheet, Text } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { minTouchTarget, space, statsPillPadding, typeSize, withAlpha } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The bar's height, from the design: the same as the Stats pill it stands beside. */
const BAR_HEIGHT = 40;

/** How far the largest text sizes of iOS may scale the number, so it stays inside the 40 pt bar. */
const NUMBER_MAX_FONT_SCALE = 1.3;

/**
 * The XP bar in the Feed's top row: today's XP from the XP log, on the
 * surface fill with an accent border, beside the Stats pill. A tap opens the
 * Game, where XP is earned. With a Daily Goal it draws today's XP over the
 * goal, such as «12/20 XP». VoiceOver reads it whole as a button, such as
 * «Досвід: сьогодні 12 XP», then that it opens the Game.
 */
export function XpBar({
  today,
  goal,
  onPress,
}: {
  today: number;
  /** Today's Daily Goal; left out while the Daily Goal is off. */
  goal?: number | undefined;
  onPress: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const count = goal === undefined ? String(today) : `${String(today)}/${String(goal)}`;
  return (
    <Pressable
      testID="xp-bar"
      accessibilityRole="button"
      accessibilityLabel={fill(strings.stats.xpBarLabel, { count })}
      accessibilityHint={strings.stats.xpBarHint}
      {...voice}
      onPress={onPress}
      // The 40 pt bar takes taps a little beyond its edge, to the 44 pt touch target.
      hitSlop={(minTouchTarget - BAR_HEIGHT) / 2}
      style={({ pressed }) => [
        styles.bar,
        // The design draws the accent border at 35%.
        { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 0.35) },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[styles.today, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {fill(strings.stats.xpToday, { count })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    paddingHorizontal: statsPillPadding.right,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1],
  },
  today: { fontSize: typeSize.body, fontWeight: '700' },
});
