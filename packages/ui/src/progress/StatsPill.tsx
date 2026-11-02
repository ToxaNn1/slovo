import { Pressable, StyleSheet, Text } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, streakPill, typeStyle, wedges } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the number, so it stays inside the 32 pt pill. */
const NUMBER_MAX_FONT_SCALE = 1.3;

/**
 * The Streak pill in the Feed's header, from the design: a red mark and the
 * Streak on an ink pill. A tap opens the stats sheet. VoiceOver reads it
 * whole as a button, such as «Статистика: серія 12 днів». While the reader
 * hides the Streak, the pill keeps the mark alone, so the stats sheet stays
 * reachable, and VoiceOver reads «Статистика».
 */
export function StatsPill({
  streak,
  hideStreak = false,
  onPress,
}: {
  streak: number;
  hideStreak?: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count } = useEdition();
  return (
    <Pressable
      testID="stats-pill"
      accessibilityRole="button"
      accessibilityLabel={
        hideStreak ? strings.stats.pillLabelWithoutStreak : count(strings.stats.pillLabel, streak)
      }
      {...voice}
      onPress={onPress}
      // The 32 pt pill takes taps a little beyond its edge, to the 44 pt touch target.
      hitSlop={(minTouchTarget - streakPill.height) / 2}
      style={({ pressed }) => [
        styles.pill,
        // The mark alone is padded evenly.
        hideStreak && { paddingRight: streakPill.padding.left },
        { backgroundColor: colors.ink },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Wedge
        points={wedges.streak}
        color={colors.accent}
        width={streakPill.mark.width}
        height={streakPill.mark.height}
      />
      {!hideStreak && (
        <Text
          maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
          style={[typeStyle('streak', tokens), { color: colors.background }]}
        >
          {streak}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: streakPill.height,
    borderRadius: streakPill.radius,
    paddingLeft: streakPill.padding.left,
    paddingRight: streakPill.padding.right,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: streakPill.gap,
  },
});
