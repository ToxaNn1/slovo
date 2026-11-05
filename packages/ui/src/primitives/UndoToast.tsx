'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, motion, pressedFade, space, typeStyle, wedges } from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { Wedge } from './Wedge';

/** How long the toast stays, from the design. */
const TOAST_MS = 4000;

/** How long a brief message toast stays, such as one after an item of an Entry's «⋯» sheet (XSwipe). */
const BRIEF_TOAST_MS = 2200;

/** The design's `slToast`: in from the left, straightening as it comes. */
const SLIDE_IN = {
  duration: motion.toast.duration,
  easing: Easing.bezier(...motion.toast.easing),
  reduceMotion: ReduceMotion.Never,
};
/** Under Reduce Motion the toast fades in place, the design's `slRm`. */
const FADE_IN = {
  duration: motion.reduceMotion.duration,
  easing: Easing.bezier(...motion.reduceMotion.easing),
  reduceMotion: ReduceMotion.Never,
};
/** Where the toast starts, in widths of the window, and how far it leans. */
const START = { across: -1.2, lean: -12 };
/** The share of its width the toast's right edge slants in by at the bottom. */
const TAIL = '4%';
/** The toast's red mark. */
const MARK = { width: 12, height: 22 };
/** The toast's undo button, from the design; its tap area is taller. */
const UNDO_HEIGHT = 38;

/** The message stops growing here, so the toast stays whole over what it covers. */
const MESSAGE_MAX_FONT_SCALE = 1.3;
/** The undo button's label stops growing here, so it never breaks a word. */
const UNDO_MAX_FONT_SCALE = 1.3;

/** What one undo toast says and what its undo button does. */
export interface UndoToastContent {
  /** What just happened, in the Edition's language. */
  readonly message: string;
  /** The undo button's label, in the Edition's language. */
  readonly undoLabel: string;
  /** Undoes what just happened. */
  readonly onUndo: () => void;
}

/** A toast that only says something, in the Edition's language, such as the thanks for a Mistake Report. */
export interface MessageToastContent {
  readonly message: string;
  /** The toast stays 2.2 s instead of 4 s. */
  readonly brief?: true;
}

/** What one toast says: with an undo, or a message alone. */
export type ToastContent = UndoToastContent | MessageToastContent;

const UndoToastContext = createContext<((toast: ToastContent) => void) | undefined>(undefined);
const CloseUndoToastContext = createContext<(() => void) | undefined>(undefined);

/**
 * Shows toasts at the bottom of the screen it wraps, one at a time: a new
 * toast takes the place of the one before. The toasts live here, not in what
 * opened them, so a toast stays when the card it came from leaves.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ readonly id: number; readonly content: ToastContent }>();
  const lastId = useRef(0);
  const show = useCallback((content: ToastContent) => {
    lastId.current += 1;
    setToast({ id: lastId.current, content });
  }, []);
  const dismiss = useCallback((id: number) => {
    setToast((shown) => (shown?.id === id ? undefined : shown));
  }, []);
  const close = useCallback(() => {
    setToast(undefined);
  }, []);
  return (
    <UndoToastContext value={show}>
      <CloseUndoToastContext value={close}>
        <View style={styles.fill}>
          {children}
          {toast !== undefined && (
            <UndoToast key={toast.id} id={toast.id} content={toast.content} onDismiss={dismiss} />
          )}
        </View>
      </CloseUndoToastContext>
    </UndoToastContext>
  );
}

/** Shows a toast, with an undo or without, on the screen of the nearest `UndoToastProvider`. */
export function useUndoToast(): (toast: ToastContent) => void {
  const show = useContext(UndoToastContext);
  if (show === undefined) throw new Error('useUndoToast needs an UndoToastProvider above it');
  return show;
}

/**
 * Closes the toast shown on the screen of the nearest `UndoToastProvider`, if
 * any, such as when the reader swipes on to the next Entry; nothing outside one.
 */
export function useCloseUndoToast(): () => void {
  return useContext(CloseUndoToastContext) ?? noClose;
}

function noClose() {
  // No toast to close outside an UndoToastProvider.
}

/**
 * The ink wedge toast from the design, for 4 s: a red mark, the message in
 * the background colour on the ink, the left corners round and the right edge
 * slanting in. It comes in from the left, straightening as it comes; with
 * Reduce Motion it fades in place. With VoiceOver on, VoiceOver moves to it and reads it, and a toast with
 * an undo stays until the reader takes the undo or dismisses it with the
 * escape gesture, so the undo is always in reach; one without leaves after 4 s.
 */
