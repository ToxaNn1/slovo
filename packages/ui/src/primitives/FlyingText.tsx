'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { entryReveal } from '../tokens';

/** A text that flies into place: how far it has come, from 0 (away, unseen) to 1 (in place). */
export interface FlyingTextOf {
  readonly landed: SharedValue<number>;
}

/**
 * A text laid out as the text under it, flying in from below, small and
 * turned, as one layer. The text under it is drawn clear meanwhile, so it
 * lands on its place. `children` is the text as the one under it draws it,
 * with a mark that falls on its own left clear. It is drawn for the eye
 * alone: VoiceOver reads the text under it.
 */
export function FlyingText({
  children,
  flying,
  textProps,
  style,
  testID,
}: {
  children: ReactNode;
  flying: FlyingTextOf;
  /** How the text under it lays out, so this one lays out alike. */
  textProps: Pick<
    TextProps,
    | 'numberOfLines'
    | 'adjustsFontSizeToFit'
    | 'minimumFontScale'
    | 'allowFontScaling'
    | 'maxFontSizeMultiplier'
  >;
  style: StyleProp<TextStyle>;
  testID: string | undefined;
}) {
  const { landed } = flying;
  const { from } = entryReveal;
  const fly = useAnimatedStyle(() => {
    const away = 1 - landed.value;
    return {
      opacity: Math.min(1, Math.max(0, landed.value)),
      transform: [
        { translateX: away * from.x },
        { translateY: away * from.y },
        { scale: from.scale + (1 - from.scale) * landed.value },
        { rotate: `${String(away * from.rotate)}deg` },
      ],
    };
  });
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.over, fly]}
    >
      <Text {...textProps} style={style}>
        {children}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  over: { position: 'absolute', top: 0, left: 0, right: 0 },
});
