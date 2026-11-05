'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { KnowledgeMark } from '@slovo/core';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PageActionsProvider, useTurnToNextPage } from '../primitives/VerticalPager';
import { useUndoToast } from '../primitives/UndoToast';
import { useEdition } from '../providers/EditionProvider';
import { useHaptics } from '../providers/HapticsProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { minTouchTarget, space, typeStyle } from '../tokens';

/** The side swipes of an Entry card, under the `swipeMarks` Feature Switch (ADR 0077). */
export interface EntrySwipe {
  /** The Knowledge Mark the card shows; none on an Entry with no mark. */
  readonly mark: KnowledgeMark | undefined;
  /** Sets the mark a swipe went to: right for Known, left for Unknown. */
  readonly onMark: (mark: KnowledgeMark) => void;
  /** Undoes the mark the last swipe set, from the undo toast. */
  readonly onUndo: () => void;
}

/** How far, in points, the card goes before a release sets the mark. */
export const MARK_DISTANCE = 90;
/** How fast, in points per second, a fling towards a side sets the mark from any distance. */
export const MARK_VELOCITY = 800;
/** Where an undone card comes back from, in points. */
const UNDO_FROM = 420;

/** The card springs back to its place on the design's curve. */
const BACK = {
  duration: 420,
  easing: Easing.bezier(0.2, 1, 0.3, 1),
  reduceMotion: ReduceMotion.Never,
};
const FADE = { duration: 200, easing: Easing.linear, reduceMotion: ReduceMotion.Never };
const STAMP_STEP = {
  duration: 150,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.Never,
};
const NUDGE_STEP = {
  duration: 275,
  easing: Easing.inOut(Easing.quad),
  reduceMotion: ReduceMotion.Never,
};

/**
 * Wraps an Entry card in its side swipes: right marks the Entry Known, left
 * Unknown. The card follows the finger and tilts, with the mark's label at
 * the edge it leaves; a release past 90 points or a fling sets the mark,
 * anything less springs back. A marked card carries its stamp, an undo toast
 * shows for 4 s, and while a next Entry waits the card nudges up once and a
 * chip points to it. A swipe to the mark the card already shows changes
 * nothing. Concealed under Self-check, the card takes no side swipe. Under
 * Reduce Motion the card stays in place and the labels and stamp only fade.
 * VoiceOver reads both marks as actions of the card, beside its page turns.
 */
