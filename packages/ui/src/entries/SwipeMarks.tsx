'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { KnowledgeMark } from '@slovo/core';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  type PanGestureConfig,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import {
  PageActionsProvider,
  useIsPageOnScreen,
  useTurnToNextPage,
  useTurnToNextPageOnUI,
  useTurnToThisPage,
} from '../primitives/VerticalPager';
import { useUndoToast } from '../primitives/UndoToast';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useHaptics } from '../providers/HapticsProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { swipeEdgeLayout, swipeStampLayout, typeStyle, wedges } from '../tokens';

/** The side swipes of an Entry card, under the `swipeMarks` Feature Switch (ADR 0077). */
export interface EntrySwipe {
  /** The Knowledge Mark the card shows; none on an Entry with no mark. */
  readonly mark: KnowledgeMark | undefined;
  /** Sets the mark a swipe went to: right for Known, left for Unknown. */
  readonly onMark: (mark: KnowledgeMark) => void;
  /** Undoes the mark the last swipe set, from the undo toast. */
  readonly onUndo: () => void;
}

/**
 * The share of the card's width it goes before a release sets the mark (owner 06.11):
 * short of it the reader is only looking at the edge label, and the card springs back.
 */
export const MARK_SHARE = 0.4;
/** The card's width until its first layout, a phone's card. */
const UNMEASURED_WIDTH = 360;
/** How fast, in points per second, a fling the way the card goes sets the mark from any distance. */
export const MARK_VELOCITY = 800;
/** Where a marked card flies to, off screen, and where an undone one comes back from (board 04). */
const OFF_SCREEN = 520;

/**
 * The card springs back to its place from the speed the finger let it go at,
 * a touch past it and home: a 0.3 s spring, which Reanimated plays out and
 * settles in 1.5 times that, 0.45 s, about the design's 0.42 s curve.
 */
const BACK = { duration: 300, dampingRatio: 0.85, reduceMotion: ReduceMotion.Never };
/** A marked card flies off in 0.3 s at most, gathering speed as it leaves (board 04, ADR 0078). */
const FLY_DURATION = 300;
/** The shortest fly, for the fastest fling. */
const FLY_SHORTEST = 100;
/** Where the fly's curve sets its first control point along the time. */
const FLY_HANDLE = 0.4;
const FADE = { duration: 200, easing: Easing.linear, reduceMotion: ReduceMotion.Never };
/**
 * The stamp lands in 0.45 s (#1578), one of the Рупор peaks ADR 0055 allows,
 * on one curve that runs a little past its end and comes back (ease-out
 * back), so the stamp presses in and settles with no corner in its motion.
 */
const STAMP_LANDS = {
  duration: 450,
  easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  reduceMotion: ReduceMotion.Never,
};

/**
 * How a marked card flies off `remaining` points, let go at `speed` points a
 * second its way: it leaves at the finger's speed, never slower, and gathers
 * speed to the edge in at most 0.3 s; a fling faster than that goes straight
 * off at its own speed.
 */
function flyFrom(remaining: number, speed: number) {
  'worklet';
  const duration =
    speed > 0
      ? Math.max(FLY_SHORTEST, Math.min(FLY_DURATION, (remaining / speed) * 1000))
      : FLY_DURATION;
  // The curve's slope at its start is the finger's speed as a share of the average.
  const start = Math.min(1, (speed * duration) / 1000 / Math.max(1, remaining));
  return {
    duration,
    easing: Easing.bezier(FLY_HANDLE, FLY_HANDLE * start, 1, 1),
    reduceMotion: ReduceMotion.Never,
  };
}
// hidden: not on board 04, owner 05.11. The «ВГОРУ — НАСТУПНЕ» chip's fade and the card's nudge.
// /** Under Reduce Motion the chip comes in as the one short fade of ADR 0055. */
// const CHIP_FADE = {
//   duration: motion.reduceMotion.duration,
//   easing: Easing.bezier(...motion.reduceMotion.easing),
//   reduceMotion: ReduceMotion.Never,
// };
// const NUDGE_STEP = {
//   duration: 275,
//   easing: Easing.inOut(Easing.quad),
//   reduceMotion: ReduceMotion.Never,
// };

