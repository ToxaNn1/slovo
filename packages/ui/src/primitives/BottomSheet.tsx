'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, scrim, space, type Easing as Easing4, type Wedge as WedgePoints } from '../tokens';
import { InvertedTokens, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { Wedge } from './Wedge';

/** The slant over the sheet's top: the left edge lower than the right. */
const SLANT: WedgePoints = [
  [0, 1],
  [1, 0],
  [1, 1],
];

/** `ReduceMotion.Never` on every timing: under Reduce Motion the sheet fades instead, and the system setting would skip the fade too. */
const never = { reduceMotion: ReduceMotion.Never };
const bezier = ([x1, y1, x2, y2]: Easing4) => Easing.bezier(x1, y1, x2, y2);
/** The design's `slSheet`: up in 450 ms, a little past its place, then back. */
const SLIDE_IN = { duration: motion.sheet.duration, easing: bezier(motion.sheet.easing), ...never };
/** Under Reduce Motion the sheet fades in place, the design's `slRm`. */
const FADE = {
  duration: motion.reduceMotion.duration,
  easing: bezier(motion.reduceMotion.easing),
  ...never,
};
/** Leaving is quicker than arriving. */
const SLIDE_OUT = { duration: 220, easing: Easing.in(Easing.quad), ...never };
/** How far past its place, in points, the sheet rises before it settles. */
const OVERSHOOT = 10;
/** The share of the slide spent rising past its place, from `slSheet`. */
const RISE_SHARE = 0.72;

/**
 * What follows a drag: a critically damped spring that settles in about
 * 300 ms, so the sheet neither bounces nor stops dead (ADR 0055). It takes
 * the release velocity.
 */
const DRAG_SPRING = {
  dampingRatio: 1,
  duration: 300,
  overshootClamping: true,
  reduceMotion: ReduceMotion.Never,
};

/** How far, in points, a drag on its top must go to close the sheet. */
const CLOSE_DISTANCE = 96;
/** How fast, in points per second, a downward flick closes it whatever its length. */
const CLOSE_VELOCITY = 800;

/** How far down the top edge slants, from the right edge to the left. */
export const SHEET_SLANT = 30;

/**
 * A bottom sheet of the design over a scrim: a top edge that slants up to the
 * right, and a slide up that rises a little past its place (with Reduce Motion
 * a fade). A tap on the scrim, a downward drag or flick on its top strip, and
 * VoiceOver's escape gesture ask `onClose`; the sheet leaves when `visible`
 * turns false. Without `onClose` only its content closes it: its top takes no
 * drag, and no scrim dims the screen, which takes no taps meanwhile. `inverted` draws the sheet in the other colour scheme. The
 * `onDismissed` runs once the sheet has slid away, for what must wait until no
 * modal is on screen (another modal asked for earlier is not presented). The
 * content is mounted only while the sheet is open, so its state starts fresh
 * each time. It rises above the keyboard and grows no taller than the screen
 * allows, so a long content should scroll.
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  inverted = false,
  children,
  testID,
}: {
  visible: boolean;
  onClose?: () => void;
  onDismissed?: (() => void) | undefined;
  inverted?: boolean;
  children: ReactNode;
  testID?: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  /** 0 while away, 1 while open. */
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(windowHeight);
  const wasVisible = useRef(false);
  /** The velocity a drag that closed the sheet let go at, until the sheet leaves. */
  const flick = useRef<number | undefined>(undefined);
  // Read through a ref, so a new callback each render does not restart the slide.
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;
  const dismissed = () => {
    onDismissedRef.current?.();
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      flick.current = undefined;
      drag.value = 0;
      progress.value = reduceMotion
        ? withTiming(1, FADE)
        : withSequence(
            withTiming(1 + OVERSHOOT / height.value, {
              ...SLIDE_IN,
              duration: SLIDE_IN.duration * RISE_SHARE,
            }),
            withTiming(1, { ...SLIDE_IN, duration: SLIDE_IN.duration * (1 - RISE_SHARE) }),
          );
      wasVisible.current = true;
    } else {
      const wasOpen = wasVisible.current;
      wasVisible.current = false;
      const velocity = flick.current;
      flick.current = undefined;
      const gone = (finished?: boolean) => {
        'worklet';
        if (finished !== true) return;
        scheduleOnRN(setMounted, false);
        if (wasOpen) scheduleOnRN(dismissed);
      };
      // A drag that closed it carries on down from where the finger left it,
      // and leaves it away, so the next open slides up again.
      if (velocity !== undefined && !reduceMotion) {
        drag.value = withSpring(height.value, { ...DRAG_SPRING, velocity }, (finished) => {
          'worklet';
          if (finished === true) progress.value = 0;
          gone(finished);
        });
      } else {
        progress.value = withTiming(0, SLIDE_OUT, gone);
      }
    }
    // The shared values are stable, so only `visible` starts a slide; a change
    // of Reduce Motion runs it again towards the same end, which moves nothing.
  }, [visible, reduceMotion, drag, progress, height]);

  const closeByDrag = (velocity: number) => {
    flick.current = velocity;
    onClose?.();
  };

  // Only a sheet with `onClose` has the top strip that takes the drag.
  const pan = Gesture.Pan()
    .onUpdate(({ translationY }) => {
      drag.value = Math.max(translationY, 0);
    })
    .onEnd(({ translationY, velocityY }) => {
      if (onClose !== undefined && (translationY > CLOSE_DISTANCE || velocityY > CLOSE_VELOCITY)) {
        scheduleOnRN(closeByDrag, velocityY);
      } else if (reduceMotion) {
        // Under Reduce Motion the sheet is simply back in place.
        drag.value = 0;
      } else {
        drag.value = withSpring(0, { ...DRAG_SPRING, velocity: velocityY });
      }
    });
  if (testID !== undefined) pan.withTestId(`${testID}-drag`);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (reduceMotion ? 0 : (1 - progress.value) * height.value) + drag.value },
    ],
    opacity: reduceMotion ? Math.min(progress.value, 1) : 1,
  }));
  // The scrim lightens as the sheet goes down, so it fades with a drag that closes it too.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1) * (1 - Math.min(drag.value / height.value, 1)),
  }));

  if (!mounted) return null;
  const panel = (
    <SheetPanel
      onClose={onClose}
      testID={testID}
      onHeight={(measured) => {
        height.value = measured;
      }}
      sheetStyle={sheetStyle}
      pan={pan}
    >
      {children}
    </SheetPanel>
  );
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={onClose ?? (() => undefined)}
      supportedOrientations={['portrait']}
    >
      <View style={styles.root} testID={testID}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: onClose === undefined ? 'transparent' : scrim },
            scrimStyle,
          ]}
        >
          {/* The scrim is no control for VoiceOver: the sheet closes with «Готово». */}
          <Pressable
            accessible={false}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
            testID={testID === undefined ? undefined : `${testID}-scrim`}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.avoiding, { paddingTop: insets.top + space[2] }]}
        >
          {inverted ? <InvertedTokens>{panel}</InvertedTokens> : panel}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** The sheet itself, in the tokens in effect where it is drawn, with the strip that drags it away when it can be. */
