import type { Plural } from '@slovo/contracts';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { fontScaleCap, minTouchTarget, space, typeStyle, withAlpha, xpBarPadding } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The bar's height, the Search button's beside it. */
const BAR_HEIGHT = 40;

/**
 * The XP bar under the Feed's header: today's XP from the XP log, on the
 * surface fill with an accent border. A tap opens the
 * Game, where XP is earned. With a Daily Goal it draws today's Words Seen
 * over the goal in Words instead, such as «3 з 10 слів» (ADR 0074). VoiceOver
 * reads it whole as a button, such as «Досвід: сьогодні 12 XP», then that it
 * opens the Game.
 */
export function XpBar({
  today,
  goal,
  onPress,
}: {
  today: number;
  /** Today's Words Seen over today's Daily Goal; left out while no Daily Goal is set or it is off. */
  goal?: { readonly seen: number; readonly goal: number } | undefined;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count: plural } = useEdition();
  const count = { count: String(today) };
  // The goal picks the plural form: «з 21 слова», «з 10 слів» (ADR 0020).
  const words =
    goal && ((forms: Plural) => fill(plural(forms, goal.goal), { seen: String(goal.seen) }));
  return (
    <Pressable
      testID="xp-bar"
      accessibilityRole="button"
      accessibilityLabel={
        words ? words(strings.stats.wordsTowardGoalLabel) : fill(strings.stats.xpBarLabel, count)
      }
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
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('textLink', tokens), { color: colors.ink }]}
      >
        {words ? words(strings.stats.wordsTowardGoal) : fill(strings.stats.xpToday, count)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    paddingHorizontal: xpBarPadding,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1],
  },
});
