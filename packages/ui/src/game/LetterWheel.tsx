'use no memo';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';

import { Button } from '../primitives/Button';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { crossingCrosswordLayout, fontScaleCap, typeStyle } from '../tokens';
import { ease } from './round-motion';
import { useTraceDrag, type TraceHit } from './useTraceDrag';

/** A trace that spelled no Word: its letters show in ink and the chips shake; a new `key` plays it again. */
export interface WheelMiss {
  readonly key: number;
  readonly letters: readonly string[];
}

const { wheel, tile, chip, orbit } = crossingCrosswordLayout;

/** The centre of each of `count` tiles on the circle, the first at the top, clockwise. */
const centresOf = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(count, 1);
    return { x: wheel / 2 + orbit * Math.cos(angle), y: wheel / 2 + orbit * Math.sin(angle) };
  });

const STEP = { easing: ease, reduceMotion: ReduceMotion.Never } as const;

/**
 * The Letter Wheel of the crossing Daily Crossword (ADR 0087, board 08): the
 * current Word's letters on square tiles round a sunken disc, traced by finger
 * with a red line, and, at the top of the room it fills, the slot where the
 * path chips spell the trace and `help` shows while there is no trace. The drag runs on the UI
 * thread and hit-tests the tile under the finger; the wheel holds no rules: it
 * asks `onExtend` for each tile the finger reaches and `onRelease` when it
 * lifts. A trace that spelled nothing (`miss`) shows its letters in ink and
 * shakes. A hand coach sweeps over the first tiles while `coach` holds. In
 * accessible mode the tiles are buttons: a tap extends the trace, a tap on its
 * last tile steps back, and «Перевірити» releases it. Reduce Motion calms the
 * shake and the coach.
 */
