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
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import {
  lineHeight,
  minTouchTarget,
  space,
  toastElevation,
  toastRadius,
  typeSize,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How long the toast stays, from the design. */
const TOAST_MS = 4000;

/** The toast's fade in. */
const FADE_MS = 200;

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
}

/** What one toast says: with an undo, or a message alone. */
export type ToastContent = UndoToastContent | MessageToastContent;

const UndoToastContext = createContext<((toast: ToastContent) => void) | undefined>(undefined);

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
  return (
    <UndoToastContext value={show}>
      <View style={styles.fill}>
        {children}
        {toast !== undefined && (
          <UndoToast key={toast.id} id={toast.id} content={toast.content} onDismiss={dismiss} />
        )}
      </View>
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
 * The toast from the design: radius 6, inverted colours, `elev.toast`, for
 * 4 s. With VoiceOver on, VoiceOver moves to it and reads it, and a toast with
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
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const messageRef = useRef<Text>(null);
  const opacity = useSharedValue(0);
  function close() {
    onDismiss(id);
  }
  const timeOut = useEffectEvent(close);
  const hasUndo = 'onUndo' in content;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then((screenReader) => {
      if (!active) return;
      if (!screenReader || !hasUndo) {
        timer = setTimeout(() => {
          timeOut();
        }, TOAST_MS);
      }
      if (!screenReader) {
        opacity.value = withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.Never });
        return;
      }
      // VoiceOver skips a view that is still fading in, so the toast shows at once.
      opacity.value = 1;
      if (messageRef.current !== null)
        AccessibilityInfo.sendAccessibilityEvent(messageRef.current, 'focus');
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [opacity, hasUndo]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID="undo-toast"
      onAccessibilityEscape={close}
      style={[styles.toast, { backgroundColor: colors.ink }, fadeStyle]}
    >
      <Text
        ref={messageRef}
        testID="undo-toast-message"
        {...voice}
        style={[styles.message, { color: colors.background, fontFamily: fontFamilies.ui }]}
      >
        {content.message}
      </Text>
      {'onUndo' in content && <UndoButton {...content} onPress={close} />}
    </Animated.View>
  );
}

/** The toast's undo button: undoes what just happened, then closes the toast. */
function UndoButton({ undoLabel, onUndo, onPress }: UndoToastContent & { onPress: () => void }) {
  const { colors, fontFamilies, radii } = useTokens();
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
      style={({ pressed }) => [
        styles.undo,
        {
          backgroundColor: colors.background,
          borderRadius: radii.button,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={UNDO_MAX_FONT_SCALE}
        style={[styles.undoLabel, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {undoLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toast: {
    position: 'absolute',
    borderRadius: toastRadius,
    left: space[4],
    right: space[4],
    bottom: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingLeft: space[5],
    paddingRight: space[3],
    paddingVertical: space[3],
    ...toastElevation,
  },
  message: { flex: 1, fontSize: typeSize.body, lineHeight: lineHeight.toast, fontWeight: '500' },
  undo: {
    minHeight: minTouchTarget,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoLabel: { fontSize: typeSize.body, fontWeight: '700' },
});
