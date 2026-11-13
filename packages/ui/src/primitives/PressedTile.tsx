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

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  actionTile,
  disabledOpacity,
  motion,
  offsetShadow,
  pressedFade,
  withAlpha,
} from '../tokens';

/**
 * What a tile's face is: the cream `tile` with its `tileEdge`, the red
 * `accent` with its `accentEdge`, the ink of both Themes for a tile on red,
 * the Theme's own `inverse` ink on a dark edge, as a filed tile of the
 * action row, or `none`, a face with no fill and no edge.
 */
export type TileTone = 'tile' | 'accent' | 'ink' | 'inverse' | 'none';

/**
 * The pressed tile, the design's base of every button and letter tile: a
 * face over a hard offset edge (`offsetShadow`). A press moves the face
 * down and leaves a thin edge, on the UI thread; under Reduce Motion the
 * face stays and fades instead, as does a face with no edge. Disabled, it
 * is dimmed and takes no press; inert, as an answered tile, it takes no
 * press but keeps its look. A `key` stands on a shallower edge, as a
 * key of an on-screen keyboard, an `action` tile of the action row on
 * one between the two, and a `card` on a deeper one. Its face carries the test ID
 * `${testID}-face`.
 */
export function PressedTile({
  tone = 'tile',
  depth = 'tile',
  radius,
  onPress,
  disabled = false,
  inert = false,
  accessibilityLabel,
  accessibilityLanguage,
  accessibilityHint,
  accessibilityState,
  faceStyle,
  hitSlop,
  testID,
  children,
}: {
  tone?: TileTone;
  /** How deep its edge is: a tile's, an action row tile's, a keyboard key's shallowest one or a big card's deeper one. */
  depth?: 'tile' | 'action' | 'key' | 'card';
  /** The face's corner radius; `radii.tile` when left out. */
  radius?: number;
  onPress: () => void;
  disabled?: boolean;
  /** Whether it takes no press while it keeps its look, as an answered tile. */
  inert?: boolean;
  accessibilityLabel?: string;
  /** The language VoiceOver reads the label in; the Edition's when left out. */
  accessibilityLanguage?: string;
  accessibilityHint?: string | undefined;
  accessibilityState?: { busy?: boolean; selected?: boolean | undefined; disabled?: boolean };
  /** The face's own layout: its height, padding and content alignment. */
  faceStyle?: StyleProp<ViewStyle>;
  /** How far past its edges a tap still counts, for a tile narrower than the touch target. */
  hitSlop?: { left?: number; right?: number; top?: number; bottom?: number };
  testID?: string | undefined;
  children: ReactNode;
}) {
  const { colors, radii } = useTokens();
  const { voice } = useEdition();
  const keyInk = useSchemeColors('light').ink;
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);
  const sinks = tone !== 'none' && !reduceMotion;
  const look = {
    tile: { face: colors.tile, edge: colors.tileEdge },
    accent: { face: colors.accent, edge: colors.accentEdge },
    ink: { face: keyInk, edge: withAlpha(keyInk, 0.45) },
    inverse: { face: colors.ink, edge: actionTile.inverseEdge },
    none: { face: 'transparent', edge: 'transparent' },
  }[tone];
  const edge = {
    tile: { depth: offsetShadow.rest.depth, translateY: offsetShadow.pressed.translateY },
    action: actionTile.edge,
    key: offsetShadow.key,
    card: offsetShadow.card,
  }[depth];
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
      ? { opacity: 1, transform: [{ translateY: pressed.value * edge.translateY }] }
      : { opacity: 1 - pressed.value * (1 - pressedFade), transform: [{ translateY: 0 }] },
  );
  const shape = { borderRadius: radius ?? radii.tile };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityLanguage={accessibilityLanguage ?? voice.accessibilityLanguage}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        ...accessibilityState,
        disabled: disabled || (accessibilityState?.disabled ?? false),
      }}
      disabled={disabled || inert}
      hitSlop={hitSlop}
      onPress={onPress}
      onPressIn={() => {
        press(1);
      }}
      onPressOut={() => {
        press(0);
      }}
      style={[{ paddingBottom: edge.depth }, disabled && styles.disabled]}
    >
      <View style={[styles.edge, shape, { top: edge.depth, backgroundColor: look.edge }]} />
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
  edge: { position: 'absolute', right: 0, bottom: 0, left: 0 },
  disabled: { opacity: disabledOpacity },
});
