'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
  type ComposedGesture,
  type PanGestureConfig,
  type TapGestureConfig,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  motion,
  scrim,
  sheetLayout,
  space,
  type Wedge as WedgePoints,
} from '../tokens';
import { InvertedTokens, SchemeTokens, useTokens } from '../providers/TokensProvider';
import { useRouteOnScreen } from '../providers/RouteProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { bezier, REDUCED_FADE } from './timing';
import { Wedge } from './Wedge';

/** The slant over the sheet's top: the left edge lower than the right. */
const SLANT: WedgePoints = [
  [0, 1],
  [1, 0],
  [1, 1],
];

/** `ReduceMotion.Never` on every timing: under Reduce Motion the sheet fades instead, and the system setting would skip the fade too. */
const never = { reduceMotion: ReduceMotion.Never };
/** The design's `slSheet`: up in 450 ms, a little past its place, then back. */
const SLIDE_IN = { duration: motion.sheet.duration, easing: bezier(motion.sheet.easing), ...never };
/** Leaving is quicker than arriving. */
const SLIDE_OUT = { duration: 220, easing: Easing.in(Easing.quad), ...never };

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

/** The colour role a sheet is drawn on. */
export type SheetTone = 'surface' | 'ink' | 'accent';

/**
 * A bottom sheet of the design over a scrim: a top edge that slants up to the
 * right, and a slide up that rises a little past its place (with Reduce Motion
 * a fade). A tap on the scrim or its top strip, a downward drag or flick on that strip, and
 * VoiceOver's escape gesture ask `onClose`; the sheet leaves when `visible`
 * turns false. Without `onClose` only its content closes it: its top takes no
 * drag, and no scrim dims the screen, which takes no taps meanwhile. The sheet
 * is drawn in its `tone`: the Theme's `surface`, its `ink` with the content in
 * the other colour scheme, or its `accent` with the content in the light one,
 * as the design draws ink on red. It belongs to the route it opened on
 * (`RouteProvider`): when another route comes on screen it asks `onClose`, and
 * without `onClose` it leaves until its route is back. The
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
  children,
  testID,
  tone = 'surface',
}: {
  visible: boolean;
  onClose?: () => void;
  onDismissed?: (() => void) | undefined;
  children: ReactNode;
  testID?: string | undefined;
  tone?: SheetTone;
}) {
  const route = useRouteOnScreen();
  /** The route the sheet opened on, while it is open. */
  const [openedOn, setOpenedOn] = useState<{ route: string | undefined }>();
  if (visible && openedOn === undefined) setOpenedOn({ route });
  if (!visible && openedOn !== undefined) setOpenedOn(undefined);
  const away = visible && openedOn !== undefined && openedOn.route !== route;
  const shown = visible && !away;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (away) onCloseRef.current?.();
  }, [away]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(shown);
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
    if (shown) {
      setMounted(true);
      flick.current = undefined;
      drag.value = 0;
      progress.value = reduceMotion
        ? withTiming(1, REDUCED_FADE)
        : withSequence(
            withTiming(1 + motion.sheet.overshoot.distance / height.value, {
              ...SLIDE_IN,
              duration: SLIDE_IN.duration * motion.sheet.overshoot.share,
            }),
            withTiming(1, {
              ...SLIDE_IN,
              duration: SLIDE_IN.duration * (1 - motion.sheet.overshoot.share),
            }),
          );
      wasVisible.current = true;
    } else {
      // Nothing to slide out unless it was open: a slide-out started on mount
      // would unmount a sheet that opens before it ends.
      if (!wasVisible.current) return;
      wasVisible.current = false;
      const velocity = flick.current;
      flick.current = undefined;
      const gone = (finished?: boolean) => {
        'worklet';
        if (finished !== true) return;
        scheduleOnRN(setMounted, false);
        scheduleOnRN(dismissed);
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
    // The shared values are stable, so only `shown` starts a slide; a change
    // of Reduce Motion runs it again towards the same end, which moves nothing.
  }, [shown, reduceMotion, drag, progress, height]);

  const closable = onClose !== undefined;
  // Stable, so the memoised configs below change only with what they draw on.
  /** Counts the drags that asked to close, so the render after each can tell whether the owner refused. */
  const [closeAsks, setCloseAsks] = useState(0);
  const closeByDrag = useCallback((velocity: number) => {
    flick.current = velocity;
    setCloseAsks((asks) => asks + 1);
    onCloseRef.current?.();
  }, []);
  // An owner that agrees closes in the same render; one that keeps the sheet
  // open leaves it where the finger left it, so it springs back in place.
  // Reads `shown` and Reduce Motion as they are, so only a new ask checks again.
  const keptOpen = useEffectEvent(() => {
    if (!shown || flick.current === undefined) return;
    const velocity = flick.current;
    flick.current = undefined;
    drag.value = reduceMotion ? 0 : withSpring(0, { ...DRAG_SPRING, velocity });
  });
  useEffect(() => {
    if (closeAsks > 0) keptOpen();
  }, [closeAsks]);
  const close = useCallback(() => {
    onCloseRef.current?.();
  }, []);

  // Only a sheet with `onClose` has the top strip that takes the drag.
  // Memoised configs, as Gesture Handler asks; each callback says it is a worklet.
  const panConfig = useMemo(
    (): PanGestureConfig => ({
      onUpdate: ({ translationY }) => {
        'worklet';
        drag.value = Math.max(translationY, 0);
      },
      onDeactivate: ({ translationY, velocityY }) => {
        'worklet';
        if (
          closable &&
          (translationY > motion.sheet.close.distance || velocityY > motion.sheet.close.velocity)
        ) {
          scheduleOnRN(closeByDrag, velocityY);
        } else if (reduceMotion) {
          // Under Reduce Motion the sheet is simply back in place.
          drag.value = 0;
        } else {
          drag.value = withSpring(0, { ...DRAG_SPRING, velocity: velocityY });
        }
      },
      testID: testID === undefined ? undefined : `${testID}-drag`,
    }),
    [closable, reduceMotion, testID, drag, closeByDrag],
  );
  const pan = usePanGesture(panConfig);
  // A tall sheet leaves the scrim little more than the corner over its slant,
  // which the strip covers: a tap there closes the sheet, as on the scrim.
  const tapConfig = useMemo(
    (): TapGestureConfig => ({
      onDeactivate: ({ canceled }) => {
        'worklet';
        if (!canceled && closable) scheduleOnRN(close);
      },
      testID: testID === undefined ? undefined : `${testID}-tap`,
    }),
    [closable, testID, close],
  );
  const tap = useTapGesture(tapConfig);
  const strip = useCompetingGestures(pan, tap);

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
      strip={strip}
      tone={tone}
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
          {panel}
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
  strip,
  tone,
  children,
}: {
  onClose: (() => void) | undefined;
  testID: string | undefined;
  onHeight: (height: number) => void;
  sheetStyle: AnimatedStyle<ViewStyle>;
  strip: ComposedGesture;
  tone: SheetTone;
  children: ReactNode;
}) {
  const { colors } = useTokens();
  const fill = colors[tone];
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
      <View style={styles.slant}>
        <Wedge points={SLANT} color={fill} width="100%" height={sheetLayout.slant} />
      </View>
      <View
        style={[styles.body, { backgroundColor: fill }]}
        testID={testID === undefined ? undefined : `${testID}-fill`}
      />
      {tone === 'ink' ? (
        <InvertedTokens>{children}</InvertedTokens>
      ) : tone === 'accent' ? (
        <SchemeTokens colorScheme="light">{children}</SchemeTokens>
      ) : (
        children
      )}
      {onClose === undefined ? null : (
        // A Modal is its own native root, so the gestures need a root of their own; a local one keeps the rest of the sheet out of the gesture system.
        <GestureHandlerRootView style={styles.dragStrip}>
          <GestureDetector gesture={strip}>
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
  sheet: {
    maxHeight: '100%',
    paddingTop: sheetLayout.slant,
    paddingHorizontal: space[5],
    gap: space[4],
  },
  // Edge to edge: an absolute child's percentage width counts without the sheet's side padding.
  slant: { position: 'absolute', top: 0, left: 0, right: 0, height: sheetLayout.slant },
  body: { position: 'absolute', top: sheetLayout.slant, left: 0, right: 0, bottom: 0 },
  // The slanted top, above the content, takes the drag and the tap.
  dragStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: sheetLayout.slant },
  fill: { flex: 1 },
});
