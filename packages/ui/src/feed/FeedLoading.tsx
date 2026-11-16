'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { feedLoading } from '../tokens';
import { Wedge } from '../primitives/Wedge';
import { WedgeLoader } from '../primitives/WedgeLoader';

const { card, bars, pulse } = feedLoading;

const half = {
  duration: pulse.duration / 2,
  easing: Easing.inOut(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};

/** The card's bottom: from its left corner up to the right edge. */
const SLANT = [
  [0, 0],
  [1, 0],
  [0, 1],
] as const;

/**
 * The Feed's loading state while the Language Pack opens (board XSettings
 * m5): the card's placeholder in the sunken tone, its bottom slanting up to
 * the right, with the red wedges at its middle, and three skeleton bars under
 * it, pulsing one after another. No text: VoiceOver reads it as one busy
 * element with `accessibilityLabel`. With Reduce Motion nothing pulses and
 * the wedges stand still.
 */
export function FeedLoading({ accessibilityLabel }: { accessibilityLabel: string }) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const cardBeat = useSharedValue(1);
  const firstBar = useSharedValue(1);
  const secondBar = useSharedValue(1);
  const thirdBar = useSharedValue(1);

  useEffect(() => {
    const beats = [cardBeat, firstBar, secondBar, thirdBar];
    if (reduceMotion) {
      for (const beat of beats) beat.value = 1;
      return;
    }
    beats.forEach((beat, index) => {
      beat.value = 1;
      beat.value = withDelay(
        pulse.delays[index] ?? 0,
        withRepeat(withSequence(withTiming(pulse.low, half), withTiming(1, half)), -1),
      );
    });
    return () => {
      for (const beat of beats) cancelAnimation(beat);
    };
  }, [reduceMotion, cardBeat, firstBar, secondBar, thirdBar]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: cardBeat.value }));
  const sunken = colors.surfaceSunken;

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
      <Animated.View testID="feed-loading-card" style={[styles.card, cardStyle]}>
        <View style={[styles.cardTop, { backgroundColor: sunken }]} />
        <Wedge points={SLANT} color={sunken} width="100%" height={card.height * card.slant} />
        <View style={styles.wedges}>
          <WedgeLoader testID="feed-loading-wedges" />
        </View>
      </Animated.View>
      <Bar beat={firstBar} index={0} color={sunken} />
      <Bar beat={secondBar} index={1} color={sunken} />
      <Bar beat={thirdBar} index={2} color={sunken} />
    </View>
  );
}

function Bar({
  beat,
  index,
  color,
}: {
  beat: SharedValue<number>;
  index: 0 | 1 | 2;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({ opacity: beat.value }));
  return (
    <Animated.View
      testID="feed-loading-bar"
      style={[styles.bar, bars[index], { backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  loading: { gap: feedLoading.gap },
  card: { height: card.height },
  cardTop: {
    flex: 1,
    borderTopLeftRadius: card.radius,
    borderTopRightRadius: card.radius,
  },
  wedges: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bar: { borderRadius: feedLoading.barRadius },
});
