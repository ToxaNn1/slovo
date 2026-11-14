'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../providers/useReduceMotion';
import { ease } from './round-motion';

/** How far, in points from the right, the huge «ФІНІШ» flies in from, and in how long. */
const FLY = { from: 480, duration: 450 };

/** The turn of the huge «ФІНІШ» on the red panel, in degrees. */
const TURN = -6;

/**
 * The style of the huge «ФІНІШ» (board 06): turned, flying in from the right
 * as the poster arrives. With Reduce Motion it stands turned in place.
 */
export function useFlyIn() {
  const reduceMotion = useReduceMotion();
  /** 0 off the panel, 1 in place. */
  const flown = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    flown.value = withTiming(1, {
      duration: FLY.duration,
      easing: ease,
      reduceMotion: ReduceMotion.Never,
    });
    // The shared value is stable, so only the poster's arrival flies it in.
  }, [flown, reduceMotion]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: FLY.from * (1 - flown.value) }, { rotate: `${String(TURN)}deg` }],
  }));
}
