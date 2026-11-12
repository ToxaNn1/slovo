'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useReduceMotion } from '../providers/useReduceMotion';
import { gesturesHint } from '../tokens';

/**
 * The swipe hint's demo (board XSwipeV, ADR 0112): while «ГОРТАЙ ПАЛЬЦЕМ» is
 * open the Feed's own card plays the three gestures. One round takes 8.4 s;
 * its place in the round runs from 0 to 1 and every part of the demo is a
 * function of it, so the card, its wedges, the finger and the sheet's rows
 * stay in step.
 */
export type SwipeDemo = SharedValue<number>;

/**
 * The demo's place in its round, looping while `playing`; none when it is not
 * playing or under Reduce Motion, when the card, the finger and the rows keep still.
 */
export function useGesturesDemo(playing: boolean): SwipeDemo | undefined {
  const reduceMotion = useReduceMotion();
  const animated = playing && !reduceMotion;
  const place = useSharedValue(0);
  useEffect(() => {
    if (!animated) return;
    place.value = 0;
    place.value = withRepeat(
      withTiming(1, {
        duration: gesturesHint.period,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
    );
    return () => {
      cancelAnimation(place);
      place.value = 0;
    };
  }, [animated, place]);
  return animated ? place : undefined;
}

const SwipeDemoContext = createContext<SwipeDemo | undefined>(undefined);

/** The demo playing over the Feed, which the card on screen plays; none outside a `SwipeDemoStage`. */
export function useSwipeDemo(): SwipeDemo | undefined {
  return useContext(SwipeDemoContext);
}

/**
 * The Feed under the demo: hands the demo to the card on screen and lifts the
 * whole Feed for the gesture up, so the next card rises with the current one.
 */
export function SwipeDemoStage({
  demo,
  children,
}: {
  demo: SwipeDemo | undefined;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: demo === undefined ? 0 : demoLift(demo.value) }],
  }));
  return (
    <SwipeDemoContext value={demo}>
      <Animated.View testID="swipe-demo-stage" style={[styles.stage, style]}>
        {children}
      </Animated.View>
    </SwipeDemoContext>
  );
}

/** The board's curve for the card and the finger. */
const glide = Easing.bezierFn(0.45, 0, 0.25, 1);
/** CSS's `ease`, the board's curve for the wedges and the rows. */
const ease = Easing.bezierFn(0.25, 0.1, 0.25, 1);

/**
 * The value at `place` on a track of keyframes: `stops` the places in the
 * round, rising from 0 to 1, `values` the value at each, eased by `curve`
 * within each segment, as a CSS animation runs its keyframes.
 */
function keyframe(
  place: number,
  stops: readonly number[],
  values: readonly number[],
  curve: (progress: number) => number,
): number {
  'worklet';
  let segment = 0;
  while (segment < stops.length - 2 && place > (stops[segment + 1] ?? 1)) segment += 1;
  const from = stops[segment] ?? 0;
  const to = stops[segment + 1] ?? 1;
  const start = values[segment] ?? 0;
  const end = values[segment + 1] ?? start;
  const progress = to > from ? Math.min(1, Math.max(0, (place - from) / (to - from))) : 1;
  return start + (end - start) * curve(progress);
}

const side = gesturesHint.fingerTravel;

// The board's keyframes (XSwipeV: tuCard3, tuNext3, tuKnow3, tuLearn3, tuFinger3, tuRow1–3).
const cardStops = [0, 0.06, 0.17, 0.25, 0.33, 0.38, 0.49, 0.57, 0.65, 1];
const cardXs = [0, 0, side, side, 0, 0, -side, -side, 0, 0];
const liftStops = [0, 0.7, 0.82, 0.9, 1];
const lifts = [0, 0, -gesturesHint.lift, -gesturesHint.lift, 0];
const edges = {
  known: {
    stops: [0, 0.12, 0.17, 0.25, 0.31, 1],
    opacities: [0, 0, 1, 1, 0, 0],
    shifts: [-1, -1, 0, 0, -0.3, -0.3],
  },
  unknown: {
    stops: [0, 0.44, 0.49, 0.57, 0.63, 1],
    opacities: [0, 0, 1, 1, 0, 0],
    shifts: [1, 1, 0, 0, 0.3, 0.3],
  },
} as const;
const fingerStops = [
  0, 0.03, 0.07, 0.17, 0.25, 0.3, 0.36, 0.4, 0.49, 0.57, 0.62, 0.67, 0.71, 0.82, 0.88, 0.93, 1,
];
const fingerOpacities = [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0];
const fingerXs = [0, 0, 0, side, side, side, 0, 0, -side, -side, -side, 0, 0, 0, 0, 0, 0];
const drop = gesturesHint.fingerDrop;
const rise = -gesturesHint.fingerRise;
const fingerYs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, drop, drop, rise, rise, rise, rise];
const fingerScales = [1.5, 1.5, 1, 1, 1, 1, 1.5, 1, 1, 1, 1, 1.5, 1, 1, 1, 1, 1];
const rows = {
  known: [0, 0.1, 0.14, 0.27, 0.3, 1],
  unknown: [0, 0.42, 0.46, 0.59, 0.62, 1],
  next: [0, 0.72, 0.76, 0.91, 0.94, 1],
} as const;
const rowLights = [0, 0, 1, 1, 0, 0];

/** The card on screen at `place`: how far it is off to a side, and its tilt in degrees. */
export function demoCard(place: number): { x: number; tilt: number } {
  'worklet';
  const x = keyframe(place, cardStops, cardXs, glide);
  return { x, tilt: (x / side) * gesturesHint.cardTilt };
}

/** How far the Feed is lifted at `place`, the card on screen and the next one together. */
export function demoLift(place: number): number {
  'worklet';
  return keyframe(place, liftStops, lifts, glide);
}

/** A wedge at `place`: how clear it is, and how far it is off its place, in its own widths. */
export function demoEdge(
  place: number,
  edge: 'known' | 'unknown',
): { opacity: number; shift: number } {
  'worklet';
  const { stops, opacities, shifts } = edges[edge];
  return {
    opacity: keyframe(place, stops, opacities, ease),
    shift: keyframe(place, stops, shifts, ease),
  };
}

/** The finger at `place`: how clear it is, how far it is off its rest, and how big. */
export function demoFinger(place: number): {
  opacity: number;
  x: number;
  y: number;
  scale: number;
} {
  'worklet';
  return {
    opacity: keyframe(place, fingerStops, fingerOpacities, glide),
    x: keyframe(place, fingerStops, fingerXs, glide),
    y: keyframe(place, fingerStops, fingerYs, glide),
    scale: keyframe(place, fingerStops, fingerScales, glide),
  };
}

/** How lit the sheet's row of `gesture` is at `place`, 0 to 1. */
export function demoRow(place: number, gesture: 'known' | 'unknown' | 'next'): number {
  'worklet';
  return keyframe(place, rows[gesture], rowLights, ease);
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
});
