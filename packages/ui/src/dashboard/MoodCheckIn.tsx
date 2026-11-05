'use no memo';

import { fill, type Mood } from '@slovo/contracts';
import type { MoodBlock } from '@slovo/core';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../primitives/Button';
import { Chip } from '../primitives/Chip';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { motion, space, typeStyle } from '../tokens';

const moodLabel = (mood: Mood) => `${mood.emoji} ${mood.name}`;

/**
 * The Mood check-in of the Dashboard (ADR 0076). Asking, it puts «Як настрій?»
 * over a chip for each of the four moods and «Не сьогодні»; once a Mood is
 * chosen it folds to «Сьогодні: …» with the Mood's reply and «змінити», which
 * opens the chips again. Each fold rises in; with Reduce Motion it fades.
 */
export function MoodCheckIn({
  block,
  onChoose,
  onSkip,
}: {
  block: MoodBlock;
  onChoose: (moodId: string) => void;
  onSkip: () => void;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.dashboard.mood;
  const [changing, setChanging] = useState(false);
  const { check } = block;
  const folded = check.state === 'chosen' && !changing;
  const shown = useFoldIn(folded ? 'chosen' : 'asking');
  return (
    <View
      testID="dashboard-mood"
      style={[styles.block, { backgroundColor: colors.surface, borderRadius: radii.card }]}
    >
      <Animated.View style={[styles.fold, shown]}>
        {folded ? (
          <>
            <View style={styles.today}>
              <Text
                testID="dashboard-mood-today"
                {...voice}
                style={[styles.todayText, typeStyle('rowLabel', tokens), { color: colors.ink }]}
              >
                {fill(words.today, { mood: moodLabel(check.mood) })}
              </Text>
              <Button
                variant="ghost"
                testID="dashboard-mood-change"
                label={words.change}
                onPress={() => {
                  setChanging(true);
                }}
              />
            </View>
            <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
              {check.mood.reply}
            </Text>
          </>
        ) : (
          <>
            <Text
              {...voice}
              accessibilityRole="header"
              style={[typeStyle('heading', tokens), { color: colors.ink }]}
            >
              {words.question}
            </Text>
            <View style={styles.chips}>
              {block.moods.map((mood) => (
                <Chip
                  key={mood.id}
                  testID={`dashboard-mood-${mood.id}`}
                  label={moodLabel(mood)}
                  accessibilityLabel={mood.name}
                  on={check.state === 'chosen' && check.mood.id === mood.id}
                  onPress={() => {
                    setChanging(false);
                    onChoose(mood.id);
                  }}
                />
              ))}
            </View>
            {check.state === 'asking' && (
              <Button
                variant="ghost"
                testID="dashboard-mood-skip"
                label={words.skip}
                onPress={onSkip}
              />
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

/** The style that rises the check-in's part in each time `fold` changes, or fades it with Reduce Motion. */
function useFoldIn(fold: 'asking' | 'chosen') {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = 0;
    const { duration, easing } = reduceMotion ? motion.reduceMotion : motion.collapse;
    progress.value = withTiming(1, {
      duration,
      easing: Easing.bezier(...easing),
      reduceMotion: ReduceMotion.Never,
    });
  }, [fold, reduceMotion, progress]);
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * motion.collapse.rise }],
  }));
}

const styles = StyleSheet.create({
  block: { padding: space[4] },
  fold: { gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  today: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayText: { flex: 1 },
});
