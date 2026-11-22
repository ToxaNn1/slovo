'use no memo';
// Reanimated code: the React Compiler skips this module.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import type { Schedule } from '@slovo/core';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { systemSchedule } from '../providers/system-schedule';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { fontScaleCap, motion, offlinePlate, typeStyle } from '../tokens';
import { Wedge } from './Wedge';
import { bezier } from './timing';

/** The design's `slToastD`: down from above, overshooting a little as it lands. */
const DROP_IN = {
  duration: motion.offlinePlate.duration,
  easing: bezier(motion.offlinePlate.easing),
  reduceMotion: ReduceMotion.Never,
};

/** How far above its place the plate starts, as a share of its height (`translateY(-120%)`). */
const START = 1.2;

/** The plate's left edge: straight down from its top left corner, leaning in at the bottom. */
const LEAN_SHAPE = [
  [0, 0],
  [1, 0],
  [1, 1],
] as const;

const OfflinePlateContext = createContext<(() => void) | undefined>(undefined);

/**
 * Shows the offline plate «Немає з’єднання. Спробуй пізніше.» (board
 * XSettings m6) over everything it wraps, under the status bar,
 * when an action that needs the network finds none. A second ask while it
 * shows starts it again. It hides by the `schedule` it is given, the system
 * clock unless a test injects one.
 */
export function OfflinePlateProvider({
  message,
  children,
  schedule = systemSchedule,
}: {
  /** What the plate says, in the Edition's language. */
  message: string;
  children: ReactNode;
  schedule?: Schedule;
}) {
  const [shown, setShown] = useState<number>();
  const lastId = useRef(0);
  const show = useCallback(() => {
    lastId.current += 1;
    setShown(lastId.current);
  }, []);
  const hide = useCallback((id: number) => {
    setShown((current) => (current === id ? undefined : current));
  }, []);
  return (
    <OfflinePlateContext value={show}>
      <View style={styles.fill}>
        {children}
        {shown !== undefined && (
          <Plate key={shown} id={shown} message={message} onHide={hide} schedule={schedule} />
        )}
      </View>
    </OfflinePlateContext>
  );
}

/**
 * Shows the offline plate of the nearest `OfflinePlateProvider`; outside one
 * it does nothing.
 */
export function useOfflinePlate(): () => void {
  return useContext(OfflinePlateContext) ?? noPlate;
}

function noPlate() {
  // No plate to show outside an OfflinePlateProvider.
}

/**
 * The plate: the Theme's ink (the cream in the dark Theme) with its left edge
 * leaning in at the bottom, the no-signal mark crossed in red and the message
 * in the Theme's background colour. It drops in from above; with Reduce
 * Motion it stands in place at once. It reads its message out as it appears.
 */
function Plate({
  id,
  message,
  onHide,
  schedule,
}: {
  id: number;
  message: string;
  onHide: (id: number) => void;
  schedule: Schedule;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { top } = useSafeAreaInsets();
  const reduceMotionKnown = useReduceMotionKnown();
  const ready = reduceMotionKnown !== undefined;
  /** 0 above its place, 1 once in place. */
  const placed = useSharedValue(0);
  const height = useSharedValue(0);
  const comeIn = useEffectEvent(() => {
    placed.value = reduceMotionKnown === true ? 1 : withTiming(1, DROP_IN);
  });
  const timeOut = useEffectEvent(() => {
    onHide(id);
  });

  useEffect(() => schedule(timeOut, offlinePlate.lasts), [schedule]);
  // iOS reads no view that appears by itself, whatever its role, so the plate says its message.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  useEffect(() => {
    if (ready) comeIn();
  }, [ready]);

  const dropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (placed.value - 1) * START * (height.value + top) }],
  }));

  return (
    <Animated.View
      testID="offline-plate"
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      {...voice}
      onLayout={(event) => {
        height.value = event.nativeEvent.layout.height;
      }}
      style={[styles.place, { top: top + offlinePlate.below }, dropStyle]}
    >
      <View style={styles.face}>
        <View style={[styles.body, { backgroundColor: colors.ink }]} />
        <Wedge
          points={LEAN_SHAPE}
          color={colors.ink}
          width={offlinePlate.lean}
          height="100%"
          style={styles.lean}
        />
        <NoSignal color={colors.background} cross={colors.accent} />
        <Text
          {...voice}
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[styles.message, typeStyle('toast', tokens), { color: colors.background }]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

/** The no-signal mark: three faded bars crossed by a red slash. */
function NoSignal({ color, cross }: { color: string; cross: string }) {
  const { width, height } = offlinePlate.mark;
  return (
    <Svg
      accessible={false}
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
    >
      <Polygon points="0,11 4,11 4,16 0,16" fill={color} opacity={0.35} />
      <Polygon points="6,7 10,7 10,16 6,16" fill={color} opacity={0.35} />
      <Polygon points="12,3 16,3 16,16 12,16" fill={color} opacity={0.35} />
      <Polygon points="1,0 4,0 19,14 19,16 16,16 1,2" fill={cross} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  place: {
    position: 'absolute',
    left: offlinePlate.side,
    right: offlinePlate.side,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: offlinePlate.gap,
    paddingHorizontal: offlinePlate.padding.across,
    paddingVertical: offlinePlate.padding.down,
  },
  body: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: offlinePlate.lean,
    right: 0,
    borderTopRightRadius: offlinePlate.radius,
    borderBottomRightRadius: offlinePlate.radius,
  },
  lean: { position: 'absolute', top: 0, left: 0 },
  message: { flex: 1 },
});
