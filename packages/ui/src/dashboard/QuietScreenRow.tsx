'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { withoutStress, type EntryRowModel } from '@slovo/core';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { motion, pressedFade, quietScreen as place, typeStyle } from '../tokens';

const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * One Entry on a quiet Category's screen (board 05.2 k3), a plain row: the
 * Lemma and its short Definition as the gloss, a 1-point line under it. The
 * rows fade in one after another by `index`; under Reduce Motion each fades
 * in at once. A tap opens the Entry.
 */
export function QuietScreenRow({
  row,
  index,
  onPress,
  testID,
}: {
  row: EntryRowModel;
  /** The row's place in the list, from 0: it sets when the row fades in. */
  index: number;
  onPress: () => void;
  testID?: string;
}) {
  const shown = useFade(index);
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <Animated.View testID={testID && `${testID}-fade`} style={shown}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={row.spoken}
        accessibilityLanguage={voice.accessibilityLanguage}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.line },
          pressed && styles.pressed,
        ]}
      >
        <Text {...voice} style={[typeStyle('quietWord', tokens), { color: colors.ink }]}>
          {withoutStress(row.title)}
        </Text>
        <Text {...voice} style={[typeStyle('quietGloss', tokens), { color: colors.muted }]}>
          {row.secondLine}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** The row's entrance: it fades in after `index` rows, or under Reduce Motion at once. */
function useFade(index: number) {
  const reduceMotion = useReduceMotion();
  // 1 once the row has entered.
  const entered = useSharedValue(0);
  useEffect(() => {
    const fade = withTiming(1, {
      duration: reduceMotion ? motion.reduceMotion.duration : place.fade.duration,
      easing: fadeEasing,
      reduceMotion: ReduceMotion.Never,
    });
    entered.value = reduceMotion
      ? fade
      : withDelay(index * place.fade.stagger, fade, ReduceMotion.Never);
  }, [entered, index, reduceMotion]);
  return useAnimatedStyle(() => ({ opacity: entered.value }));
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: place.row.paddingVertical,
    gap: place.row.gap,
    borderBottomWidth: 1,
  },
  pressed: { opacity: pressedFade },
});
