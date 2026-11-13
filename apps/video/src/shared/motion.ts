import { Easing } from 'remotion';

/** `interpolate` options that hold the ends: nothing moves before or after its window. */
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** The overshooting ease every pop-in of the videos uses. */
export const pop = Easing.bezier(0.34, 1.56, 0.64, 1);
