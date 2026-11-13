'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { flyInStyle } from '../primitives/FlyingText';
import { useCascade } from '../primitives/useCascade';
import { useReduceMotion } from '../providers/useReduceMotion';
import { dashboard, entryReveal, motion } from '../tokens';
import { useFitToRoom } from './useFitToRoom';

const { reveal } = dashboard.hero;
const flyEasing = Easing.bezier(...entryReveal.headlineEasing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * The open hero's Lemma flying in letter by letter as the hero opens
 * (ADR 0105): each letter from below, small and turned, `stagger` ms after
 * the one before, and the row drawn small enough to fit its line, as the
 * Lemma under it is. Under Reduce Motion the letters only fade in. It is
 * drawn for the eye alone: VoiceOver reads the Lemma under it.
 */
export function FlyingLemma({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const { scale = 1, onRoomLayout, measured } = useFitToRoom();
  const letters = Array.from(text);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.over}
      onLayout={onRoomLayout}
    >
      <View style={[styles.row, { transform: [{ scale }] }]}>
        {letters.map((letter, index) => (
          <FlyingLetter
            // The letters of one Lemma never move.
            key={index}
            letter={letter}
            index={index}
            style={style}
            {...(index === letters.length - 1 ? { onEnd: measured } : {})}
          />
        ))}
      </View>
    </View>
  );
}

function FlyingLetter({
  letter,
  index,
  style,
  onEnd,
}: {
  letter: string;
  index: number;
  style: StyleProp<TextStyle>;
  /** Told where the last letter ends: the row's width at full size. */
  onEnd?: (end: number) => void;
}) {
  const reduceMotion = useReduceMotion();
  // 0 away and unseen, 1 in place.
  const landed = useSharedValue(0);
  useEffect(() => {
    landed.value = reduceMotion
      ? withTiming(1, {
          duration: motion.reduceMotion.duration,
          easing: fadeEasing,
          reduceMotion: ReduceMotion.Never,
        })
      : withDelay(
          reveal.letters.delay + index * reveal.letters.stagger,
          withTiming(1, {
            duration: reveal.letters.duration,
            easing: flyEasing,
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never,
        );
  }, [landed, index, reduceMotion]);
  const from = { ...entryReveal.from, x: entryReveal.from.x - index * reveal.letters.shift };
  const fly = useAnimatedStyle(() =>
    reduceMotion ? { opacity: landed.value } : flyInStyle(landed.value, from),
  );
  return (
    <Animated.View
      style={fly}
      onLayout={
        onEnd === undefined
          ? undefined
          : (event) => {
              const { x, width } = event.nativeEvent.layout;
              onEnd(x + width);
            }
      }
    >
      <Text testID="dashboard-hero-flying-letter" style={style}>
        {letter}
      </Text>
    </Animated.View>
  );
}

/** A part of the opening hero that rises in at its moment: the card, then the button (ADR 0105). */
export function RisesIn({
  at,
  style,
  children,
}: {
  at: 'card' | 'button';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const rise = useCascade(0, { variant: 'rise', stagger: 0, ...reveal[at] });
  return <Animated.View style={[style, rise]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  over: StyleSheet.absoluteFill,
  row: { flexDirection: 'row', alignSelf: 'flex-start', transformOrigin: 'left top' },
});
