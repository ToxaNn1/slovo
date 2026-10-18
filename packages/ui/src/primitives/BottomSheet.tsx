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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { scrimColor, space } from '../tokens';
import { InvertedTokens, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/**
 * The sheet's slide from the design: 320 ms, `cubic-bezier(.2, .8, .2, 1)`.
 * With Reduce Motion it fades in place instead. Both run whatever the system
 * setting, which would otherwise skip the fade too.
 */
const SLIDE_IN = {
  duration: 320,
  easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  reduceMotion: ReduceMotion.Never,
};
/** Leaving is quicker than arriving. */
const SLIDE_OUT = {
  duration: 220,
  easing: Easing.in(Easing.quad),
  reduceMotion: ReduceMotion.Never,
};

/** How far, in points, a drag on the grabber must go to close the sheet. */
const CLOSE_DISTANCE = 96;
/** How fast, in points per second, a downward flick closes it whatever its length. */
const CLOSE_VELOCITY = 800;

/** The grabber, from the design. */
const GRABBER = { width: 38, height: 5 };
/** The strip the grabber sits in, which takes the drag. */
const HANDLE_HEIGHT = 32;

/**
 * A bottom sheet over a scrim: `radius.sheet` top corners, a hairline on top,
 * a 38×5 grabber, and a slide up. A tap on the scrim, a downward drag or flick
 * on the grabber, and VoiceOver's escape gesture ask `onClose`; the sheet
 * leaves when `visible` turns false. Without `onClose` only its content closes
 * it: it has no grabber, and no scrim dims the screen, which takes no taps
 * meanwhile. `inverted` draws the sheet in the other colour scheme. The
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
  testID?: string;
}) {
  const { colors, colorScheme } = useTokens();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  /** 0 while away, 1 while open. */
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(windowHeight);
  const wasVisible = useRef(false);
  // Read through a ref, so a new callback each render does not restart the slide.
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;
  const dismissed = () => {
    onDismissedRef.current?.();
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      progress.value = withTiming(1, SLIDE_IN);
      wasVisible.current = true;
    } else {
      const wasOpen = wasVisible.current;
      wasVisible.current = false;
      progress.value = withTiming(0, SLIDE_OUT, (finished) => {
        if (!finished) return;
        scheduleOnRN(setMounted, false);
        if (wasOpen) scheduleOnRN(dismissed);
      });
    }
    // The shared values are stable, so only `visible` starts a slide.
  }, [visible, drag, progress]);

  // Only a sheet with `onClose` has the grabber that takes the drag.
  const pan = Gesture.Pan()
    .onUpdate(({ translationY }) => {
      drag.value = Math.max(translationY, 0);
    })
    .onEnd(({ translationY, velocityY }) => {
      if (onClose !== undefined && (translationY > CLOSE_DISTANCE || velocityY > CLOSE_VELOCITY)) {
        scheduleOnRN(onClose);
      } else {
        drag.value = withSpring(0, { reduceMotion: ReduceMotion.Never });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (reduceMotion ? 0 : (1 - progress.value) * height.value) + drag.value },
    ],
    opacity: reduceMotion ? progress.value : 1,
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!mounted) return null;
  const scrim = onClose === undefined ? 'transparent' : scrimColor(colors.ink, colorScheme);
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
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrim }, scrimStyle]}>
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

/** The sheet itself, in the tokens in effect where it is drawn, with the grabber when it can be dragged away. */
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
  const { colors, radii } = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      onLayout={({ nativeEvent }) => {
        onHeight(nativeEvent.layout.height);
      }}
      style={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderTopLeftRadius: radii.sheet,
          borderTopRightRadius: radii.sheet,
          paddingBottom: Math.max(insets.bottom, space[4]),
        },
        onClose === undefined && styles.withoutGrabber,
        sheetStyle,
      ]}
    >
      {onClose === undefined ? null : (
        // A Modal is its own native root, so the gestures need a root of their own; a local one keeps the rest of the sheet out of the gesture system.
        <GestureHandlerRootView style={styles.handle}>
          <GestureDetector gesture={pan}>
            <View
              style={styles.handleHit}
              testID={testID === undefined ? undefined : `${testID}-grabber`}
            >
              <View style={[styles.grabber, { backgroundColor: colors.muted, opacity: 0.45 }]} />
            </View>
          </GestureDetector>
        </GestureHandlerRootView>
      )}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Over the scrim, which takes the taps beside the sheet.
  avoiding: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: { maxHeight: '100%', borderTopWidth: 1, paddingHorizontal: space[5] },
  withoutGrabber: { paddingTop: space[6] },
  handle: { height: HANDLE_HEIGHT, marginHorizontal: -space[5] },
  handleHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grabber: { ...GRABBER, borderRadius: GRABBER.height / 2 },
});
