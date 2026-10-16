import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DecorBackground } from '../decor/DecorSlots';
import { useDecor } from '../decor/DecorProvider';
import { useEdition } from '../providers/EditionProvider';
import { DecorView, MotifImage, MotifPattern } from '../decor/Motif';
import { space } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

export interface SplashOverlayProps {
  /** The app's name as a wordmark. */
  wordmark: string;
  /** The Edition's tagline under the wordmark. */
  tagline: string;
  /** The width of the native splash image, so the mark lands right on top of it. */
  markWidth: number;
  /** False fades the overlay out, or hides it at once with Reduce Motion. */
  visible: boolean;
  /** Called once the overlay is on screen, when the native splash can go. */
  onShown?: () => void;
  /** Called once the overlay has faded out. */
  onHidden?: () => void;
}

const FADE_MS = 300;
/** The splash band's distance from the bottom of the screen. */
const BAND_BOTTOM = 64;
const WORDMARK_SIZE = 44;
const TAGLINE_SIZE = 14;
/** The space between the mark, the wordmark and the tagline. */
const GAP = 28;

/**
 * Decor slot 7 as the app draws it: it takes over from the native splash,
 * which shows only the mark, and adds the background, the wordmark, the
 * tagline and the band. The mark stays exactly where the native splash put
 * it, in the middle of the screen. An Edition without splash Decor has
 * nothing to add to the native splash, so this draws nothing and reports
 * itself shown and hidden at once.
 */
export function SplashOverlay({
  wordmark,
  tagline,
  markWidth,
  visible,
  onShown,
  onHidden,
}: SplashOverlayProps) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const { splash } = useDecor();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  const shown = useRef(false);
  const hidden = useRef(false);

  useEffect(() => {
    if (splash !== undefined || shown.current) return;
    shown.current = true;
    onShown?.();
    onHidden?.();
  }, [splash, onShown, onHidden]);

  useEffect(() => {
    if (visible || splash === undefined || hidden.current) return;
    hidden.current = true;
    if (reduceMotion) {
      opacity.value = 0;
      onHidden?.();
      return;
    }
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, reduceMotion: ReduceMotion.Never },
      (finished) => {
        if (finished && onHidden !== undefined) scheduleOnRN(onHidden);
      },
    );
  }, [visible, splash, reduceMotion, opacity, onHidden]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (splash === undefined) return null;

  const markHeight = (markWidth * splash.mark.height) / splash.mark.width;

  const words = (
    <View style={styles.words}>
      <Text
        {...voice}
        style={[styles.wordmark, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {wordmark}
      </Text>
      <Text
        {...voice}
        style={[styles.tagline, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {tagline}
      </Text>
    </View>
  );

  return (
    <Animated.View
      testID="splash"
      pointerEvents={visible ? 'auto' : 'none'}
      onLayout={() => {
        if (shown.current) return;
        shown.current = true;
        onShown?.();
      }}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, fadeStyle]}
    >
      <DecorBackground />
      <DecorView style={styles.centre}>
        <MotifImage motif={splash.mark} width={markWidth} />
      </DecorView>
      <View style={[styles.below, { marginTop: markHeight / 2 + GAP }]}>{words}</View>
      {splash.band !== undefined && (
        <DecorView style={[styles.band, { height: splash.band.height }]}>
          <MotifPattern motif={splash.band} />
        </DecorView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centre: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  below: { position: 'absolute', top: '50%', left: space[6], right: space[6] },
  words: { alignItems: 'center', gap: GAP },
  wordmark: {
    fontSize: WORDMARK_SIZE,
    fontWeight: '500',
    letterSpacing: WORDMARK_SIZE * 0.32,
    // Letter spacing trails the last letter too; this keeps the word centred.
    paddingLeft: WORDMARK_SIZE * 0.32,
  },
  tagline: { fontSize: TAGLINE_SIZE, fontWeight: '500', textAlign: 'center' },
  band: { position: 'absolute', left: 0, right: 0, bottom: BAND_BOTTOM },
});
