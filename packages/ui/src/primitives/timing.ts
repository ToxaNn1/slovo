import { Easing, ReduceMotion } from 'react-native-reanimated';

import { motion, type Easing as Curve } from '../tokens';

/** A design easing curve as Reanimated's timing takes it. */
export function bezier([x1, y1, x2, y2]: Curve) {
  return Easing.bezier(x1, y1, x2, y2);
}

/** A design easing curve as a plain function of progress, for a curve read in a worklet. */
export function bezierFn([x1, y1, x2, y2]: Curve): (x: number) => number {
  return Easing.bezierFn(x1, y1, x2, y2);
}

/**
 * Under Reduce Motion a motion is this one fade in place, the design's `slRm`.
 * `ReduceMotion.Never`: the system setting would skip the fade too.
 */
export const REDUCED_FADE = {
  duration: motion.reduceMotion.duration,
  easing: bezier(motion.reduceMotion.easing),
  reduceMotion: ReduceMotion.Never,
};
