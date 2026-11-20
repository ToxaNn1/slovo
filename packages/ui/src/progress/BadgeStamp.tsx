'use no memo';
// Reanimated code: the React Compiler skips this module.

import type { BadgeShape } from '@slovo/contracts';
import { useEffect, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
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
import { bezier, REDUCED_FADE } from '../primitives/timing';

/** The stamp runs once, after a short wait (XBadges «Штамп»). */
const FRAMES = {
  duration: motion.badgeStamp.duration,
  easing: bezier(motion.badgeStamp.easing),
  reduceMotion: ReduceMotion.Never,
};
const { fly, bounce, rest, ribbon: ribbonIn, ring, shake } = badgeStamp.frames;
/** A turn in degrees as a style string; a worklet, as the animated styles call it on the UI thread. */
function turned(degrees: number) {
  'worklet';
  return `${String(degrees)}deg`;
}

/**
 * An earned Badge stamped on red, over the whole screen (XBadges «Штамп»,
 * decision 13): the giant cream `kicker` turned, the Badge's mark in its
 * family's shape, its `name`, the `line`, the `mascot`, then the `ribbon`
 * and a button labelled `doneLabel` that closes it. The mark flies in,
 * presses at the blow under a dotted ink ring and a light shake, springs
 * back and rests turned; then the ribbon flies in from the left and the
 * button comes in. Under Reduce Motion the whole stamp fades in at rest,
 * with no ring, shake or ribbon flight. The kicker, the Mascot and the
 * ribbon are each left out when not given, as on the stamp after the Daily
 * Crossword (board 08.2).
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
  kicker?: string | undefined;
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
      ? withTiming(1, REDUCED_FADE)
      : withDelay(motion.badgeStamp.delay, withTiming(1, FRAMES));
  }, [t, reduceMotion]);
  const faded = useAnimatedStyle(() => ({ opacity: reduceMotion ? t.value : 1 }));
  const shaken = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, shake, badgeStamp.shake.x, Extrapolation.CLAMP) },
      { translateY: interpolate(t.value, shake, badgeStamp.shake.y, Extrapolation.CLAMP) },
    ],
  }));
  const markStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ rotate: turned(badgeStamp.turn) }] };
    const { from } = badgeStamp;
    return {
      opacity: interpolate(t.value, [0, fly], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(
            t.value,
            [0, fly, bounce, rest],
            [from.scale, badgeStamp.press, badgeStamp.bounce, 1],
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
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [ring.in, ring.blow, ring.out], [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          t.value,
          [ring.in, ring.blow, ring.out],
          [badgeStamp.ring.from, 1, badgeStamp.ring.to],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const flight = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [rest, ribbonIn], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          t.value,
          [rest, ribbonIn],
          [badgeStamp.ribbon.from, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const lastFrame = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : interpolate(t.value, [rest, ribbonIn], [0, 1], Extrapolation.CLAMP),
  }));

  const content = (
    <>
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
            testID={`${testID}-ring`}
            pointerEvents="none"
            style={[styles.ring, { borderColor: key.ink }, ringStyle]}
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
      <Text {...voice} style={[typeStyle('stampName', tokens), styles.line, { color: key.ink }]}>
        {line}
      </Text>
      <View style={styles.spring} />
      {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
      {ribbon !== undefined &&
        (reduceMotion ? (
          <View style={styles.ribbonPlace}>{ribbonView(ribbon)}</View>
        ) : (
          <Animated.View testID={`${testID}-ribbon-flight`} style={[styles.ribbonPlace, flight]}>
            {ribbonView(ribbon)}
          </Animated.View>
        ))}
      <Animated.View style={[styles.done, lastFrame]}>
        <Button variant="onAccent" testID={`${testID}-done`} label={doneLabel} onPress={onClose} />
      </Animated.View>
    </>
  );

  function ribbonView(text: string) {
    return (
      <View style={[styles.ribbon, { backgroundColor: key.ink }]}>
        <Text {...voice} style={[typeStyle('stampRibbon', tokens), { color: key.background }]}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        testID={testID}
        style={[styles.ground, { backgroundColor: tokens.colors.accent }, faded]}
      >
        <StampHalftone id={`${testID}-halftone`} />
        {reduceMotion ? (
          <View style={styles.content}>{content}</View>
        ) : (
          <Animated.View testID={`${testID}-shake`} style={[styles.content, shaken]}>
            {content}
          </Animated.View>
        )}
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
  mark: {
    marginTop: badgeStamp.markTop,
    width: badgeStamp.ring.side,
    height: badgeStamp.ring.side,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: badgeStamp.ring.side,
    height: badgeStamp.ring.side,
    borderRadius: badgeStamp.ring.side / 2,
    borderWidth: badgeStamp.ring.width,
    borderStyle: 'dotted',
  },
  name: {
    marginTop: badgeStamp.nameTop - capitalMarkRoom('screenTitle'),
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  line: { marginTop: badgeStamp.lineTop, textAlign: 'center' },
  spring: { flex: 1 },
  mascot: { alignSelf: 'flex-start' },
  ribbonPlace: { alignSelf: 'flex-start', marginTop: badgeStamp.ribbon.top },
  ribbon: {
    paddingVertical: badgeStamp.ribbon.padding.vertical,
    paddingHorizontal: badgeStamp.ribbon.padding.horizontal,
    transform: [{ rotate: turned(badgeStamp.ribbon.turn) }],
  },
  done: { alignSelf: 'stretch', marginTop: badgeStamp.ribbon.top },
});
