'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../providers/useReduceMotion';
import { motion } from '../tokens';

const cascadeEasing = Easing.bezier(...motion.cascade.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * How the items of a list enter, one `stagger` ms after the one before, each
 * taking `duration` ms: a `rise` lifts it in by `motion.cascade.rise` as it
 * shows, a `fade` only shows it.
 */
export interface Cascade {
  readonly variant: 'rise' | 'fade';
  readonly stagger: number;
  readonly duration: number;
}

/**
 * The entrance of the item at `index` of a list, as an animated style: it
 * enters after `index` items, or under Reduce Motion only fades in at once
 * (ADR 0055).
 */
export function useCascade(index: number, { variant, stagger, duration }: Cascade) {
  const reduceMotion = useReduceMotion();
  // 1 once the item has entered.
  const entered = useSharedValue(0);
  useEffect(() => {
    entered.value = reduceMotion
      ? withTiming(1, {
          duration: motion.reduceMotion.duration,
          easing: fadeEasing,
          reduceMotion: ReduceMotion.Never,
        })
      : withDelay(
          index * stagger,
          withTiming(1, {
            duration,
            easing: variant === 'rise' ? cascadeEasing : fadeEasing,
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never,
        );
  }, [entered, index, stagger, duration, variant, reduceMotion]);
  const rises = variant === 'rise' && !reduceMotion;
  return useAnimatedStyle(() =>
    rises
      ? {
          opacity: entered.value,
          transform: [{ translateY: (1 - entered.value) * motion.cascade.rise }],
        }
      : { opacity: entered.value },
  );
}
