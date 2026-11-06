'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { BadgeCondition } from '@slovo/contracts';
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
import { badgeStamp, capitalMarkRoom, motion, typeStyle } from '../tokens';
import { BadgeMark } from './BadgeMark';
import { StampHalftone } from './StampHalftone';

/** The stamp lands with the design's `slStamp`. */
const LAND = {
  duration: motion.stamp.duration,
  easing: Easing.bezier(...motion.stamp.easing),
  reduceMotion: ReduceMotion.Never,
};
/** Under Reduce Motion the stamp fades in place. */
const FADE = {
  duration: motion.reduceMotion.duration,
  easing: Easing.bezier(...motion.reduceMotion.easing),
  reduceMotion: ReduceMotion.Never,
};

/**
 * An earned Badge stamped on red, over the whole screen: its mark lands big
 * and turned, then `title`, the Badge's `name`, the `mascot` and a button
 * labelled `takeLabel` that closes it. Under Reduce Motion the mark fades in
 * at rest.
 */
export function BadgeStamp({
  condition,
  symbol,
  name,
  title,
  takeLabel,
  mascot,
  isNew = false,
  onClose,
  testID = 'badge-stamp',
}: {
  condition: BadgeCondition;
  symbol: string;
  name: string;
  title: string;
  takeLabel: string;
  mascot?: ReactNode;
  /** The Badge is opened for the first time: its mark carries the cream «НОВА» tag. */
  isNew?: boolean;
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
  const markStyle = useAnimatedStyle(() => {
    const t = landed.value;
    if (reduceMotion)
      return { opacity: t, transform: [{ rotate: `${String(badgeStamp.turn)}deg` }] };
    const { scale, turn } = badgeStamp.from;
    return {
      opacity: Math.min(t * 2, 1),
      transform: [
        { scale: scale + (1 - scale) * t },
        { rotate: `${String(turn + (badgeStamp.turn - turn) * t)}deg` },
      ],
    };
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View testID={testID} style={[styles.ground, { backgroundColor: tokens.colors.accent }]}>
        <StampHalftone id="badge-stamp-halftone" />
        <Animated.View style={[styles.mark, markStyle]}>
          <BadgeMark
            testID={`${testID}-mark`}
            condition={condition}
            symbol={symbol}
            state={{ kind: 'earned', isNew }}
            onRed
            size={badgeStamp.markSide}
          />
        </Animated.View>
        <Text
          {...voice}
          accessibilityRole="header"
          style={[typeStyle('screenTitle', tokens), styles.title, { color: keyInk }]}
        >
          {title}
        </Text>
        <Text {...voice} style={[typeStyle('stampName', tokens), styles.name, { color: keyInk }]}>
          {name}
        </Text>
        <View style={styles.spring} />
        {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
        <View style={styles.take}>
          <Button
            variant="onAccent"
            testID={`${testID}-take`}
            label={takeLabel}
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
    paddingTop: badgeStamp.padding.top,
    paddingHorizontal: badgeStamp.padding.horizontal,
    paddingBottom: badgeStamp.padding.bottom,
    overflow: 'hidden',
  },
  mark: { marginTop: badgeStamp.markTop },
  title: {
    marginTop: badgeStamp.titleTop - capitalMarkRoom('screenTitle'),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  name: { marginTop: badgeStamp.nameTop, textAlign: 'center' },
  spring: { flex: 1 },
  mascot: { alignSelf: 'flex-start' },
  take: { alignSelf: 'stretch' },
});
