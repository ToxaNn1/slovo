'use no memo';
// Gesture-handler and Worklets code: the React Compiler skips this module (ADR 0059).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePanGesture, type PanGestureConfig } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** What a point of the trace lands on: its index among the targets and the place handed on. */
export interface TraceHit<P> {
  readonly index: number;
  readonly place: P;
}

/**
 * The drag of a trace: each target the finger reaches is handed to `onExtend`
 * once, until it moves on to another, and lifting the finger calls `onRelease`.
 * `hit` is a memoised worklet that finds the target under a point, if any.
 */
export function useTraceDrag<P>({
  hit,
  enabled,
  testID,
  onExtend,
  onRelease,
}: {
  hit: (x: number, y: number) => TraceHit<P> | undefined;
  enabled: boolean;
  testID: string;
  onExtend: (place: P) => void;
  onRelease: () => void;
}) {
  const last = useSharedValue(-1);
  const handlers = useRef({ onExtend, onRelease });
  useEffect(() => {
    handlers.current = { onExtend, onRelease };
  });
  const extend = useCallback((place: P) => {
    handlers.current.onExtend(place);
  }, []);
  const release = useCallback(() => {
    handlers.current.onRelease();
  }, []);

  // Gesture Handler asks for a memoised config: a new one on each render
  // sends the gesture's worklets to the UI thread again, for every target a
  // trace crosses. A config built outside the hook's call is not workletized
  // for us, so each callback says so.
  const config = useMemo((): PanGestureConfig => {
    const reach = (x: number, y: number) => {
      'worklet';
      const at = hit(x, y);
      if (at === undefined || at.index === last.value) return;
      last.value = at.index;
      scheduleOnRN(extend, at.place);
    };
    return {
      enabled,
      minDistance: 0,
      onBegin: ({ x, y }) => {
        'worklet';
        last.value = -1;
        reach(x, y);
      },
      onActivate: ({ x, y }) => {
        'worklet';
        reach(x, y);
      },
      onUpdate: ({ x, y }) => {
        'worklet';
        reach(x, y);
      },
      onFinalize: () => {
        'worklet';
        last.value = -1;
        scheduleOnRN(release);
      },
      // How a component test finds the drag; Gesture Handler reads it in Jest only.
      testID: `${testID}-trace`,
    };
  }, [enabled, testID, hit, last, extend, release]);
  return usePanGesture(config);
}