/**
 * Wraps an Entry card in its side swipes: right marks the Entry Known, left
 * Unknown. The card follows the finger and tilts, and the mark's wedge slides
 * in from the edge it leaves, fully in where a release sets the mark: past
 * 40% of the card's width, or a fling the way the card goes. In a pager with
 * a next page the card then flies off its side in 0.3 s and the pager turns
 * to the next Entry, elsewhere it springs back, as it does on anything less,
 * a drag brought back short of the threshold or flicked back towards the
 * middle included (ADR 0078). The undo toast shows for 4 s; its undo turns
 * back to the card and brings it in from its side. A marked card carries its
 * stamp on its bottom edge. A swipe to the mark the card already shows
 * changes nothing. Concealed under Self-check, the card takes no side swipe.
 * Under Reduce Motion the card stays in place, the wedges and stamp only fade
 * and the pager's own cross-fade turns the page. VoiceOver reads both marks
 * as actions of the card, beside its page turns.
 */
export function SwipeMarks({
  swipe,
  concealed,
  correction,
  fill = false,
  children,
}: {
  swipe: EntrySwipe;
  concealed: boolean;
  /** The card is a Correction's, whose Known stamp says the reader already says it right. */
  correction: boolean;
  /** The card is a fixed frame that takes the page's height (ADR 0088), so the swipe grows to it. */
  fill?: boolean;
  children: ReactNode;
}) {
  const { strings } = useEdition();
  const texts = strings.knowledge.swipe;
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const reduceMotion = useReduceMotion();
  const haptics = useHaptics();
  const showToast = useUndoToast();
  const turnToNext = useTurnToNextPage();
  const turnToNextOnUI = useTurnToNextPageOnUI();
  const turnBackHere = useTurnToThisPage();
  const onScreen = useIsPageOnScreen();
  const { mark, onMark, onUndo } = swipe;

  const offset = useSharedValue(0);
  const drag = useSharedValue(0);
  /** How far the card goes before a release sets the mark: 40% of its width. */
  const markDistance = useSharedValue(UNMEASURED_WIDTH * MARK_SHARE);
  /** The card is flying off after a mark, and takes no drag until it is back. */
  const flying = useSharedValue(false);
  /** The wedges' widths, which they slide by to come in from beyond the card's edges. */
  const knownWidth = useSharedValue(0);
  const unknownWidth = useSharedValue(0);
  const stamp = useSharedValue(mark === undefined ? 0 : 1);
  // hidden: not on board 04, owner 05.11. The nudge's lift and the page the chip shows on.
  // const lift = useSharedValue(0);
  // const [markedOn, setMarkedOn] = useState<(() => void) | undefined>(undefined);
  const latest = useRef({ mark, onMark, onUndo, turnToNext, turnBackHere });
  latest.current = { mark, onMark, onUndo, turnToNext, turnBackHere };
  /** The mark whose toast waits for the next Entry to come in. */
  const toastAfterTurn = useRef<KnowledgeMark | undefined>(undefined);

  // A card that flew off is back in its place, unseen, once its page leaves the screen.
  useEffect(() => {
    if (onScreen) return;
    flying.value = false;
    offset.value = 0;
    drag.value = 0;
  }, [drag, flying, offset, onScreen]);

  // The stamp lands each time the card's mark changes, from a swipe, a VoiceOver action or its «⋯» sheet.
  const stamped = useRef(mark);
  useEffect(() => {
    if (stamped.current === mark) return;
    stamped.current = mark;
    stamp.value =
      mark === undefined
        ? 0
        : withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, reduceMotion ? FADE : STAMP_LANDS),
          );
  }, [mark, reduceMotion, stamp]);

  const textOf = useCallback(
    (byMark: { known: string; unknown: string; correctionKnown: string }, to: KnowledgeMark) =>
      to === 'known' && correction ? byMark.correctionKnown : byMark[to],
    [correction],
  );

  const showMarkToast = useCallback(
    (to: KnowledgeMark) => {
      showToast({
        message: textOf(texts.toasts, to),
        undoLabel: texts.undo,
        onUndo: () => {
          const { turnBackHere: turnBack, onUndo: undo } = latest.current;
          turnBack?.();
          flying.value = false;
          drag.value = 0;
          offset.value = reduceMotion
            ? 0
            : withSequence(
                withTiming(to === 'known' ? OFF_SCREEN : -OFF_SCREEN, { duration: 0 }),
                withSpring(0, BACK),
              );
          undo();
        },
      });
    },
    [drag, flying, offset, reduceMotion, showToast, textOf, texts],
  );

  /**
   * Sets the mark a swipe or a VoiceOver action went to. When the pager turns
   * on after it, the toast waits for the next Entry, so the turn doesn't close it.
   */
  const setMark = useCallback(
    (to: KnowledgeMark, turnsOn: boolean) => {
      const current = latest.current;
      if (current.mark === to) return;
      haptics.selection();
      current.onMark(to);
      // hidden: not on board 04, owner 05.11. While a next Entry waits, the card nudged up once and the chip showed.
      // if (current.turnToNext !== undefined) {
      //   setMarkedOn(() => current.turnToNext);
      //   if (!reduceMotion)
      //     lift.value = withDelay(
      //       550,
      //       withSequence(
      //         withTiming(-22, NUDGE_STEP),
      //         withTiming(0, NUDGE_STEP),
      //         withTiming(-9, NUDGE_STEP),
      //         withTiming(0, NUDGE_STEP),
      //       ),
      //     );
      // }
      if (turnsOn) toastAfterTurn.current = to;
      else showMarkToast(to);
    },
    [haptics, showMarkToast],
  );

  /** Shows the toast that waited for the next Entry to come in. */
  const showToastAfterTurn = useCallback(() => {
    const to = toastAfterTurn.current;
    toastAfterTurn.current = undefined;
    if (to !== undefined) showMarkToast(to);
  }, [showMarkToast]);

  /**
   * A release set the mark; under Reduce Motion the pager turns on at once.
   * A card that flies off has turned the pager already, on the UI thread.
   */
  const release = useCallback(
    (to: KnowledgeMark, flew: boolean) => {
      const turnsOn = flew || (reduceMotion && latest.current.turnToNext !== undefined);
      setMark(to, turnsOn);
      if (turnsOn && !flew) {
        latest.current.turnToNext?.();
        showToastAfterTurn();
      }
    },
    [reduceMotion, setMark, showToastAfterTurn],
  );

  // Gesture Handler asks for a memoised config: a config built outside the
  // hook's call is not workletized for us, so each callback says so.
  const panConfig = useMemo(
    (): PanGestureConfig => ({
      enabled: !concealed,
      activeOffsetX: [-8, 8],
      failOffsetY: [-8, 8],
      onUpdate: ({ translationX }) => {
        'worklet';
        if (flying.value) return;
        drag.value = translationX;
        if (!reduceMotion) offset.value = translationX;
      },
      onDeactivate: ({ translationX, velocityX }) => {
        'worklet';
        if (flying.value) return;
        // A fling counts only the way the card goes: a flick back towards the middle cancels.
        const to =
          translationX >= markDistance.value || (translationX > 0 && velocityX >= MARK_VELOCITY)
            ? 'known'
            : translationX <= -markDistance.value ||
                (translationX < 0 && velocityX <= -MARK_VELOCITY)
              ? 'unknown'
              : undefined;
        // A swipe past the threshold flies the card off when the pager has a next page and motion is on.
        const flew = to !== undefined && !reduceMotion && turnToNextOnUI !== undefined;
        if (to !== undefined) scheduleOnRN(release, to, flew);
        if (flew) {
          flying.value = true;
          // The next Entry comes in under the card as it flies, in the same frame,
          // rather than after the fly and a busy JS thread (board XSwipe).
          turnToNextOnUI();
          const side = to === 'known' ? 1 : -1;
          offset.value = withTiming(
            side * OFF_SCREEN,
            flyFrom(OFF_SCREEN - side * translationX, Math.max(0, side * velocityX)),
            () => {
              scheduleOnRN(showToastAfterTurn);
            },
          );
          return;
        }
        drag.value = withTiming(0, FADE);
        // The card goes home from the speed it was let go at, with no stop first.
        offset.value = withSpring(0, { ...BACK, velocity: velocityX });
      },
      testID: 'entry-card-side-swipe',
    }),
    [
      concealed,
      drag,
      flying,
      markDistance,
      offset,
      reduceMotion,
      release,
      showToastAfterTurn,
      turnToNextOnUI,
    ],
  );
  const pan = usePanGesture(panConfig);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      // hidden: not on board 04, owner 05.11. The nudge added `+ lift.value` here.
      { translateY: Math.abs(offset.value) * 0.04 },
      { rotate: `${String(offset.value / 16)}deg` },
    ],
  }));
  // Each wedge slides in from its edge as the drag nears the threshold, fully in at it; under Reduce Motion it only fades.
  const knownEdgeStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, drag.value) / markDistance.value);
    return {
      opacity: progress,
      transform: [{ translateX: reduceMotion ? 0 : (progress - 1) * knownWidth.value }],
    };
  });
  const unknownEdgeStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -drag.value) / markDistance.value);
    return {
      opacity: progress,
      transform: [{ translateX: reduceMotion ? 0 : (1 - progress) * unknownWidth.value }],
    };
  });
  const stampStyle = useAnimatedStyle(() => {
    const progress = stamp.value;
    if (reduceMotion) return { opacity: progress, transform: [{ rotate: '-6deg' }] };
    // Lands from 1.6 to 1, pressing in to about 0.94 as the curve runs past its end, turning from -14° to -6°.
    return {
      opacity: Math.min(1, Math.max(0, progress * 2)),
      transform: [{ scale: 1.6 - progress * 0.6 }, { rotate: `${String(-14 + progress * 8)}deg` }],
    };
  });

  const markActions = useMemo(
    () =>
      concealed
        ? []
        : [
            { name: 'known', label: texts.edges.known },
            { name: 'unknown', label: texts.edges.unknown },
          ],
    [concealed, texts],
  );
  const onAction = useCallback(
    (name: string) => {
      if (name === 'known' || name === 'unknown') setMark(name, false);
    },
    [setMark],
  );

  const edgeText = typeStyle('swipeEdge', tokens);

  return (
    <PageActionsProvider actions={markActions} onAction={onAction}>
      {/* A card that fills its page leaves room under it for the stamp, which the page would cut. */}
      <View testID="swipe-frame" style={[styles.frame, fill && styles.filled]}>
        <GestureDetector gesture={pan}>
          <Animated.View
            testID="swipe-card"
            onLayout={({ nativeEvent }) => {
              if (nativeEvent.layout.width > 0)
                markDistance.value = nativeEvent.layout.width * MARK_SHARE;
            }}
            style={[fill && styles.fill, cardStyle]}
          >
            {children}
            {/* The wedges are the card's own, so they move and tilt with it, cut at its edges. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              style={styles.edges}
            >
              <Animated.View
                testID="swipe-edge-known"
                onLayout={({ nativeEvent }) => {
                  knownWidth.value = nativeEvent.layout.width;
                }}
                style={[styles.edge, styles.edgeKnown, knownEdgeStyle]}
              >
                {/* The wedge fills a view laid out over the label's box: an Svg sized in % by itself draws short on iOS. */}
                <View style={StyleSheet.absoluteFill}>
                  <Wedge points={wedges.swipeKnown} color={colors.ink} width="100%" height="100%" />
                </View>
                <Svg
                  width={swipeEdgeLayout.check.width}
                  height={swipeEdgeLayout.check.height}
                  viewBox="0 0 26 22"
                >
                  <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={colors.accent} />
                </Svg>
                <Text style={[edgeText, { color: colors.background }]}>{texts.edges.known}</Text>
              </Animated.View>
              <Animated.View
                testID="swipe-edge-unknown"
                onLayout={({ nativeEvent }) => {
                  unknownWidth.value = nativeEvent.layout.width;
                }}
                style={[styles.edge, styles.edgeUnknown, unknownEdgeStyle]}
              >
                {/* The board's 4-point ink inset: an ink wedge under a light one cut 4 points smaller. */}
                <View style={StyleSheet.absoluteFill}>
                  <Wedge
                    points={wedges.swipeUnknown}
                    color={colors.ink}
                    width="100%"
                    height="100%"
                  />
                </View>
                <View style={styles.inset}>
                  <Wedge
                    points={wedges.swipeUnknown}
                    color={colors.background}
                    width="100%"
                    height="100%"
                  />
                </View>
                <Text style={[edgeText, { color: colors.ink }]}>{texts.edges.unknown}</Text>
                <Svg
                  width={swipeEdgeLayout.bookmark.width}
                  height={swipeEdgeLayout.bookmark.height}
                  viewBox="0 0 24 24"
                >
                  <Path d="M6 3h12v18l-6-4.5L6 21z" fill={colors.ink} />
                </Svg>
              </Animated.View>
            </View>
            {mark !== undefined && (
              <Animated.View
                pointerEvents="none"
                testID="swipe-stamp"
                style={[
                  styles.stamp,
                  {
                    borderColor: colors.ink,
                    backgroundColor: colors.surface,
                    borderRadius: radii.chip,
                  },
                  stampStyle,
                ]}
              >
                <Text style={[typeStyle('swipeStamp', tokens), { color: colors.ink }]}>
                  {textOf(texts.stamps, mark)}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </GestureDetector>
        {/* hidden: not on board 04, owner 05.11. The «ВГОРУ — НАСТУПНЕ» chip under the card.
        {markedOn !== undefined && markedOn === turnToNext && (
          <ChipFade fades={reduceMotion}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={texts.next}
              testID="swipe-next-chip"
              hitSlop={(minTouchTarget - 32) / 2}
              onPress={turnToNext}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: colors.ink,
                  borderRadius: radii.chip,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[typeStyle('toastAction', tokens), { color: colors.background }]}>
                {texts.next}
              </Text>
            </Pressable>
          </ChipFade>
        )} */}
      </View>
    </PageActionsProvider>
  );
}

// hidden: not on board 04, owner 05.11. The «ВГОРУ — НАСТУПНЕ» chip, which faded in under Reduce Motion.
// function ChipFade({ fades, children }: { fades: boolean; children: ReactNode }) {
//   const shown = useSharedValue(fades ? 0 : 1);
//   useEffect(() => {
//     if (fades) shown.value = withTiming(1, CHIP_FADE);
//   }, [fades, shown]);
//   const style = useAnimatedStyle(() => ({ opacity: shown.value }));
//   return (
//     <Animated.View testID="swipe-next-chip-fade" style={[styles.chipFade, style]}>
//       {children}
//     </Animated.View>
//   );
// }

const styles = StyleSheet.create({
  frame: { flexShrink: 1 },
  fill: { flexGrow: 1 },
  filled: { flexGrow: 1, paddingBottom: swipeStampLayout.room },
  edges: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  edge: {
    position: 'absolute',
    top: swipeEdgeLayout.top,
    flexDirection: 'row',
    alignItems: 'center',
    gap: swipeEdgeLayout.gap,
    paddingVertical: swipeEdgeLayout.paddingVertical,
  },
  // The ink wedge at the left edge, which a swipe right uncovers.
  edgeKnown: {
    left: 0,
    paddingLeft: swipeEdgeLayout.paddingEdge,
    paddingRight: swipeEdgeLayout.paddingInner,
  },
  // The light inset wedge at the right edge, which a swipe left uncovers.
  edgeUnknown: {
    right: 0,
    paddingLeft: swipeEdgeLayout.paddingInner,
    paddingRight: swipeEdgeLayout.paddingEdge,
  },
  inset: { position: 'absolute', inset: swipeEdgeLayout.inset },
  stamp: {
    position: 'absolute',
    right: swipeStampLayout.right,
    bottom: swipeStampLayout.bottom,
    borderWidth: swipeStampLayout.border,
    paddingVertical: swipeStampLayout.paddingVertical,
    paddingHorizontal: swipeStampLayout.paddingHorizontal,
  },
  // hidden: not on board 04, owner 05.11. The «ВГОРУ — НАСТУПНЕ» chip's styles.
  // chipFade: { alignSelf: 'center' },
  // chip: {
  //   alignSelf: 'center',
  //   marginTop: space[3],
  //   minHeight: space[8],
  //   justifyContent: 'center',
  //   paddingHorizontal: space[4],
  // },
});
