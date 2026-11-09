'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { BottomSheet } from '../primitives/BottomSheet';
import { Button } from '../primitives/Button';
import { SheetTitle } from '../primitives/SheetParts';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { gesturesHint, space, typeStyle } from '../tokens';

/** A row of the sheet: what one gesture does. */
interface HintRow {
  readonly title: string;
  readonly body: string;
}

/** The texts of the sheet, the rows right, left and up in this order. */
export interface GesturesHintTexts {
  readonly title: string;
  readonly rows: { readonly known: HintRow; readonly unknown: HintRow; readonly next: HintRow };
  readonly dismiss: string;
}

/** The gestures in the order the demo plays them, each with its row. */
const gestures = ['known', 'unknown', 'next'] as const;
type Gesture = (typeof gestures)[number];

/** One gesture of the demo, as on board 04 (2.8 s each). */
const GESTURE_MS = 2800;

/**
 * The «ГОРТАЙ ПАЛЬЦЕМ» sheet the Feed shows once (board 04): its title, a row
 * per gesture (right marks the Entry Known, left Unknown, up turns to the next
 * card) and «ЗРОЗУМІЛО», which asks `onDismiss`; nothing else closes it. While
 * it is open a finger over the card plays the three gestures in a loop and
 * each row lights up in turn with its gesture. With Reduce Motion it is a
 * static frame: no finger and no light. `onShown` is called once it is drawn,
 * so the caller can keep that it was seen.
 */
export function GesturesHintSheet({
  visible,
  texts,
  onShown,
  onDismiss,
  testID = 'gestures-hint',
}: {
  visible: boolean;
  texts: GesturesHintTexts;
  onShown: () => void;
  onDismiss: () => void;
  testID?: string;
}) {
  const reduceMotion = useReduceMotion();
  const animated = visible && !reduceMotion;
  /** The demo's place: the gesture playing, and how far it is through it. */
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) onShown();
  }, [visible, onShown]);

  useEffect(() => {
    if (!animated) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(gestures.length, {
        duration: GESTURE_MS * gestures.length,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [animated, progress]);

  return (
    <>
      {animated && <Finger progress={progress} testID={`${testID}-finger`} />}
      <BottomSheet visible={visible} testID={testID}>
        <SheetTitle>{texts.title}</SheetTitle>
        <View style={styles.rows}>
          {gestures.map((gesture, index) => (
            <Row
              key={gesture}
              gesture={gesture}
              row={texts.rows[gesture]}
              progress={animated ? progress : undefined}
              index={index}
              testID={`${testID}-${gesture}`}
            />
          ))}
        </View>
        <Button
          variant="onAccent"
          label={texts.dismiss}
          onPress={onDismiss}
          testID={`${testID}-dismiss`}
        />
      </BottomSheet>
    </>
  );
}

/** How far `progress` is through the gesture at `index`: below 0 before it, 1 and over after it. */
function through(progress: number, index: number) {
  'worklet';
  return progress - index;
}

function Row({
  gesture,
  row,
  progress,
  index,
  testID,
}: {
  gesture: Gesture;
  row: HintRow;
  progress: SharedValue<number> | undefined;
  index: number;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const light = useAnimatedStyle(() => ({
    opacity:
      progress === undefined
        ? 0
        : interpolate(
            through(progress.value, index),
            [0, 0.16, 0.28, 0.88, 1],
            [0, 0, 1, 1, 0],
            Extrapolation.CLAMP,
          ),
  }));
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${row.title}. ${row.body}`}
      {...voice}
      style={[styles.row, { borderRadius: radii.tile }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.accent, borderRadius: radii.tile },
          light,
        ]}
      />
      <GestureKey gesture={gesture} />
      <View style={styles.rowText}>
        <Text style={[typeStyle('hintRowTitle', tokens), { color: colors.ink }]}>{row.title}</Text>
        <Text style={[typeStyle('meta', tokens), { color: colors.ink }]}>{row.body}</Text>
      </View>
    </View>
  );
}

/** The arrow of each gesture, in an 18 × 14 box. */
const arrows: Record<Gesture, { points: string; width: number; height: number }> = {
  known: { points: '18,7 11,0 11,4 0,4 0,10 11,10 11,14', width: 18, height: 14 },
  unknown: { points: '0,7 7,0 7,4 18,4 18,10 7,10 7,14', width: 18, height: 14 },
  next: { points: '7,0 14,7 10,7 10,18 4,18 4,7 0,7', width: 14, height: 18 },
};

/**
 * The gesture's key, in the key colours in both Themes: an ink tile for the
 * marks forward (Known, next), a cream one with an ink edge for Unknown.
 */
function GestureKey({ gesture }: { gesture: Gesture }) {
  const key = useSchemeColors('light');
  const cream = gesture === 'unknown';
  const { points, width, height } = arrows[gesture];
  return (
    <View
      style={[
        styles.key,
        cream
          ? {
              backgroundColor: key.background,
              borderColor: key.ink,
              borderWidth: gesturesHint.keyBorder,
            }
          : { backgroundColor: key.ink },
      ]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${String(width)} ${String(height)}`}>
        <Polygon points={points} fill={cream ? key.ink : key.background} />
      </Svg>
    </View>
  );
}

/** The finger over the card: it presses, travels right, left and up, and lifts, in a loop. */
function Finger({ progress, testID }: { progress: SharedValue<number>; testID: string }) {
  const key = useSchemeColors('light');
  const style = useAnimatedStyle(() => {
    const index = Math.min(Math.floor(progress.value), gestures.length - 1);
    const t = through(progress.value, index);
    const travel = interpolate(t, [0.2, 0.56], [0, gesturesHint.fingerTravel], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.08, 0.2, 0.8, 0.92], [0, 0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: index === 0 ? travel : index === 1 ? -travel : 0 },
        { translateY: index === 2 ? -travel : 0 },
        { scale: interpolate(t, [0.08, 0.2], [1.5, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <View testID={testID} pointerEvents="none" style={styles.fingerArea}>
      <Animated.View style={[styles.finger, style]}>
        <View style={[styles.fingerRing, { backgroundColor: key.background }]} />
        <View style={[styles.fingerTip, { backgroundColor: key.background }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
  },
  rowText: { flex: 1, gap: space[1] },
  key: {
    width: gesturesHint.keySize,
    height: gesturesHint.keySize,
    borderRadius: gesturesHint.keyRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The finger rests a third of the way down the screen, over the card above the sheet.
  fingerArea: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: '33%',
  },
  finger: {
    width: gesturesHint.fingerSize + 2 * gesturesHint.fingerRing,
    height: gesturesHint.fingerSize + 2 * gesturesHint.fingerRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: gesturesHint.fingerSize / 2 + gesturesHint.fingerRing,
    opacity: 0.28,
  },
  fingerTip: {
    width: gesturesHint.fingerSize,
    height: gesturesHint.fingerSize,
    borderRadius: gesturesHint.fingerSize / 2,
    opacity: 0.92,
  },
});