function UndoToast({
  id,
  content,
  onDismiss,
}: {
  id: number;
  content: ToastContent;
  onDismiss: (id: number) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Each toast mounts afresh, so it waits for the system's answer before it comes in.
  const reduceMotionKnown = useReduceMotionKnown();
  const reduceMotion = reduceMotionKnown === true;
  const ready = reduceMotionKnown !== undefined;
  const messageRef = useRef<Text>(null);
  /** 0 before it shows, 1 once it is in place. */
  const shown = useSharedValue(0);
  function close() {
    onDismiss(id);
  }
  const timeOut = useEffectEvent(close);
  // Read when the toast comes in; a later change of Reduce Motion moves nothing.
  const comeIn = useEffectEvent(() => {
    shown.value = withTiming(1, reduceMotion ? FADE_IN : SLIDE_IN);
  });
  const hasUndo = 'onUndo' in content;
  const lasts = 'brief' in content ? BRIEF_TOAST_MS : TOAST_MS;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then((screenReader) => {
      if (!active) return;
      if (!screenReader || !hasUndo) {
        timer = setTimeout(() => {
          timeOut();
        }, lasts);
      }
      if (!screenReader) {
        comeIn();
        return;
      }
      // VoiceOver skips a view that is still coming in, so the toast shows at once.
      shown.value = 1;
      if (messageRef.current !== null)
        AccessibilityInfo.sendAccessibilityEvent(messageRef.current, 'focus');
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ready, shown, hasUndo, lasts]);

  const inStyle = useAnimatedStyle(() => {
    // Under Reduce Motion it fades in place; otherwise it slides, fully opaque.
    const away = reduceMotion ? 0 : 1 - shown.value;
    return {
      opacity: reduceMotion ? shown.value : 1,
      transform: [
        { translateX: away * START.across * windowWidth },
        { skewX: `${String(away * START.lean)}deg` },
      ],
    };
  });

  return (
    <Animated.View
      testID="undo-toast"
      onAccessibilityEscape={close}
      style={[styles.place, inStyle]}
    >
      <ToastFace message={content.message} messageRef={messageRef}>
        {'onUndo' in content && <UndoButton {...content} onPress={close} />}
      </ToastFace>
    </Animated.View>
  );
}

/**
 * The look of a toast, wherever it is placed: the ink with its left corners
 * round and its right edge slanting in, a red mark, the message in the
 * background colour, and what follows it, such as an undo button.
 */
export function ToastFace({
  message,
  messageRef,
  children,
}: {
  message: string;
  messageRef?: Ref<Text> | undefined;
  children?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const round = radii.chip + space[1];
  return (
    <View style={styles.face}>
      <View
        style={[
          styles.body,
          {
            backgroundColor: colors.ink,
            borderTopLeftRadius: round,
            borderBottomLeftRadius: round,
          },
        ]}
      />
      <Wedge
        points={TAIL_SHAPE}
        color={colors.ink}
        width={TAIL}
        height="100%"
        style={styles.tail}
      />
      <Wedge points={wedges.band} color={colors.accent} {...MARK} />
      <Text
        ref={messageRef}
        testID="undo-toast-message"
        {...voice}
        maxFontSizeMultiplier={MESSAGE_MAX_FONT_SCALE}
        style={[styles.message, typeStyle('toast', tokens), { color: colors.background }]}
      >
        {message}
      </Text>
      {children}
    </View>
  );
}

/** The toast's undo button: undoes what just happened, then closes the toast. */
function UndoButton({ undoLabel, onUndo, onPress }: UndoToastContent & { onPress: () => void }) {
  const tokens = useTokens();
  const key = useSchemeColors('light');
  const { voice } = useEdition();
  return (
    <Pressable
      testID="undo-toast-undo"
      accessibilityRole="button"
      accessibilityLabel={undoLabel}
      {...voice}
      onPress={() => {
        onUndo();
        onPress();
      }}
      hitSlop={(minTouchTarget - UNDO_HEIGHT) / 2}
      style={({ pressed }) => [
        styles.undo,
        {
          backgroundColor: tokens.colors.accent,
          borderRadius: tokens.radii.chip,
          opacity: pressed ? pressedFade : 1,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={UNDO_MAX_FONT_SCALE}
        style={[typeStyle('toastAction', tokens), { color: key.ink }]}
      >
        {undoLabel}
      </Text>
    </Pressable>
  );
}

/** The ink's right edge: from the top right corner in to the bottom. */
const TAIL_SHAPE = [
  [0, 0],
  [1, 0],
  [0, 1],
] as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  place: {
    position: 'absolute',
    left: space[3] + 2,
    right: space[3] + 2,
    bottom: space[8] + space[2],
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingLeft: space[3] + 2,
    paddingRight: space[5] + 2,
    paddingVertical: space[3] + 2,
  },
  body: { position: 'absolute', top: 0, bottom: 0, left: 0, right: TAIL },
  tail: { position: 'absolute', top: 0, right: 0 },
  message: { flex: 1 },
  undo: {
    height: UNDO_HEIGHT,
    paddingLeft: space[3],
    paddingRight: space[4] + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
