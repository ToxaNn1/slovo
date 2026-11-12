'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { BottomSheet } from '../primitives/BottomSheet';
import { Button } from '../primitives/Button';
import { SheetTitle } from '../primitives/SheetParts';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { gesturesHint, space, typeStyle } from '../tokens';
import { demoFinger, demoRow, type SwipeDemo } from '../entries/swipe-demo';

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

/**
 * The «ГОРТАЙ ПАЛЬЦЕМ» sheet the Feed shows once (board 04): its title, a row
 * per gesture (right marks the Entry Known, left Unknown, up turns to the next
 * card) and «ЗРОЗУМІЛО», which asks `onDismiss`; nothing else closes it. While
 * the swipe hint's `demo` plays (board XSwipeV) the card swings under a finger
 * and each row lights up in turn with its gesture; with no demo (switched off,
 * or Reduce Motion) it is a static frame: no finger and no light. `onShown` is
 * called once it is drawn, so the caller can keep that it was seen.
 */
export function GesturesHintSheet({
  visible,
  texts,
  demo,
  onShown,
  onDismiss,
  testID = 'gestures-hint',
}: {
  visible: boolean;
  texts: GesturesHintTexts;
  demo: SwipeDemo | undefined;
  onShown: () => void;
  onDismiss: () => void;
  testID?: string;
}) {
  const playing = visible ? demo : undefined;

  useEffect(() => {
    if (visible) onShown();
  }, [visible, onShown]);

  return (
    <>
      {playing !== undefined && <Finger demo={playing} testID={`${testID}-finger`} />}
      <BottomSheet visible={visible} testID={testID}>
        <SheetTitle>{texts.title}</SheetTitle>
        <View style={styles.rows}>
          {gestures.map((gesture) => (
            <Row
              key={gesture}
              gesture={gesture}
              row={texts.rows[gesture]}
              demo={playing}
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

function Row({
  gesture,
  row,
  demo,
  testID,
}: {
  gesture: Gesture;
  row: HintRow;
  demo: SwipeDemo | undefined;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const light = useAnimatedStyle(() => ({
    opacity: demo === undefined ? 0 : demoRow(demo.value, gesture),
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
        testID={`${testID}-light`}
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

/** The finger over the card: it presses, drags right, left and up, and lifts, with the demo. */
function Finger({ demo, testID }: { demo: SwipeDemo; testID: string }) {
  const key = useSchemeColors('light');
  const style = useAnimatedStyle(() => {
    const { opacity, x, y, scale } = demoFinger(demo.value);
    return { opacity, transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });
  return (
    <View testID={testID} pointerEvents="none" style={styles.fingerArea}>
      <Animated.View testID={`${testID}-tip`} style={[styles.finger, style]}>
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
  // The finger rests over the middle of the card above the sheet, as on board XSwipeV.
  fingerArea: { ...StyleSheet.absoluteFill },
  finger: {
    position: 'absolute',
    top: gesturesHint.fingerTop,
    left: '50%',
    marginLeft: -(gesturesHint.fingerSize / 2 + gesturesHint.fingerRing),
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