function SheetPanel({
  onClose,
  testID,
  onHeight,
  sheetStyle,
  pan,
  children,
}: {
  onClose: (() => void) | undefined;
  testID: string | undefined;
  onHeight: (height: number) => void;
  sheetStyle: ReturnType<typeof useAnimatedStyle>;
  pan: ReturnType<typeof Gesture.Pan>;
  children: ReactNode;
}) {
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      testID={testID === undefined ? undefined : `${testID}-panel`}
      onLayout={({ nativeEvent }) => {
        onHeight(nativeEvent.layout.height);
      }}
      style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[8]) }, sheetStyle]}
    >
      <Wedge
        points={SLANT}
        color={colors.surface}
        width="100%"
        height={SHEET_SLANT}
        style={styles.slant}
      />
      <View style={[styles.body, { backgroundColor: colors.surface }]} />
      {children}
      {onClose === undefined ? null : (
        // A Modal is its own native root, so the gestures need a root of their own; a local one keeps the rest of the sheet out of the gesture system.
        <GestureHandlerRootView style={styles.dragStrip}>
          <GestureDetector gesture={pan}>
            <View
              style={styles.fill}
              testID={testID === undefined ? undefined : `${testID}-drag-strip`}
            />
          </GestureDetector>
        </GestureHandlerRootView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Over the scrim, which takes the taps beside the sheet.
  avoiding: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: { maxHeight: '100%', paddingTop: SHEET_SLANT, paddingHorizontal: space[5], gap: space[4] },
  slant: { position: 'absolute', top: 0, left: 0 },
  body: { position: 'absolute', top: SHEET_SLANT, left: 0, right: 0, bottom: 0 },
  // The slanted top, above the content, takes the drag.
  dragStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: SHEET_SLANT },
  fill: { flex: 1 },
});
