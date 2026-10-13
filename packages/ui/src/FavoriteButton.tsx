import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from './EditionProvider';
import { useHaptics } from './HapticsProvider';
import { useTokens } from './TokensProvider';
import { useReduceMotion } from './useReduceMotion';

/** The heart's size in the action row, from the design. */
const ICON_SIZE = 26;

/**
 * The design's 450 ms pop: scale 1 → 1.35 → 0.92 → 1, each step a third of
 * the time or so, eased like its `cubic-bezier(.3, 1.6, .5, 1)` spring.
 */
const POP = [
  { toValue: 1.35, duration: 158 },
  { toValue: 0.92, duration: 157 },
  { toValue: 1, duration: 135 },
] as const;

const popEasing = Easing.bezier(0.3, 1.6, 0.5, 1);

/**
 * The heart of the action row: an outline, or filled with the heart colour
 * while the Entry is in Favorites. A tap that fills it pops it with a light
 * haptic; with Reduce Motion it only fills. VoiceOver reads what a tap will do.
 */
export function FavoriteButton({
  inFavorites,
  onToggle,
  testID = 'favorite-button',
}: {
  inFavorites: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  function onPress() {
    if (!inFavorites) {
      haptics.impactLight();
      if (!reduceMotion) {
        scale.setValue(1);
        Animated.sequence(
          POP.map((step) =>
            Animated.timing(scale, { ...step, easing: popEasing, useNativeDriver: true }),
          ),
        ).start();
      }
    }
    onToggle();
  }

  const color = inFavorites ? colors.heart : colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        inFavorites ? strings.favorites.heart.remove : strings.favorites.heart.add
      }
      {...voice}
      onPress={onPress}
      style={styles.button}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
          <Path
            d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
            fill={inFavorites ? color : 'none'}
            stroke={color}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The whole 52 pt slot of the action row takes the tap.
  button: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
