'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../primitives/Button';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { capitalMarkRoom, motion, newLevelStamp, typeStyle } from '../tokens';
import { StampHalftone } from './StampHalftone';
import { bezier, REDUCED_FADE } from '../primitives/timing';

/** The number lands with the design's `slStamp`. */
const LAND = {
  duration: motion.stamp.duration,
  easing: bezier(motion.stamp.easing),
  reduceMotion: ReduceMotion.Never,
};
/**
 * A new Level on red, over the whole screen (board 10, p6): the small cream
 * `kicker` turned in the top corner, the giant `level` stamped under it,
 * `title` and `line` under the number, the `mascot` and a button labelled
 * `doneLabel` that closes it. Under Reduce Motion the number fades in at rest.
 */
export function NewLevelScreen({
  level,
  kicker,
  title,
  line,
  doneLabel,
  mascot,
  onClose,
  testID = 'new-level',
}: {
  level: number;
  kicker: string;
  title: string;
  line: string;
  doneLabel: string;
  mascot?: ReactNode;
  onClose: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  // Every red face carries the light Theme's ink and cream, in both Themes.
  const key = useSchemeColors('light');
  const reduceMotion = useReduceMotion();
  const landed = useSharedValue(0);
  useEffect(() => {
    landed.value = withTiming(1, reduceMotion ? REDUCED_FADE : LAND);
  }, [landed, reduceMotion]);
  const numberStyle = useAnimatedStyle(() => {
    const t = landed.value;
    if (reduceMotion)
      return { opacity: t, transform: [{ rotate: `${String(newLevelStamp.turn)}deg` }] };
    const { scale, turn } = newLevelStamp.from;
    return {
      opacity: Math.min(t * 2, 1),
      transform: [
        { scale: scale + (1 - scale) * t },
        { rotate: `${String(turn + (newLevelStamp.turn - turn) * t)}deg` },
      ],
    };
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View testID={testID} style={[styles.ground, { backgroundColor: tokens.colors.accent }]}>
        <StampHalftone id={`${testID}-halftone`} />
        <Text
          {...voice}
          numberOfLines={1}
          style={[typeStyle('newLevelKicker', tokens), styles.kicker, { color: key.background }]}
        >
          {kicker}
        </Text>
        <Animated.View style={[styles.number, numberStyle]}>
          <Text style={[typeStyle('newLevelNumber', tokens), { color: key.ink }]}>
            {String(level)}
          </Text>
        </Animated.View>
        <Text
          {...voice}
          accessibilityRole="header"
          style={[typeStyle('newLevelTitle', tokens), styles.title, { color: key.ink }]}
        >
          {title}
        </Text>
        <Text
          {...voice}
          testID={`${testID}-line`}
          style={[typeStyle('newLevelLine', tokens), styles.line, { color: key.ink }]}
        >
          {line}
        </Text>
        <View style={styles.spring} />
        {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
        <View style={styles.done}>
          <Button
            variant="onAccent"
            testID={`${testID}-done`}
            label={doneLabel}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    alignItems: 'center',
    paddingTop: newLevelStamp.padding.top,
    paddingHorizontal: newLevelStamp.padding.horizontal,
    paddingBottom: newLevelStamp.padding.bottom,
    overflow: 'hidden',
  },
  kicker: {
    position: 'absolute',
    left: newLevelStamp.kicker.left,
    top: newLevelStamp.kicker.top,
    transformOrigin: 'left center',
    transform: [{ rotate: `${String(newLevelStamp.turn)}deg` }],
  },
  number: { marginTop: newLevelStamp.numberTop },
  title: {
    marginTop: newLevelStamp.titleTop - capitalMarkRoom('newLevelTitle'),
    textAlign: 'center',
  },
  line: { marginTop: newLevelStamp.lineTop, textAlign: 'center' },
  spring: { flex: 1 },
  mascot: { alignSelf: 'flex-start', marginBottom: newLevelStamp.mascotBottom },
  done: { alignSelf: 'stretch' },
});
