'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { ActionIcon, ActionTile } from '../primitives/ActionTile';
import { useEdition } from '../providers/EditionProvider';
import { useHaptics } from '../providers/HapticsProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/** The design's heart on a 24-point grid. */
const HEART_ICON = {
  outline:
    'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z',
};

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
 * The «Улюблене» action of the action row: a heart outline, or a filled heart
 * on the red tile while the Entry is in Favorites. A tap that fills it springs
 * the heart to 1.2 and back with a light haptic; with Reduce Motion it only
 * fills. VoiceOver reads what a tap will do, and Favorites as selected. Its
 * heart carries the test ID `${testID}-icon`.
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
  const { strings } = useEdition();
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

  return (
    <ActionTile
      label={strings.favorites.title}
      accessibilityLabel={
        inFavorites ? strings.favorites.heart.remove : strings.favorites.heart.add
      }
      mark={inFavorites ? 'favorite' : 'none'}
      onPress={onPress}
      testID={testID}
      icon={(look) => (
        <Animated.View testID={`${testID}-icon`} style={popStyle}>
          <ActionIcon paths={HEART_ICON} look={look} />
        </Animated.View>
      )}
    />
  );
}
