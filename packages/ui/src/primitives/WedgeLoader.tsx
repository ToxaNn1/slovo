'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { motion, space, wedges } from '../tokens';
import { Wedge } from './Wedge';

/** One wedge of the loader, from the design. */
const WEDGE = { width: 14, height: 44 };
/** How short a wedge gets between beats. */
const SHORT = 0.35;
/** Each wedge starts this much after the one before it. */
const STAGGER_MS = 150;

const half = {
  duration: motion.loader.duration / 2,
  easing: Easing.bezier(...motion.loader.easing),
  reduceMotion: ReduceMotion.Never,
};

/**
 * The design's loader: three red wedges that grow and shrink one after
 * another. With Reduce Motion they stand still at full height. VoiceOver
 * skips it; the screen that shows it says what is loading.
 */
export function WedgeLoader({ testID }: { testID?: string | undefined }) {
  const reduceMotion = useReduceMotion();
  const first = useSharedValue(SHORT);
  const second = useSharedValue(SHORT);
  const third = useSharedValue(SHORT);

  useEffect(() => {
    const beats = [first, second, third];
    if (reduceMotion) {
      for (const beat of beats) beat.value = 1;
      return;
    }
    beats.forEach((beat, index) => {
      beat.value = SHORT;
      beat.value = withDelay(
        index * STAGGER_MS,
        withRepeat(withSequence(withTiming(1, half), withTiming(SHORT, half)), -1),
      );
    });
    return () => {
      for (const beat of beats) cancelAnimation(beat);
    };
  }, [reduceMotion, first, second, third]);

  return (
    <View testID={testID} accessible={false} style={styles.row}>
      <LoaderWedge beat={first} testID={testID === undefined ? undefined : `${testID}-0`} />
      <LoaderWedge beat={second} testID={testID === undefined ? undefined : `${testID}-1`} />
      <LoaderWedge beat={third} testID={testID === undefined ? undefined : `${testID}-2`} />
    </View>
  );
}

function LoaderWedge({ beat, testID }: { beat: SharedValue<number>; testID: string | undefined }) {
  const { colors } = useTokens();
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: beat.value }] }));
  return (
    <Animated.View testID={testID} style={style}>
      <Wedge points={wedges.loader} color={colors.accent} {...WEDGE} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
