'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { motion, screenEnter } from '../tokens';

const screenEasing = Easing.bezier(...motion.screen.easing);
const sweepEasing = Easing.bezier(...motion.sweep.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * A screen's entrance each time it gains focus: the screen slides in while
 * its slanted left edge wipes across it from the right, under a red band
 * sweeping over it. Under Reduce Motion the screen fades in once instead.
 */
export function ScreenEnter({
  focused,
  testID,
  children,
}: {
  /** Whether the screen is the one shown; it enters each time this turns on. */
  focused: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const { colors } = useTokens();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  // 1 when the screen has entered, 0 where it starts.
  const entered = useSharedValue(0);
  const swept = useSharedValue(0);

  useEffect(() => {
    // Out of focus the screen is hidden; it waits there at the start, so no
    // frame of it shows before it enters.
    if (!focused) {
      entered.value = 0;
      swept.value = 0;
      return;
    }
    // The hook already reads the system's Reduce Motion and «Менше руху».
    if (reduceMotion) {
      entered.value = withTiming(1, {
        duration: motion.reduceMotion.duration,
        easing: fadeEasing,
        reduceMotion: ReduceMotion.Never,
      });
      swept.value = 1;
      return;
    }
    entered.value = withTiming(1, {
      duration: motion.screen.duration,
      easing: screenEasing,
      reduceMotion: ReduceMotion.Never,
    });
    swept.value = withTiming(1, {
      duration: motion.sweep.duration,
      easing: sweepEasing,
      reduceMotion: ReduceMotion.Never,
    });
  }, [focused, reduceMotion, entered, swept]);

  const contentStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: entered.value, transform: [{ translateX: 0 }] }
      : { opacity: 1, transform: [{ translateX: (1 - entered.value) * screenEnter.shift }] },
  );

  // The cover left of the slanted edge: it starts over the whole screen and
  // leaves by `travel` widths to the left.
  const travel = screenEnter.travel * width;
  const slant = screenEnter.slant * width;
  const coverWidth = travel + width + slant;
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -entered.value * travel }],
  }));

  const bandWidth = screenEnter.band.width * width;
  const { from, to, skewX } = screenEnter.band;
  const bandStyle = useAnimatedStyle(() => ({
    // Slanted, the band at rest would still reach over an edge.
    opacity: swept.value > 0 && swept.value < 1 ? 1 : 0,
    transform: [{ translateX: (from + (to - from) * swept.value) * bandWidth }, { skewX }],
  }));

  return (
    <View style={styles.screen} testID={testID}>
      <Animated.View
        testID={testID === undefined ? undefined : `${testID}-content`}
        style={[styles.screen, contentStyle]}
      >{children}</Animated.View>
      {!reduceMotion && (
        <>
          <Animated.View
            testID={testID === undefined ? undefined : `${testID}-wipe`}
            pointerEvents="none"
            style={[styles.cover, { left: -travel, width: coverWidth }, coverStyle]}
          >
            <Svg width={coverWidth} height="100%" viewBox={`0 0 ${String(coverWidth)} 1`} preserveAspectRatio="none">
              <Polygon
                points={`0,0 ${String(coverWidth)},0 ${String(coverWidth - slant)},1 0,1`}
                fill={colors.background}
              />
            </Svg>
          </Animated.View>
          <Animated.View
            testID={testID === undefined ? undefined : `${testID}-sweep`}
            pointerEvents="none"
            style={[styles.band, { width: bandWidth, backgroundColor: colors.accent }, bandStyle]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  cover: { position: 'absolute', top: 0, bottom: 0 },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
