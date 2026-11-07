'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { BadgeShape } from '@slovo/contracts';
import { useEffect, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../primitives/Button';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { badgeStamp, capitalMarkRoom, motion, typeStyle } from '../tokens';
import { BadgeMark } from './BadgeMark';
import { StampHalftone } from './StampHalftone';

/** The five frames run once, after a short wait (board 10.7). */
const FRAMES = {
  duration: motion.badgeStamp.duration,
  easing: Easing.bezier(...motion.badgeStamp.easing),
  reduceMotion: ReduceMotion.Never,
};
/** Under Reduce Motion the stamp fades in at rest. */
const FADE = {
  duration: motion.reduceMotion.duration,
  easing: Easing.bezier(...motion.reduceMotion.easing),
  reduceMotion: ReduceMotion.Never,
};

const { fly, blow, bounce, rest } = badgeStamp.frames;
const turned = (degrees: number) => `${String(degrees)}deg`;

/**
 * An earned Badge stamped on red, over the whole screen (board 10.7): the
 * giant cream `kicker` turned, the Badge's mark in its ring, its `name`, the
 * `line`, the `mascot`, then the `ribbon` and a button labelled `doneLabel`
 * that closes it. The mark flies in, strikes with an ink burst and a light
 * shake, springs back and rests turned; then the ribbon and the button come
 * in. Under Reduce Motion the whole stamp fades in at rest, with no burst.
 * The kicker, the Mascot and the ribbon are each left out when not given,
 * as on the stamp after the Daily Crossword (board 08.2).
 */
export function BadgeStamp({
  shape,
  symbol,
  name,
  kicker,
  line,
  ribbon,
  doneLabel,
  mascot,
  isNew = false,
  onClose,
  testID = 'badge-stamp',
}: {
  /** The shape of the Badge's family. */
  shape: BadgeShape;
  symbol: string;
  name: string;
  /** The line over the mark; left out, none. */
  kicker?: string;
  line: string;
  /** The ink ribbon over the button; left out, none. */
  ribbon?: string;
  doneLabel: string;
  mascot?: ReactNode;
  /** The Badge is opened for the first time: its mark carries the cream «НОВА» tag. */
  isNew?: boolean;
  onClose: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  // Every red face carries the light Theme's ink and cream, in both Themes.
  const key = useSchemeColors('light');
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = reduceMotion
      ? withTiming(1, FADE)
      : withDelay(motion.badgeStamp.delay, withTiming(1, FRAMES));
  }, [t, reduceMotion]);
  const faded = useAnimatedStyle(() => ({ opacity: reduceMotion ? t.value : 1 }));
  const shaken = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const step = (blow - fly) / 3;
    const { shake } = badgeStamp;
    return {
      transform: [
        {
          translateX: interpolate(
            t.value,
            [fly, fly + step, fly + 2 * step, blow],
            [0, shake, -shake, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  const markStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ rotate: turned(badgeStamp.turn) }] };
    const { from } = badgeStamp;
    return {
      opacity: interpolate(t.value, [0, fly / 2], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(
            t.value,
            [0, fly, blow, bounce, rest],
            [from.scale, 1, 1, badgeStamp.bounce, 1],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotate: turned(
            interpolate(t.value, [0, fly], [from.turn, badgeStamp.turn], Extrapolation.CLAMP),
          ),
        },
      ],
    };
  });
  const burstStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [fly, (fly + blow) / 2, bounce], [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(t.value, [fly, bounce], [0.6, badgeStamp.burst], Extrapolation.CLAMP) },
    ],
  }));
  const lastFrame = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : interpolate(t.value, [rest, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        testID={testID}
        style={[styles.ground, { backgroundColor: tokens.colors.accent }, faded]}
      >
        <StampHalftone id={`${testID}-halftone`} />
        <Animated.View style={[styles.content, shaken]}>
          {kicker !== undefined && (
            <Text
              {...voice}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[typeStyle('shout', tokens), styles.kicker, { color: key.background }]}
            >
              {kicker}
            </Text>
          )}
          <View style={styles.mark}>
            {!reduceMotion && (
              <Animated.View
                testID={`${testID}-burst`}
                pointerEvents="none"
                style={[styles.burst, { backgroundColor: key.ink }, burstStyle]}
              />
            )}
            <Animated.View style={markStyle}>
              <BadgeMark
                testID={`${testID}-mark`}
                shape={shape}
                tone="cream"
                symbol={symbol}
                state={{ kind: 'earned', isNew }}
                onRed
                size={badgeStamp.markSide}
              />
            </Animated.View>
          </View>
          <Text
            {...voice}
            accessibilityRole="header"
            style={[typeStyle('screenTitle', tokens), styles.name, { color: key.ink }]}
          >
            {name}
          </Text>
          <Text
            {...voice}
            style={[typeStyle('stampName', tokens), styles.line, { color: key.ink }]}
          >
            {line}
          </Text>
          <View style={styles.spring} />
          {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
          <Animated.View style={[styles.last, lastFrame]}>
            {ribbon !== undefined && (
              <View style={[styles.ribbon, { backgroundColor: key.ink }]}>
                <Text
                  {...voice}
                  style={[typeStyle('sectionLabel', tokens), { color: key.background }]}
                >
                  {ribbon}
                </Text>
              </View>
            )}
            <View style={styles.done}>
              <Button
                variant="onAccent"
                testID={`${testID}-done`}
                label={doneLabel}
                onPress={onClose}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    paddingTop: badgeStamp.padding.top,
    paddingHorizontal: badgeStamp.padding.horizontal,
    paddingBottom: badgeStamp.padding.bottom,
    overflow: 'hidden',
  },
  content: { flex: 1, alignItems: 'center' },
  kicker: {
    alignSelf: 'stretch',
    textAlign: 'center',
    transform: [{ rotate: turned(badgeStamp.turn) }],
  },
  mark: { marginTop: badgeStamp.markTop, alignItems: 'center', justifyContent: 'center' },
  burst: {
    position: 'absolute',
    width: badgeStamp.markSide,
    height: badgeStamp.markSide,
    borderRadius: badgeStamp.markSide / 2,
  },
  name: {
    marginTop: badgeStamp.nameTop - capitalMarkRoom('screenTitle'),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  line: { marginTop: badgeStamp.lineTop, textAlign: 'center' },
  spring: { flex: 1 },
  mascot: { alignSelf: 'flex-start' },
  last: { alignSelf: 'stretch', alignItems: 'center' },
  ribbon: {
    paddingVertical: badgeStamp.ribbon.padding.vertical,
    paddingHorizontal: badgeStamp.ribbon.padding.horizontal,
    transform: [{ rotate: turned(badgeStamp.ribbon.turn) }],
  },
  done: { alignSelf: 'stretch', marginTop: badgeStamp.ribbon.top },
});
