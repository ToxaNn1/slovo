import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useDecor } from '../decor/DecorProvider';
import { EmptyStateIllustration, OrnamentDivider } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, space, typeSize, wordCardSide } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/** The design's loading motion: the divider is stitched in square by square, 140 ms each. */
const STITCH_MS = 140;
/** The narrowest stitch, so a fine divider doesn't take ages to stitch. */
const MIN_STITCH = 14;
/** Stitches the divider waits, full, before it starts again. */
const STITCHES_HELD = 4;
/** The skeleton's pulse: 1.4 s from full to faint and back. */
const PULSE_MS = 1400;
const PULSE_FAINT = 0.45;

/**
 * Decor slot 2 being stitched: the divider fills in from the left one stitch
 * at a time over a faint print of itself, then starts again. With Reduce
 * Motion it is drawn whole and still.
 */
function StitchedDivider() {
  const { divider } = useDecor();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [stitched, setStitched] = useState(0);
  const stitch = Math.max(divider.band.width, MIN_STITCH);
  const stitches = Math.ceil(width / stitch);

  useEffect(() => {
    if (reduceMotion || stitches === 0) return;
    const timer = setInterval(() => {
      setStitched((count) => (count >= stitches + STITCHES_HELD ? 0 : count + 1));
    }, STITCH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [reduceMotion, stitches]);

  const shown = reduceMotion ? width : Math.min(stitched * stitch, width);
  return (
    <View
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      <View style={styles.print}>
        <OrnamentDivider />
      </View>
      <View style={[styles.stitched, { width: shown }]}>
        <View style={{ width }}>
          <OrnamentDivider />
        </View>
      </View>
    </View>
  );
}

/** A grey block of the skeleton card, `width` wide (a number, or a share such as `'85%'`). */
function Block({ width, height }: { width: number | `${number}%`; height: number }) {
  const { colors, radii } = useTokens();
  return (
    <View
      style={{ width, height, backgroundColor: colors.surfaceSunken, borderRadius: radii.chip }}
    />
  );
}

/**
 * The Feed's loading state while the Language Pack opens: a skeleton of the
 * Word card that pulses, the divider being stitched, and a line of text under
 * it. With Reduce Motion the skeleton holds still and the divider is whole.
 * VoiceOver reads it as one element.
 */
export function FeedLoading({
  text,
  accessibilityLabel,
}: {
  text: string;
  accessibilityLabel: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    const half = { duration: PULSE_MS / 2, reduceMotion: ReduceMotion.Never };
    pulse.value = withRepeat(withSequence(withTiming(PULSE_FAINT, half), withTiming(1, half)), -1);
    return () => {
      cancelAnimation(pulse);
    };
  }, [reduceMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      testID="feed-loading"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      {...voice}
      style={styles.loading}
    >
      <View
        style={[
          styles.skeleton,
          { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
        ]}
      >
        <Animated.View style={[styles.skeletonHeader, pulseStyle]}>
          <Block width={180} height={50} />
          <Block width={88} height={14} />
        </Animated.View>
        <StitchedDivider />
        <Animated.View style={[styles.skeletonLines, pulseStyle]}>
          <Block width="100%" height={16} />
          <Block width="84%" height={16} />
          <Block width="70%" height={16} />
        </Animated.View>
      </View>
      <Text
        {...voice}
        style={[styles.loadingText, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {text}
      </Text>
    </View>
  );
}

/** The width of the error illustration (Decor slot 4, the broken thread). */
const ERROR_ILLUSTRATION_WIDTH = 120;

/**
 * The Feed's local error state, when the Language Pack can't be opened: the
 * Edition's error illustration (a broken thread in the Ukrainian Decor), a
 * title, what went wrong and a button that tries again. Nothing here speaks
 * of the network: the Feed never needs it.
 */
export function FeedError({
  title,
  message,
  retry,
  onRetry,
  testID = 'feed-error',
}: {
  title: string;
  message: string;
  /** The label of the button that tries again. */
  retry: string;
  onRetry: () => void;
  testID?: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.error}>
      <View style={styles.illustration}>
        <EmptyStateIllustration kind="error" width={ERROR_ILLUSTRATION_WIDTH} />
      </View>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${title}. ${message}`}
        {...voice}
      >
        <Text style={[styles.errorTitle, { color: colors.ink, fontFamily: fontFamilies.word }]}>
          {title}
        </Text>
        <Text style={[styles.errorMessage, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
          {message}
        </Text>
      </View>
      <Pressable
        testID={`${testID}-retry`}
        accessibilityRole="button"
        {...voice}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.ink, borderRadius: radii.button, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text
          style={[styles.buttonText, { color: colors.background, fontFamily: fontFamilies.ui }]}
        >
          {retry}
        </Text>
      </Pressable>
    </View>
  );
}

const HINT_FADE_MS = 300;

/**
 * The first-launch swipe hint: an inverted pill with an arrow over the bottom
 * of the Feed. It fades in, or just appears with Reduce Motion. A tap hides it.
 * `onShown` is called once it is drawn, so the caller can keep that it was seen.
 */
export function SwipeHint({
  text,
  onShown,
  onDismiss,
}: {
  text: string;
  onShown: () => void;
  onDismiss: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    onShown();
  }, [onShown]);

  useEffect(() => {
    opacity.value = reduceMotion
      ? 1
      : withTiming(1, { duration: HINT_FADE_MS, reduceMotion: ReduceMotion.Never });
  }, [reduceMotion, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.hintRow, fadeStyle]}>
      <Pressable
        testID="swipe-hint"
        accessibilityRole="button"
        accessibilityLabel={text}
        {...voice}
        onPress={onDismiss}
        style={[styles.hint, { backgroundColor: colors.ink }]}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M12 19V5M6 11l6-6 6 6" stroke={colors.background} strokeWidth={2} />
        </Svg>
        <Text style={[styles.hintText, { color: colors.background, fontFamily: fontFamilies.ui }]}>
          {text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: space[6] + space[1] },
  // The Word card's padding, so the skeleton has the card's shape.
  skeleton: {
    borderWidth: 1,
    paddingTop: space[8],
    paddingHorizontal: wordCardSide,
    paddingBottom: space[8],
    gap: space[6],
  },
  skeletonHeader: { gap: space[4] },
  skeletonLines: { gap: space[4] + space[1] },
  print: { opacity: 0.18 },
  stitched: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  loadingText: { fontSize: typeSize.body, fontWeight: '500', textAlign: 'center' },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8] + space[2],
  },
  illustration: { marginBottom: space[6] },
  errorTitle: {
    fontSize: typeSize.emptyStateTitle,
    lineHeight: typeSize.emptyStateTitle * 1.2,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: space[3],
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.6,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    minHeight: 54,
    marginTop: space[8],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: typeSize.button, fontWeight: '700' },
  hintRow: { position: 'absolute', left: 0, right: 0, bottom: space[4], alignItems: 'center' },
  hint: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[5],
    borderRadius: minTouchTarget / 2,
  },
  hintText: { fontSize: typeSize.body, fontWeight: '500' },
});
