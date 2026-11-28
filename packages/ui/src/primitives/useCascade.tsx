'use no memo';
// Reanimated code: the React Compiler skips this module.

import { createContext, use, useEffect, useState, type ReactNode } from 'react';
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
 * How the items of a list enter, the first `delay` ms in (none by default),
 * each next one `stagger` ms after the one before, each taking `duration` ms:
 * a `rise` lifts it in by `motion.cascade.rise` as it shows, a `fade` only
 * shows it.
 */
export interface Cascade {
  readonly variant: 'rise' | 'fade';
  readonly stagger: number;
  readonly duration: number;
  readonly delay?: number;
}

/**
 * When the first item of a list that cascades mounted, in ms of
 * `performance.now()`; none before it.
 */
interface CascadeClock {
  opened: number | undefined;
}
const CascadeOpened = createContext<CascadeClock | undefined>(undefined);

/**
 * A virtualized list whose items cascade: an item it mounts later, as the
 * reader scrolls to it, waits only for what is left of its turn since the
 * first item mounted, rather than its whole turn after it mounts (27.11 pass:
 * the cards deep in a Correction Type's list stayed blank for seconds under the
 * finger). The clock starts with the first item, so a list that reads its items
 * first still cascades them.
 */
export function CascadeList({ children }: { children: ReactNode }) {
  const [clock] = useState((): CascadeClock => ({ opened: undefined }));
  return <CascadeOpened value={clock}>{children}</CascadeOpened>;
}

/**
 * The entrance of the item at `index` of a list, as an animated style: it
 * enters after `index` items, or under Reduce Motion only fades in at once.
 * In a `CascadeList` the turns count from when its first item mounted.
 */
export function useCascade(index: number, { variant, stagger, duration, delay = 0 }: Cascade) {
  const reduceMotion = useReduceMotion();
  const clock = use(CascadeOpened);
  // 1 once the item has entered.
  const entered = useSharedValue(0);
  useEffect(() => {
    const now = performance.now();
    if (clock !== undefined) clock.opened ??= now;
    const since = clock?.opened === undefined ? 0 : now - clock.opened;
    entered.value = reduceMotion
      ? withTiming(1, {
          duration: motion.reduceMotion.duration,
          easing: fadeEasing,
          reduceMotion: ReduceMotion.Never,
        })
      : withDelay(
          Math.max(0, delay + index * stagger - since),
          withTiming(1, {
            duration,
            easing: variant === 'rise' ? cascadeEasing : fadeEasing,
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never,
        );
  }, [entered, index, stagger, duration, delay, variant, reduceMotion, clock]);
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
