'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { entryReveal, motion, type RevealPace } from '../tokens';

/**
 * Where an Entry card's reveal stands: `waiting` unseen to play, `playing`,
 * or `still`, where nothing moves (under Reduce Motion, or outside a card).
 */
type RevealState = 'waiting' | 'playing' | 'still';

/** A card's reveal as its parts read it: its state, and the pace it plays at, known once it plays. */
interface Reveal {
  readonly state: RevealState;
  readonly pace: () => RevealPace;
}

const fullPace = (): RevealPace => 'full';

const RevealContext = createContext<Reveal>({ state: 'still', pace: fullPace });

/**
 * Which pace a card's play takes: each play asks once, by a token of its own,
 * and asking again by the same token answers the same.
 */
interface RevealPacer {
  readonly paceOf: (play: object) => RevealPace;
}

const PacerContext = createContext<RevealPacer>({ paceOf: fullPace });

/**
 * The reveals of one visit to the Feed: the first card to play plays the full
 * reveal, every next one the fast reveal while `fast` is on. A new visit,
 * after `visiting` turns false, starts again with a full reveal.
 */
export function RevealPace({
  fast,
  visiting,
  children,
}: {
  fast: boolean;
  visiting: boolean;
  children: ReactNode;
}) {
  const fastOn = useRef(fast);
  /** The play that played the full reveal in this visit, if any did. */
  const first = useRef<object | undefined>(undefined);
  useEffect(() => {
    fastOn.current = fast;
  }, [fast]);
  useEffect(() => {
    if (!visiting) first.current = undefined;
  }, [visiting]);
  const [pacer] = useState<RevealPacer>(() => ({
    paceOf(play) {
      if (!fastOn.current) return 'full';
      first.current ??= play;
      return first.current === play ? 'full' : 'fast';
    },
  }));
  return <PacerContext.Provider value={pacer}>{children}</PacerContext.Provider>;
}

const detailEasing = Easing.bezier(...motion.cascade.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * An Entry card's reveal each time its page comes on screen: the letters of
 * its headline fly in and its details rise into place after them. Under
 * Reduce Motion nothing moves and the card fades in once instead. Until the
 * system answers on Reduce Motion, and while the page is off screen, the
 * card waits unseen. Each play takes its pace from the Feed's `RevealPace`,
 * full outside one. Returns the card's fade, and the state its parts read.
 */
function useEntryReveal() {
  const onScreen = useIsPageOnScreen();
  const reduceMotion = useReduceMotionKnown();
  const state: RevealState =
    reduceMotion === true ? 'still' : onScreen && reduceMotion === false ? 'playing' : 'waiting';
  const pacer = useContext(PacerContext);
  // A new token for each play, so the pacer tells each play apart.
  const play = useMemo(() => ({ state }), [state]);
  const pace = useRef<RevealPace>('full');
  // Before the effects of the card's parts, which start their motion at this pace.
  useLayoutEffect(() => {
    if (play.state === 'playing') pace.current = pacer.paceOf(play);
  }, [play, pacer]);
  const [readPace] = useState(() => () => pace.current);
  const reveal = useMemo<Reveal>(() => ({ state, pace: readPace }), [state, readPace]);
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
  return { fade, reveal };
}

const FadeContext = createContext<ReturnType<typeof useEntryReveal>['fade'] | undefined>(undefined);

/** An Entry card and its action row, whose parts play the card's reveal. */
export function EntryReveal({ children }: { children: ReactNode }) {
  const { fade, reveal } = useEntryReveal();
  return (
    <RevealContext.Provider value={reveal}>
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
  const { state, pace } = useContext(RevealContext);
  return useMemo(
    () => (state === 'still' ? undefined : { playing: state === 'playing', pace }),
    [state, pace],
  );
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
  const { state, pace } = useContext(RevealContext);
  const shown = useSharedValue(state === 'still' ? 1 : 0);
  useEffect(() => {
    if (state === 'still') shown.value = 1;
    else if (state === 'waiting') shown.value = 0;
    else {
      const { at, duration } = entryReveal[pace()].details;
      shown.value = withDelay(
        at[Math.min(step, at.length - 1)] ?? 0,
        withTiming(1, { duration, easing: detailEasing, reduceMotion: ReduceMotion.Never }),
      );
    }
  }, [state, pace, step, shown]);
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
