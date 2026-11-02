'use no memo';

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { disabledOpacity, motion, offsetShadow, pressedFade, withAlpha } from '../tokens';

/**
 * What a tile's face is: the cream `tile` with its `tileEdge`, the red
 * `accent` with its `accentEdge`, the ink of both Themes for a tile on red,
 * or `none`, a face with no fill and no edge.
 */
export type TileTone = 'tile' | 'accent' | 'ink' | 'none';

/**
 * The pressed tile, the design's base of every button and letter tile: a
 * face over a hard offset edge (`offsetShadow`). A press moves the face
 * down and leaves a thin edge, on the UI thread; under Reduce Motion the
 * face stays and fades instead, as does a face with no edge. Disabled, it
 * is dimmed and takes no press. Its face carries the test ID
 * `${testID}-face`.
 */
export function PressedTile({
  tone = 'tile',
  radius,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  faceStyle,
  testID,
  children,
}: {
  tone?: TileTone;
  /** The face's corner radius; `radii.tile` when left out. */
  radius?: number;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string | undefined;
  accessibilityState?: { busy?: boolean; selected?: boolean | undefined };
  /** The face's own layout: its height, padding and content alignment. */
  faceStyle?: StyleProp<ViewStyle>;
  testID?: string | undefined;
  children: ReactNode;
}) {
  const { colors, radii } = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);
  const sinks = tone !== 'none' && !reduceMotion;
  const look = {
    tile: { face: colors.tile, edge: colors.tileEdge },
    accent: { face: colors.accent, edge: colors.accentEdge },
    ink: { face: keyInk, edge: withAlpha(keyInk, 0.45) },
    none: { face: 'transparent', edge: 'transparent' },
  }[tone];
  const timing = sinks ? motion.press : motion.reduceMotion;
  const press = (to: number) => {
    pressed.value = withTiming(to, {
      duration: timing.duration,
      easing: Easing.bezier(...timing.easing),
      reduceMotion: ReduceMotion.Never,
    });
  };
  const faceMotion = useAnimatedStyle(() =>
    sinks
      ? { opacity: 1, transform: [{ translateY: pressed.value * offsetShadow.pressed.translateY }] }
      : { opacity: 1 - pressed.value * (1 - pressedFade), transform: [{ translateY: 0 }] },
  );
  const shape = { borderRadius: radius ?? radii.tile };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        press(1);
      }}
      onPressOut={() => {
        press(0);
      }}
      style={[styles.tile, disabled && styles.disabled]}
    >
      <View style={[styles.edge, shape, { backgroundColor: look.edge }]} />
      <Animated.View
        testID={testID === undefined ? undefined : `${testID}-face`}
        style={[shape, { backgroundColor: look.face }, faceStyle, faceMotion]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { paddingBottom: offsetShadow.rest.depth },
  edge: { position: 'absolute', top: offsetShadow.rest.depth, right: 0, bottom: 0, left: 0 },
  disabled: { opacity: disabledOpacity },
});
