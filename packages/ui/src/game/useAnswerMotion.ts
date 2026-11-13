'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef } from 'react';
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '../providers/useReduceMotion';
import { RIGHT_FILL, WRONG_FILL } from './round-motion';

/** How a right answer pops, the board's `slPop`: its scale at the start, 60 % and the end. */
const POP = [0.6, 1.12, 1];

/** How a wrong answer drops, the board's `slDrop`: down, tilted (degrees) and faded. */
export interface AnswerDrop {
  translateY: number;
  rotate: number;
  opacity: number;
}

/**
 * The style of an answer as it is judged: a right one pops, a wrong one drops.
 * Only the answer given now moves; one shown judged from the start stays put.
 * With Reduce Motion the fade alone shows a wrong answer.
 */
export function useAnswerMotion(answer: 'right' | 'wrong' | undefined, drop: AnswerDrop) {
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once it has popped or dropped. */
  const moved = useSharedValue(answer === undefined ? 0 : 1);
  // Whether the answer showed before, so only the answer given now moves it.
  const shown = useRef(answer !== undefined);

  useEffect(() => {
    if (answer === undefined || shown.current) return;
    shown.current = true;
    moved.value = 0;
    moved.value = withTiming(1, answer === 'right' ? RIGHT_FILL : WRONG_FILL);
    // The shared value is stable, so only the answer given moves it.
  }, [answer, moved]);

  const still = reduceMotion || answer === undefined;
  return useAnimatedStyle(() => {
    if (answer === 'wrong')
      return {
        opacity: 1 - (1 - drop.opacity) * moved.value,
        transform: still
          ? []
          : [
              { translateY: drop.translateY * moved.value },
              { rotate: `${String(drop.rotate * moved.value)}deg` },
            ],
      };
    return {
      opacity: 1,
      transform: still ? [] : [{ scale: interpolate(moved.value, [0, 0.6, 1], POP) }],
    };
  });
}
