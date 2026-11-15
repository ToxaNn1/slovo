import type { Streak } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { roundLayout, typeStyle } from '../tokens';

/**
 * The streak of «Виживання» at the top of the Round's body (board g7): the
 * right answers in a row as a huge red number, and «поспіль» and «рекорд
 * {best}» in two muted lines beside it, which VoiceOver reads as one line,
 * «4 поспіль · рекорд 9».
 */
export function SurvivalStreak({ streak }: { streak: Streak }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.game.round;
  const best = String(streak.record);
  return (
    <View
      testID="game-streak"
      accessible
      accessibilityLabel={fill(words.survivalStreak, { n: String(streak.rounds), best })}
      {...voice}
      style={styles.streak}
    >
      <Text
        testID="game-streak-rounds"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        style={[typeStyle('roundStreak', tokens), { color: colors.accent }]}
      >
        {streak.rounds}
      </Text>
      <View style={styles.lines}>
        {[words.survival.streak, fill(words.survival.best, { best })].map((line) => (
          <Text
            key={line}
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            style={[typeStyle('roundStreakLine', tokens), styles.line, { color: colors.muted }]}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  streak: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: roundLayout.gap,
  },
  lines: { flexShrink: 1 },
  line: { textAlign: 'right' },
});