export function LetterWheel({
  letters,
  trace,
  miss,
  coach,
  accessibleMode,
  onExtend,
  onStepBack,
  onRelease,
  help,
  texts,
  testID,
}: {
  /** The wheel's letters, tile by tile. */
  letters: readonly string[];
  /** The tiles of the trace, first to last. */
  trace: readonly number[];
  miss?: WheelMiss | undefined;
  /** Whether the hand coach shows, until the reader's first touch. */
  coach: boolean;
  /** Tiles as buttons and «Перевірити», as with VoiceOver on. */
  accessibleMode: boolean;
  onExtend: (tile: number) => void;
  onStepBack: () => void;
  onRelease: () => void;
  /** What the path slot shows while there is no trace, such as the line on how to trace. */
  help?: ReactNode;
  texts: {
    /** What VoiceOver reads for a tile. */
    tileLabel: (letter: string) => string;
    /** «Перевірити». */
    check: string;
  };
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const centres = useMemo(() => centresOf(letters.length), [letters.length]);
  const hit = useCallback(
    (x: number, y: number): TraceHit<number> | undefined => {
      'worklet';
      const reach = tile * crossingCrosswordLayout.hitRadius;
      for (let i = 0; i < centres.length; i += 1) {
        const centre = centres[i];
        if (centre === undefined) continue;
        if (Math.hypot(x - centre.x, y - centre.y) <= reach) return { index: i, place: i };
      }
      return undefined;
    },
    [centres],
  );
  const drag = useTraceDrag({
    hit,
    enabled: !accessibleMode,
    testID,
    onExtend,
    onRelease,
  });

  const shake = useSharedValue(0);
  useEffect(() => {
    if (miss === undefined || reduceMotion) return;
    const { shake: far, shakeBeat } = crossingCrosswordLayout;
    shake.value = withSequence(
      withTiming(far, { ...STEP, duration: shakeBeat }),
      withTiming(-far, { ...STEP, duration: shakeBeat }),
      withTiming(far / 2, { ...STEP, duration: shakeBeat }),
      withTiming(0, { ...STEP, duration: shakeBeat }),
    );
  }, [miss, reduceMotion, shake]);
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const missed = trace.length === 0 && miss !== undefined;
  const chips = missed ? miss.letters : trace.map((index) => letters[index] ?? '');
  const points = trace
    .map((index) => centres[index])
    .filter((centre) => centre !== undefined)
    .map(({ x, y }) => `${String(x)},${String(y)}`)
    .join(' ');

  return (
    <View style={styles.wheelArea}>
      <View style={styles.slot}>
        <Animated.View
          testID={`${testID}-path`}
          accessible={chips.length > 0}
          accessibilityLabel={chips.join('')}
          style={[styles.path, shaking]}
        >
          {chips.map((letter, i) => (
            <View
              key={i}
              testID={`${testID}-chip-${String(i)}`}
              style={[
                styles.chip,
                {
                  borderRadius: radii.tile,
                  backgroundColor: missed ? colors.ink : colors.accent,
                },
              ]}
            >
              <Text
                {...voice}
                maxFontSizeMultiplier={fontScaleCap.number}
                style={[
                  typeStyle('crosswordPathLetter', tokens),
                  { color: missed ? colors.background : colors.onAccent },
                ]}
              >
                {letter}
              </Text>
            </View>
          ))}
        </Animated.View>
        {trace.length === 0 && help}
      </View>
      <GestureDetector gesture={drag}>
        <View testID={testID} style={styles.wheel}>
          <View
            style={[
              styles.disc,
              {
                backgroundColor: colors.surfaceSunken,
                boxShadow: `inset 0 ${String(crossingCrosswordLayout.discEdge)}px 0 ${colors.tileEdge}`,
              },
            ]}
          />
          {trace.length > 1 && (
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Polyline
                points={points}
                fill="none"
                stroke={colors.accent}
                strokeWidth={crossingCrosswordLayout.trace}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
          {letters.map((letter, index) => {
            const centre = centres[index];
            if (centre === undefined) return null;
            const traced = trace.includes(index);
            return (
              <View
                key={index}
                style={[styles.tile, { left: centre.x - tile / 2, top: centre.y - tile / 2 }]}
              >
                <PressedTile
                  testID={`${testID}-tile-${String(index)}`}
                  tone={traced ? 'accent' : 'tile'}
                  accessibilityLabel={texts.tileLabel(letter)}
                  accessibilityState={{ selected: traced }}
                  inert={!accessibleMode}
                  radius={crossingCrosswordLayout.tileRadius}
                  onPress={() => {
                    if (trace[trace.length - 1] === index) onStepBack();
                    else onExtend(index);
                  }}
                  faceStyle={styles.tileFace}
                >
                  <Text
                    {...voice}
                    maxFontSizeMultiplier={fontScaleCap.number}
                    style={[
                      typeStyle('crosswordLetter', tokens),
                      { color: traced ? colors.onAccent : colors.ink },
                    ]}
                  >
                    {letter}
                  </Text>
                </PressedTile>
              </View>
            );
          })}
          {coach && !accessibleMode && centres.length > 1 && (
            <Coach centres={centres} reduceMotion={reduceMotion} testID={`${testID}-coach`} />
          )}
        </View>
      </GestureDetector>
      {accessibleMode && (
        <Button
          variant="neutral"
          label={texts.check}
          disabled={trace.length === 0}
          onPress={onRelease}
          testID={`${testID}-check`}
        />
      )}
    </View>
  );
}

/** The hand coach: a fingertip sweeping from the first tile to the second, still under Reduce Motion. */
function Coach({
  centres,
  reduceMotion,
  testID,
}: {
  centres: readonly { x: number; y: number }[];
  reduceMotion: boolean;
  testID: string;
}) {
  const { colors } = useTokens();
  const from = centres[0] ?? { x: 0, y: 0 };
  const to = centres[1] ?? from;
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { ...STEP, duration: crossingCrosswordLayout.coachSweep }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, reduceMotion]);
  const size = crossingCrosswordLayout.coach;
  const moving = useAnimatedStyle(() => ({
    transform: [
      { translateX: from.x + (to.x - from.x) * progress.value - size / 2 },
      { translateY: from.y + (to.y - from.y) * progress.value - size / 2 },
    ],
  }));
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.coach,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.ink },
        moving,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wheelArea: { flexGrow: 1, alignItems: 'center', justifyContent: 'space-between' },
  slot: {
    alignSelf: 'stretch',
    minHeight: crossingCrosswordLayout.slot,
    marginTop: crossingCrosswordLayout.slotGap,
    gap: crossingCrosswordLayout.pathGap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  path: { flexDirection: 'row', gap: crossingCrosswordLayout.pathGap },
  chip: { minWidth: chip, height: chip, alignItems: 'center', justifyContent: 'center' },
  wheel: { width: wheel, height: wheel },
  disc: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: wheel / 2 },
  tile: { position: 'absolute', width: tile, height: tile },
  tileFace: { width: tile, height: tile, alignItems: 'center', justifyContent: 'center' },
  coach: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: crossingCrosswordLayout.coachRing,
    opacity: 0.6,
  },
});
