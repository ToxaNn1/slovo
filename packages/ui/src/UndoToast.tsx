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
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from './EditionProvider';
import { minTouchTarget, space, toastElevation, toastRadius } from './tokens';
import { useTokens } from './TokensProvider';

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

const UndoToastContext = createContext<((toast: UndoToastContent) => void) | undefined>(undefined);

/**
 * Shows undo toasts at the bottom of the screen it wraps, one at a time: a
 * new toast takes the place of the one before. The toasts live here, not in
 * what opened them, so a toast stays when the card it came from leaves.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ readonly id: number; readonly content: UndoToastContent }>();
  const lastId = useRef(0);
  const show = useCallback((content: UndoToastContent) => {
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
          <UndoToast key={toast.id} id={toast.id} {...toast.content} onDismiss={dismiss} />
        )}
      </View>
    </UndoToastContext>
  );
}

/** Shows an undo toast on the screen of the nearest `UndoToastProvider`. */
export function useUndoToast(): (toast: UndoToastContent) => void {
  const show = useContext(UndoToastContext);
  if (show === undefined) throw new Error('useUndoToast needs an UndoToastProvider above it');
  return show;
}

/**
 * The undo toast from the design: radius 6, inverted colours, `elev.toast`,
 * for 4 s. With VoiceOver on, VoiceOver moves to it and reads it, and it stays
 * until the reader takes the undo or dismisses it with the escape gesture, so
 * the undo is always in reach.
 */
function UndoToast({
  id,
  message,
  undoLabel,
  onUndo,
  onDismiss,
}: UndoToastContent & { id: number; onDismiss: (id: number) => void }) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const messageRef = useRef<Text>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  function close() {
    onDismiss(id);
  }
  const timeOut = useEffectEvent(close);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then((screenReader) => {
      if (!active) return;
      if (!screenReader) {
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
        timer = setTimeout(() => {
          timeOut();
        }, TOAST_MS);
        return;
      }
      // VoiceOver skips a view that is still fading in, so the toast shows at once.
      opacity.setValue(1);
      if (messageRef.current !== null)
        AccessibilityInfo.sendAccessibilityEvent(messageRef.current, 'focus');
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [opacity]);

  return (
    <Animated.View
      testID="undo-toast"
      onAccessibilityEscape={close}
      style={[styles.toast, { opacity, backgroundColor: colors.ink }]}
    >
      <Text
        ref={messageRef}
        testID="undo-toast-message"
        {...voice}
        style={[styles.message, { color: colors.background, fontFamily: fontFamilies.ui }]}
      >
        {message}
      </Text>
      <Pressable
        testID="undo-toast-undo"
        accessibilityRole="button"
        accessibilityLabel={undoLabel}
        {...voice}
        onPress={() => {
          onUndo();
          close();
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
    </Animated.View>
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
  message: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  undo: {
    minHeight: minTouchTarget,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoLabel: { fontSize: 15, fontWeight: '700' },
});
