'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { motion, tabBar, typeStyle } from '../tokens';
import { Icon, type IconName } from './Icon';

const tabEasing = Easing.bezier(...motion.tab.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * One tab of the design's tab bar: its wedge icon over its label, ink when
 * selected and muted otherwise, with the red slanted indicator stretching in
 * over the selected tab. Under Reduce Motion the indicator fades in instead.
 */
export function TabBarButton({
  icon,
  label,
  selected,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  style,
}: {
  icon: IconName;
  /** The tab's name under its icon, in the Edition's language. */
  label: string;
  selected: boolean;
  onPress?: PressableProps['onPress'] | undefined;
  onLongPress?: PressableProps['onLongPress'] | undefined;
  /** What VoiceOver reads, in the Edition's language. */
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const { duration } = reduceMotion ? motion.reduceMotion : motion.tab;
    shown.value = withTiming(selected ? 1 : 0, {
      duration,
      easing: reduceMotion ? fadeEasing : tabEasing,
      // The hook already reads the system's Reduce Motion and «Менше руху».
      reduceMotion: ReduceMotion.Never,
    });
  }, [selected, reduceMotion, shown]);

  const indicatorStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: shown.value, transform: [{ skewX: tabBar.indicator.skewX }] }
      : { opacity: 1, transform: [{ skewX: tabBar.indicator.skewX }, { scaleX: shown.value }] },
  );

  const color = selected ? tokens.colors.ink : tokens.colors.muted;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      role="tab"
      aria-selected={selected}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={[styles.tab, style]}
      {...voice}
    >
      <Animated.View
        testID={testID === undefined ? undefined : `${testID}-indicator`}
        style={[styles.indicator, { backgroundColor: tokens.colors.accent }, indicatorStyle]}
      />
      <Icon name={icon} color={color} size={tabBar.icon} />
      <Text style={[typeStyle('tabLabel', tokens), { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    height: tabBar.height,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tabBar.gap,
  },
  indicator: {
    position: 'absolute',
    top: tabBar.indicator.top,
    width: tabBar.indicator.width,
    height: tabBar.indicator.height,
  },
});
