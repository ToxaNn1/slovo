'use no memo';

import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { chipDrawing, disabledOpacity, minTouchTarget, motion, typeStyle } from '../tokens';

/** The slack around the chip up to the smallest tap area. */
const HIT_SLOP = (minTouchTarget - chipDrawing.height) / 2;

const PRESS = { duration: motion.press.duration, easing: Easing.bezier(...motion.press.easing) };

/**
 * A chip that turns a choice on and off: a Category of the Mix, «Усі», a tab
 * of the Saved screen with its count. On is filled ink, off is the sunken
 * fill; a `feature` chip fills with the accent while on. It shrinks a little
 * while pressed, and stays still under Reduce Motion. A disabled chip is
 * dimmed and reads its hint to VoiceOver. VoiceOver reads the chip by its
 * `label` unless `accessibilityLabel` names it otherwise.
 */
export function Chip({
  label,
  count,
  accessibilityLabel = label,
  on,
  onPress,
  disabled = false,
  accessibilityHint,
  feature = false,
  testID,
}: {
  label: string;
  /** A number beside the label, such as how many Words a tab holds. */
  count?: number;
  accessibilityLabel?: string;
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  feature?: boolean;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fill = on ? (feature ? colors.accent : colors.ink) : colors.surfaceSunken;
  const ink = on ? (feature ? colors.onAccent : colors.background) : colors.ink;
  const text = { color: ink };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={disabled ? accessibilityHint : undefined}
      accessibilityState={{ selected: on, disabled }}
      {...voice}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      onPressIn={() => {
        if (!reduceMotion) scale.value = withTiming(chipDrawing.pressedScale, PRESS);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, PRESS);
      }}
      style={disabled && styles.disabled}
    >
      <Animated.View
        testID={testID === undefined ? undefined : `${testID}-face`}
        style={[styles.chip, { backgroundColor: fill, borderRadius: radii.chip }, pressed]}
      >
        <Text style={[typeStyle('chipLabel', tokens), text]}>{label}</Text>
        {count === undefined ? null : (
          <Text style={[typeStyle('chipCount', tokens), styles.count, text]}>{count}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: chipDrawing.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: chipDrawing.gap,
    paddingHorizontal: chipDrawing.paddingHorizontal,
  },
  count: { opacity: chipDrawing.countOpacity },
  disabled: { opacity: disabledOpacity },
});
