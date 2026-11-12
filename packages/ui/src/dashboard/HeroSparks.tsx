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
  withTiming,
} from 'react-native-reanimated';

import { useDecor } from '../decor/DecorProvider';
import { Wedge } from '../primitives/Wedge';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { useSchemeColors } from '../providers/TokensProvider';
import { dashboard, wedges } from '../tokens';

const { mascot, sparks } = dashboard.hero;
const SPARKS = Array.from({ length: sparks.count }, (_, index) => index);

/**
 * The sparks the Mascot throws from its megaphone in the Dashboard's hero
 * (ADR 0109), as the board's `slLeaf`: diamonds of the key ink and the cream,
 * each flying off to the right and down, turning, and again, endlessly. They
 * are not Decor and do not change with the date. Without the Decor's Mascot
 * figure there is no megaphone to throw them from, so there are none; under
 * Reduce Motion, and until the system has said it is off, there are none
 * either. VoiceOver skips them.
 */
export function HeroSparks() {
  const { mascot } = useDecor();
  const reduceMotion = useReduceMotionKnown();
  if (mascot === undefined || reduceMotion !== false) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {SPARKS.map((index) => (
        <Spark key={index} index={index} />
      ))}
    </View>
  );
}

function Spark({ index }: { index: number }) {
  const { ink, background: cream } = useSchemeColors('light');
  // 0 at the megaphone, 1 at the end of the flight.
  const flight = useSharedValue(0);
  useEffect(() => {
    // The first flight waits its turn once, as the board's `animation-delay`.
    flight.value = withDelay(
      index * sparks.delayStep,
      withRepeat(
        withTiming(1, {
          duration: sparks.duration + index * sparks.durationStep,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
      ),
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(flight);
    };
  }, [flight, index]);
  const x = sparks.travel.x + index * sparks.travel.xStep;
  const y = sparks.travel.y + index * sparks.travel.yStep;
  const fly = useAnimatedStyle(() => {
    const at = flight.value;
    return {
      opacity: at < sparks.showsBy ? at / sparks.showsBy : (1 - at) / (1 - sparks.showsBy),
      transform: [
        { translateX: at * x },
        { translateY: at * y },
        { rotate: `${String(at * sparks.turn)}deg` },
      ],
    };
  });
  return (
    <Animated.View testID="dashboard-hero-spark" style={[styles.spark, fly]}>
      <Wedge
        points={wedges.spark}
        color={index % 2 === 0 ? ink : cream}
        width={sparks.width}
        height={sparks.height}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spark: {
    position: 'absolute',
    left: mascot.left + sparks.from.x,
    top: mascot.top + sparks.from.y,
    opacity: 0,
  },
});
