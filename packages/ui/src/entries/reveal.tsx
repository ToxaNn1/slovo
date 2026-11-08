'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { FlyingTextOf } from '../primitives/FlyingText';
import { useIsPageOnScreen, usePageSettle } from '../primitives/VerticalPager';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { entryReveal, motion, type RevealTimings } from '../tokens';

/**
 * An Entry card's reveal as its parts read it: `still` where nothing moves
 * (under Reduce Motion, or outside a card), or `moving`, where each part
 * follows the reveal's one timeline on the UI thread: the ms played so far,
 * at the full or the fast pace.
 */
type Reveal =
  | { readonly kind: 'still' }
  | {
      readonly kind: 'moving';
      readonly elapsed: SharedValue<number>;
      readonly fast: SharedValue<boolean>;
      readonly headline: FlyingTextOf;
    };

const RevealContext = createContext<Reveal>({ kind: 'still' });

/**
 * The pace of the reveals in one visit to the Feed, read and kept on the UI
 * thread where each reveal starts: whether the fast reveal is on, and whether
 * a card already played the full one in this visit.
 */
interface RevealPacer {
  readonly fastOn: SharedValue<boolean>;
  readonly firstPlayed: SharedValue<boolean>;
}

const PacerContext = createContext<RevealPacer | undefined>(undefined);

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
  const fastOn = useSharedValue(fast);
  const firstPlayed = useSharedValue(false);
  useEffect(() => {
    fastOn.value = fast;
  }, [fast, fastOn]);
  useEffect(() => {
    if (!visiting) firstPlayed.value = false;
  }, [visiting, firstPlayed]);
  const pacer = useMemo(() => ({ fastOn, firstPlayed }), [fastOn, firstPlayed]);
  return <PacerContext.Provider value={pacer}>{children}</PacerContext.Provider>;
}

/** Whether a play starting now takes the fast pace; full outside a `RevealPace`. */
function playsFast(pacer: RevealPacer | undefined): boolean {
  'worklet';
  if (!pacer?.fastOn.value) return false;
  if (!pacer.firstPlayed.value) {
    pacer.firstPlayed.value = true;
    return false;
  }
  return true;
}

/** When a pace's reveal ends, in ms from its start. */
function endOf({ headline, details }: RevealTimings): number {
  return Math.max(
    headline.delay + headline.duration,
    ...details.at.map((at) => at + details.duration),
  );
}

const FULL_END = endOf(entryReveal.full);
const FAST_END = endOf(entryReveal.fast);

const headlineEasing = Easing.bezierFn(...entryReveal.headlineEasing);
const detailEasing = Easing.bezierFn(...motion.cascade.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/** How far a part has come, from 0 to 1, `ms` into the reveal, for a part starting at `at` and lasting `duration`. */
function stepOf(ms: number, at: number, duration: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (ms - at) / duration));
}

/** Where the pager stands towards the card: resting on it, heading for it, or away. */
type Towards = 'settled' | 'heading' | 'away';

/**
 * An Entry card's reveal, played once: the headline flies in and the details
 * rise into place after it. It starts on the UI thread as soon as the card
 * comes into view, so a card the Feed's pager brings in draws itself while the
 * drag and the settle move it, at once outside a pager; a card the pager
 * heads for and leaves before it rests there shows its final frame. Under
 * Reduce Motion nothing moves and the card fades in once instead. Until the
 * system answers on Reduce Motion the card waits unseen. Each play takes its
 * pace from the Feed's `RevealPace`, full outside one. Returns the card's
 * fade, and the reveal its parts read.
 */
function useEntryReveal() {
  const onScreen = useIsPageOnScreen();
  const reduceMotion = useReduceMotionKnown();
  const settle = usePageSettle();
  const pacer = useContext(PacerContext);
  const elapsed = useSharedValue(0);
  const fast = useSharedValue(false);
  /** Whether the reveal played or jumped to its final frame: each card does so once. */
  const started = useSharedValue(false);
  const landed = useDerivedValue(() => {
    const { delay, duration } = (fast.value ? entryReveal.fast : entryReveal.full).headline;
    return headlineEasing(stepOf(elapsed.value, delay, duration));
  });

  const known = reduceMotion === false;
  // Plays once the card is in view: resting on screen, or partly there as a swipe moves it.
  useAnimatedReaction(
    () => known && (settle === undefined || Math.abs(settle.position.value - settle.page) < 1),
    (inView) => {
      if (!inView || started.value) return;
      const playFast = playsFast(pacer);
      const end = playFast ? FAST_END : FULL_END;
      started.set(true);
      fast.set(playFast);
      elapsed.set(
        withTiming(end, {
          duration: end,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
      );
    },
    [known, settle, pacer],
  );
  useAnimatedReaction(
    (): Towards | undefined => {
      if (!known || settle === undefined) return undefined;
      if (settle.settled.value === settle.page) return 'settled';
      return settle.turnedTo.value === settle.page ? 'heading' : 'away';
    },
    (towards, previous) => {
      if (towards !== 'away' || previous !== 'heading') return;
      // Swiped past before it settled: whole at once, never half drawn.
      started.set(true);
      fast.set(false);
      elapsed.set(FULL_END);
    },
    [known, settle],
  );

  const reveal = useMemo<Reveal>(
    () =>
      reduceMotion === true
        ? { kind: 'still' }
        : { kind: 'moving', elapsed, fast, headline: { landed } },
    [reduceMotion, elapsed, fast, landed],
  );
  const faded = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion === undefined || faded.value > 0) return;
    // With motion the headline and details carry the entrance; the card is there at once.
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

/** The headline flies in as one while the card reveals; it doesn't outside a card or under Reduce Motion. */
export function useFlyingText(): FlyingTextOf | undefined {
  const reveal = useContext(RevealContext);
  return reveal.kind === 'moving' ? reveal.headline : undefined;
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
  const reveal = useContext(RevealContext);
  const rise = useAnimatedStyle(() => {
    if (reveal.kind === 'still') return { opacity: 1, transform: [{ translateY: 0 }] };
    const { at, duration } = (reveal.fast.value ? entryReveal.fast : entryReveal.full).details;
    const shown = detailEasing(
      stepOf(reveal.elapsed.value, at[Math.min(step, at.length - 1)] ?? 0, duration),
    );
    return {
      opacity: shown,
      transform: [{ translateY: (1 - shown) * motion.cascade.rise }],
    };
  }, [reveal, step]);
  return (
    <Animated.View testID={testID} style={rise}>
      {children}
    </Animated.View>
  );
}
