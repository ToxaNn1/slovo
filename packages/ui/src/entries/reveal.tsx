'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { FlyingLettersOf } from '../primitives/FlyingLetters';
import { useIsPageOnScreen } from '../primitives/VerticalPager';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { entryReveal, motion } from '../tokens';

/**
 * Where an Entry card's reveal stands: `waiting` unseen to play, `playing`,
 * or `still`, where nothing moves (under Reduce Motion, or outside a card).
 */
type RevealState = 'waiting' | 'playing' | 'still';

const RevealContext = createContext<RevealState>('still');

const detailEasing = Easing.bezier(...motion.cascade.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * An Entry card's reveal each time its page comes on screen: the letters of
 * its headline fly in and its details rise into place after them. Under
 * Reduce Motion nothing moves and the card fades in once instead. Until the
 * system answers on Reduce Motion, and while the page is off screen, the
 * card waits unseen. Returns the card's fade, and the state its parts read.
 */
function useEntryReveal() {
  const onScreen = useIsPageOnScreen();
  const reduceMotion = useReduceMotionKnown();
  const state: RevealState =
    reduceMotion === true ? 'still' : onScreen && reduceMotion === false ? 'playing' : 'waiting';
  const faded = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion === undefined || faded.value > 0) return;
    // With motion the letters and details carry the entrance; the card is there at once.
    faded.value = reduceMotion
      ? onScreen
        ? withTiming(1, {
            duration: motion.reduceMotion.duration,
            easing: fadeEasing,
            reduceMotion: ReduceMotion.Never,
          })
        : 0
      : 1;
  }, [reduceMotion, onScreen, faded]);
  const fade = useAnimatedStyle(() => ({ opacity: faded.value }));
  return { fade, state };
}

const FadeContext = createContext<ReturnType<typeof useEntryReveal>['fade'] | undefined>(undefined);

/** An Entry card and its action row, whose parts play the card's reveal. */
export function EntryReveal({ children }: { children: ReactNode }) {
  const { fade, state } = useEntryReveal();
  return (
    <RevealContext.Provider value={state}>
      <FadeContext.Provider value={fade}>{children}</FadeContext.Provider>
    </RevealContext.Provider>
  );
}

/** The card's frame, which fades in under Reduce Motion. */
export function RevealFrame({
  testID,
  style,
  children,
}: {
  testID: string;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const fade = useContext(FadeContext);
  return (
    <Animated.View testID={testID} style={[style, fade]}>
      {children}
    </Animated.View>
  );
}

/** The headline's letters fly in while the card reveals; none outside a card or under Reduce Motion. */
export function useFlyingLetters(): FlyingLettersOf | undefined {
  const state = useContext(RevealContext);
  return state === 'still' ? undefined : { playing: state === 'playing' };
}

/**
 * One of an Entry card's details, which rises into place at the `step`-th
 * beat of the reveal (from 0, the first after the headline).
 */
export function RevealDetail({
  step,
  testID,
  children,
}: {
  step: number;
  testID?: string;
  children: ReactNode;
}) {
  const state = useContext(RevealContext);
  const shown = useSharedValue(state === 'still' ? 1 : 0);
  useEffect(() => {
    if (state === 'still') shown.value = 1;
    else if (state === 'waiting') shown.value = 0;
    else
      shown.value = withDelay(
        entryReveal.details[Math.min(step, entryReveal.details.length - 1)] ?? 0,
        withTiming(1, {
          duration: motion.cascade.duration,
          easing: detailEasing,
          reduceMotion: ReduceMotion.Never,
        }),
      );
  }, [state, step, shown]);
  const rise = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * motion.cascade.rise }],
  }));
  return (
    <Animated.View testID={testID} style={rise}>
      {children}
    </Animated.View>
  );
}
