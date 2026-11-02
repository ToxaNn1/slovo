'use no memo';

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { disabledOpacity, minTouchTarget, motion, switchDrawing } from '../tokens';

/** How far the knob travels from off to on. */
const TRAVEL = switchDrawing.width - switchDrawing.knob - 2 * switchDrawing.inset;

/** The slack around the track up to the smallest tap area. */
const HIT_SLOP = (minTouchTarget - switchDrawing.height) / 2;

const SLIDE = { duration: motion.switch.duration, easing: Easing.bezier(...motion.switch.easing) };
const FADE = {
  duration: motion.reduceMotion.duration,
  easing: Easing.bezier(...motion.reduceMotion.easing),
};

/**
 * A toggle: a track in the accent while on, its knob sliding over with an
 * overshoot. Under Reduce Motion the knob does not slide: it fades in at its
 * new place. VoiceOver reads it as a switch with its label.
 */
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  testID,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** What VoiceOver says; leave it out where the row around the toggle names it. */
  accessibilityLabel?: string;
  accessibilityHint?: string | undefined;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const position = useSharedValue(value ? 1 : 0);
  const shown = useSharedValue(1);
  const drawn = useRef(value);

  useEffect(() => {
    if (drawn.current === value) return;
    drawn.current = value;
    if (reduceMotion) {
      position.value = value ? 1 : 0;
      shown.value = 0;
      shown.value = withTiming(1, FADE);
    } else {
      position.value = withTiming(value ? 1 : 0, SLIDE);
    }
  }, [value, reduceMotion, position, shown]);

  const off = colors.silhouette;
  const on = colors.accent;
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(position.value, [0, 1], [off, on]),
  }));
  const knob = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: position.value * TRAVEL }],
  }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value, disabled }}
      {...voice}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onPress={() => {
        onValueChange(!value);
      }}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View
          testID={testID === undefined ? undefined : `${testID}-knob`}
          style={[styles.knob, { backgroundColor: colors.onAccent }, knob]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: switchDrawing.width,
    height: switchDrawing.height,
    borderRadius: switchDrawing.radius,
    padding: switchDrawing.inset,
  },
  knob: {
    width: switchDrawing.knob,
    height: switchDrawing.knob,
    borderRadius: switchDrawing.knobRadius,
    shadowColor: switchDrawing.knobShadow.color,
    shadowOffset: { width: 0, height: switchDrawing.knobShadow.depth },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  disabled: { opacity: disabledOpacity },
});
