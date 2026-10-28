'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useHaptics } from '../providers/HapticsProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/** The design's heart on a 24-point grid, shared by Favorites and the Game's Lives. */
export const HEART_PATH =
  'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z';

/** The heart's size in the action row, from the design. */
const ICON_SIZE = 26;

/**
 * The pop, 300 ms in all (ADR 0055, the audit's H1): a critically damped
 * spring up to 1.2, then a softer one back to 1 that settles with a small
 * bounce. Reanimated takes a spring's `duration` as perceptual and runs 1.5
 * times it, so 80 + 120 here is 120 + 180 ms; a mass of 1 lets a spring this
 * short reach its time, which the default mass of 4 would stretch.
 */
const POP = [
  { toValue: 1.2, duration: 80, dampingRatio: 1, mass: 1 },
  { toValue: 1, duration: 120, dampingRatio: 0.6, mass: 1 },
] as const;

/**
 * The heart of the action row: an outline, or filled with the heart colour
 * while the Entry is in Favorites. A tap that fills it springs it to 1.2 and
 * back with a light haptic; with Reduce Motion it only fills. VoiceOver reads
 * what a tap will do.
 */
export function FavoriteButton({
  inFavorites,
  onToggle,
  testID = 'favorite-button',
}: {
  inFavorites: boolean;
  /** Adds the Entry or takes it out; resolves to whether it is in Favorites now, and never rejects. */
  onToggle: () => Promise<boolean>;
  testID?: string;
}) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  /** Pops the heart that just filled, with its haptic. */
  function pop() {
    haptics.impactLight();
    if (reduceMotion) return;
    // Assigning 1 first stops a pop still running, so a new one starts from rest.
    scale.value = 1;
    scale.value = withSequence(
      ...POP.map(({ toValue, ...spring }) =>
        withSpring(toValue, { ...spring, reduceMotion: ReduceMotion.Never }),
      ),
    );
  }

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function onPress() {
    // Pops on what the tap did, so a quick second tap that empties it again doesn't.
    void onToggle().then((added) => {
      if (added) pop();
    });
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
      <Animated.View style={popStyle}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
          <Path
            d={HEART_PATH}
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
