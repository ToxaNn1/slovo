'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
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

/** The number lands with the design's `slStamp`. */
const LAND = {
  duration: motion.stamp.duration,
  easing: Easing.bezier(...motion.stamp.easing),
  reduceMotion: ReduceMotion.Never,
};
/** Under Reduce Motion the number fades in place. */
const FADE = {
  duration: motion.reduceMotion.duration,
  easing: Easing.bezier(...motion.reduceMotion.easing),
  reduceMotion: ReduceMotion.Never,
};

/**
 * A new Level on red, over the whole screen (p6): the giant `kicker` with the
 * `level` stamped into it, `title` under it, the `mascot` and a button
 * labelled `doneLabel` that closes it. Under Reduce Motion the number fades
 * in at rest.
 */
export function NewLevelScreen({
  level,
  kicker,
  title,
  doneLabel,
  mascot,
  onClose,
  testID = 'new-level',
}: {
  level: number;
  kicker: string;
  title: string;
  doneLabel: string;
  mascot?: ReactNode;
  onClose: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  // Every red face carries the ink of the light Theme, in both Themes.
  const keyInk = useSchemeColors('light').ink;
  const reduceMotion = useReduceMotion();
  const landed = useSharedValue(0);
  useEffect(() => {
    landed.value = withTiming(1, reduceMotion ? FADE : LAND);
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
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[typeStyle('shout', tokens), styles.kicker, { color: keyInk }]}
        >
          {kicker}
        </Text>
        <Animated.View style={[styles.number, { borderColor: keyInk }, numberStyle]}>
          <Text style={[typeStyle('stepShout', tokens), { color: keyInk }]}>{String(level)}</Text>
        </Animated.View>
        <Text
          {...voice}
          accessibilityRole="header"
          style={[typeStyle('screenTitle', tokens), styles.title, { color: keyInk }]}
        >
          {title}
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
  kicker: { alignSelf: 'stretch', textAlign: 'center' },
  number: {
    marginTop: newLevelStamp.numberTop,
    borderWidth: newLevelStamp.frame,
    paddingVertical: newLevelStamp.framePadding.vertical,
    paddingHorizontal: newLevelStamp.framePadding.horizontal,
  },
  title: {
    marginTop: newLevelStamp.titleTop - capitalMarkRoom('screenTitle'),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  spring: { flex: 1 },
  mascot: { alignSelf: 'flex-start' },
  done: { alignSelf: 'stretch' },
});
