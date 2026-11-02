import { LIFE_LOST_DELAY } from '@slovo/core';
import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * The canvas's CSS `ease`, for the Game's motion, from the design's motion
 * table and canvas keyframes. Each motion runs whatever the system setting,
 * which would otherwise skip the fills and fades too; with Reduce Motion the
 * components leave out the scale and the pop themselves. Nothing shakes.
 */
export const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

/** A right answer fills in 250 ms. */
export const RIGHT_FILL = { duration: 250, easing: ease, reduceMotion: ReduceMotion.Never };

/**
 * A wrong choice fills in 200 ms (`LIFE_LOST_DELAY`, which the Life's haptic
 * waits for too), and the other options fade as quickly.
 */
export const WRONG_FILL = {
  duration: LIFE_LOST_DELAY,
  easing: ease,
  reduceMotion: ReduceMotion.Never,
};
