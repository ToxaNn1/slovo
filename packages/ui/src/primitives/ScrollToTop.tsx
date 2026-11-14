'use no memo';

import { useCallback, useState, type Component } from 'react';
import {
  Pressable,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { motion, pressedFade, scrollToTopButton as place } from '../tokens';
import { Icon } from './Icon';

/** A long list's ref and how far down the reader has scrolled it, for its «Нагору» button. */
export interface ListScroll<List extends Component> {
  /** Goes on the list (`FlatList`, `SectionList` or `ScrollView`) as its `ref`. */
  readonly list: AnimatedRef<List>;
  /** Goes on the list as its `onScroll`: it keeps `offset`. */
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** How far down the list is scrolled, in points. */
  readonly offset: SharedValue<number>;
}

/** The ref and the scroll offset of a long list that has a {@link ScrollToTopButton}. */
export function useListScroll<List extends Component>(): ListScroll<List> {
  const list = useAnimatedRef<List>();
  const offset = useSharedValue(0);
  // The list's own `onScroll`, not Reanimated's scroll offset: a virtualized
  // list hands every scroll to JavaScript anyway, and so it is testable.
  const onScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.value = nativeEvent.contentOffset.y;
    },
    [offset],
  );
  return { list, onScroll, offset };
}

/**
 * «Нагору»: the ink tile with an arrow up in the bottom-right corner of a
 * long list. It fades in once the reader has scrolled `showAfter` points
 * down and out near the top; a tap glides the list back to its top over
 * `motion.scrollToTop`, easing in and out, so the rows stay readable as they
 * pass. Under Reduce Motion or «Менше руху» the list jumps and the tile
 * neither fades in nor out. It sits `bottom` points above the list's bottom
 * edge, plus the home indicator unless the tab bar is under the list.
 */
export function ScrollToTopButton<List extends Component>({
  scroll,
  accessibilityLabel,
  overTabBar = false,
  testID = 'scroll-to-top',
}: {
  scroll: ListScroll<List>;
  accessibilityLabel: string;
  /** The list ends at the tab bar, which keeps the home indicator clear already. */
  overTabBar?: boolean;
  testID?: string;
}) {
  const { ink, background } = useSchemeColors('light');
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(false);
  // Where the glide has the list now; it moves the list only while `gliding`.
  const glideAt = useSharedValue(0);
  const gliding = useSharedValue(false);
  const { list, offset } = scroll;

  useAnimatedReaction(
    () => offset.value > place.showAfter,
    (now, before) => {
      if (now !== before) scheduleOnRN(setShown, now);
    },
  );
  useAnimatedReaction(
    () => glideAt.value,
    (y) => {
      if (gliding.value) scrollTo(list, 0, y, false);
    },
  );

  const glide = () => {
    gliding.value = true;
    glideAt.value = offset.value;
    glideAt.value = withTiming(
      0,
      {
        duration: reduceMotion ? 0 : motion.scrollToTop.duration,
        easing: Easing.bezier(...motion.scrollToTop.easing),
      },
      () => {
        gliding.value = false;
      },
    );
  };

  if (!shown) return null;
  return (
    <Animated.View
      {...(!reduceMotion && {
        entering: FadeIn.duration(motion.pop.duration),
        exiting: FadeOut.duration(motion.pop.duration),
      })}
      style={[styles.place, { bottom: place.bottom + (overTabBar ? 0 : insets.bottom) }]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        {...voice}
        onPress={glide}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: ink, opacity: pressed ? pressedFade : 1 },
        ]}
      >
        <Icon name="up" size={place.icon} color={background} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  place: { position: 'absolute', right: place.right },
  tile: {
    width: place.side,
    height: place.side,
    borderRadius: place.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