export function SwipeMarks({
  swipe,
  concealed,
  correction,
  children,
}: {
  swipe: EntrySwipe;
  concealed: boolean;
  /** The card is a Correction's, whose Known stamp says the reader already says it right. */
  correction: boolean;
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
  const { mark, onMark, onUndo } = swipe;

  const offset = useSharedValue(0);
  const drag = useSharedValue(0);
  const lift = useSharedValue(0);
  const stamp = useSharedValue(mark === undefined ? 0 : 1);
  // The chip shows on the page the mark was set on, until that page stops being current.
  const [markedOn, setMarkedOn] = useState<(() => void) | undefined>(undefined);
  const latest = useRef({ mark, onMark, onUndo, turnToNext });
  latest.current = { mark, onMark, onUndo, turnToNext };

  const textOf = useCallback(
    (byMark: { known: string; unknown: string; correctionKnown: string }, to: KnowledgeMark) =>
      to === 'known' && correction ? byMark.correctionKnown : byMark[to],
    [correction],
  );

  const setMark = useCallback(
    (to: KnowledgeMark) => {
      const current = latest.current;
      if (current.mark === to) return;
      haptics.selection();
      current.onMark(to);
      stamp.value = reduceMotion
        ? withTiming(1, FADE)
        : withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, STAMP_STEP),
            withTiming(1, { ...STAMP_STEP, duration: 300 }),
          );
      if (current.turnToNext !== undefined) {
        setMarkedOn(() => current.turnToNext);
        if (!reduceMotion)
          lift.value = withDelay(
            550,
            withSequence(
              withTiming(-22, NUDGE_STEP),
              withTiming(0, NUDGE_STEP),
              withTiming(-9, NUDGE_STEP),
              withTiming(0, NUDGE_STEP),
            ),
          );
      }
      showToast({
        message: textOf(texts.toasts, to),
        undoLabel: texts.undo,
        onUndo: () => {
          if (!reduceMotion) {
            offset.value = withSequence(
              withTiming(to === 'known' ? UNDO_FROM : -UNDO_FROM, { duration: 0 }),
              withTiming(0, BACK),
            );
          }
          setMarkedOn(undefined);
          latest.current.onUndo();
        },
      });
    },
    [haptics, lift, offset, reduceMotion, showToast, stamp, textOf, texts],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!concealed)
        .activeOffsetX([-8, 8])
        .failOffsetY([-8, 8])
        .onUpdate(({ translationX }) => {
          drag.value = translationX;
          if (!reduceMotion) offset.value = translationX;
        })
        .onEnd(({ translationX, velocityX }) => {
          const to =
            translationX >= MARK_DISTANCE || velocityX >= MARK_VELOCITY
              ? 'known'
              : translationX <= -MARK_DISTANCE || velocityX <= -MARK_VELOCITY
                ? 'unknown'
                : undefined;
          if (to !== undefined) scheduleOnRN(setMark, to);
          drag.value = withTiming(0, FADE);
          offset.value = withTiming(0, BACK);
        })
        .withTestId('entry-card-side-swipe'),
    [concealed, drag, offset, reduceMotion, setMark],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { translateY: Math.abs(offset.value) * 0.04 + lift.value },
      { rotate: `${String(offset.value / 16)}deg` },
    ],
  }));
  const knownEdgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, drag.value) / MARK_DISTANCE),
  }));
  const unknownEdgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -drag.value) / MARK_DISTANCE),
  }));
  const stampStyle = useAnimatedStyle(() => {
    const progress = stamp.value;
    if (reduceMotion) return { opacity: progress, transform: [{ rotate: '-6deg' }] };
    // Lands from 1.6 through 0.94 to 1, turning from -14° to -6°.
    const scale = progress < 0.5 ? 1.6 - progress * 2 * 0.66 : 0.94 + (progress - 0.5) * 2 * 0.06;
    return {
      opacity: Math.min(1, progress * 2),
      transform: [{ scale }, { rotate: `${String(-14 + progress * 8)}deg` }],
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
      if (name === 'known' || name === 'unknown') setMark(name);
    },
    [setMark],
  );

  const edgeText = typeStyle('swipeEdge', tokens);

  return (
    <PageActionsProvider actions={markActions} onAction={onAction}>
      <View style={styles.frame}>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          testID="swipe-edge-known"
          style={[
            styles.edge,
            { backgroundColor: colors.ink, borderRadius: radii.chip },
            styles.edgeLeft,
            knownEdgeStyle,
          ]}
        >
          <Text style={[edgeText, { color: colors.background }]}>{texts.edges.known}</Text>
        </Animated.View>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          testID="swipe-edge-unknown"
          style={[
            styles.edge,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor: colors.ink,
              borderRadius: radii.chip,
            },
            styles.edgeRight,
            unknownEdgeStyle,
          ]}
        >
          <Text style={[edgeText, { color: colors.ink }]}>{texts.edges.unknown}</Text>
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View testID="swipe-card" style={cardStyle}>
            {children}
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
        {markedOn !== undefined && markedOn === turnToNext && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={texts.next}
            testID="swipe-next-chip"
            hitSlop={(minTouchTarget - 32) / 2}
            onPress={turnToNext}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: colors.ink, borderRadius: radii.chip, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[typeStyle('toastAction', tokens), { color: colors.background }]}>
              {texts.next}
            </Text>
          </Pressable>
        )}
      </View>
    </PageActionsProvider>
  );
}

const styles = StyleSheet.create({
  frame: { flexShrink: 1 },
  edge: {
    position: 'absolute',
    top: space[8],
    paddingVertical: space[2],
    paddingHorizontal: space[4],
  },
  // The ink wedge at the left edge, which a swipe right uncovers.
  edgeLeft: { left: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  // The light inset wedge at the right edge, which a swipe left uncovers.
  edgeRight: {
    right: 0,
    borderWidth: 1,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  stamp: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    borderWidth: 3,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
  },
  chip: {
    alignSelf: 'center',
    marginTop: space[3],
    minHeight: space[8],
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
});
