'use no memo';
import type { MascotFigure, MascotShape, MascotState } from '@slovo/contracts';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { useDecor } from '../decor/DecorProvider';
import { DecorView } from '../decor/Motif';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import {
  mascotMotion,
  mascotPose,
  mascotWidth,
  motion,
  space,
  typeSize,
  type MascotFrame,
} from '../tokens';

/** The colour of each paint role of the Mascot's vector. */
type Paints = Readonly<Record<'body' | 'ink' | 'accent', string>>;

/**
 * The Mascot (ADR 0070) in a state, drawn from the Edition's vector with its
 * design motion, and the Edition's short line for it under it. `onRed` draws
 * the variant for a red ground. It is silent and takes no touch, so it never
 * stands in the reader's way. An Edition without a vector shows the line alone.
 */
export function Mascot({
  state,
  line,
  onRed = false,
  testID = `mascot-${state}`,
}: {
  state: MascotState;
  line?: string;
  onRed?: boolean;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const { mascot } = useDecor();
  return (
    <View testID={testID} pointerEvents="none" style={styles.mascot}>
      {mascot !== undefined && <Figure mascot={mascot} state={state} onRed={onRed} />}
      {line !== undefined && (
        <Text
          {...voice}
          style={[
            styles.line,
            { color: onRed ? colors.onAccent : colors.muted, fontFamily: fontFamilies.ui },
          ]}
        >
          {line}
        </Text>
      )}
    </View>
  );
}

/** The figure in its state, moving as the design moves it. */
function Figure({
  mascot,
  state,
  onRed,
}: {
  mascot: MascotFigure;
  state: MascotState;
  onRed: boolean;
}) {
  const { colors } = useTokens();
  // The design's black on red is the light Theme's ink in both Themes.
  const inkOnRed = useSchemeColors('light').ink;
  const { mascotAccessory } = useDecor();
  const paints: Paints = onRed
    ? { body: colors.onAccent, ink: inkOnRed, accent: inkOnRed }
    : {
        body: state === 'hatOff' ? colors.muted : colors.accent,
        ink: colors.ink,
        accent: colors.accent,
      };
  const hatOff = state === 'hatOff';
  const accessory = hatOff ? undefined : mascotAccessory;
  const [pivotX, pivotY] = mascot.pivot;
  const turn = state === 'sad' ? mascotPose.sadTurn : hatOff ? mascotPose.hatOffTurn : 0;
  const hatDrop = state === 'cringes' ? mascotPose.cringeHatDrop : 0;
  const style = useFigureMotion(state);

  return (
    <DecorView>
      <Animated.View testID="mascot-figure" style={[styles.figure, style]}>
        <Svg
          width={mascotWidth}
          height={(mascotWidth * mascot.height) / mascot.width}
          viewBox={`0 0 ${String(mascot.width)} ${String(mascot.height)}`}
        >
          {(state === 'shouts' || state === 'celebrates') && (
            <Shapes testID="mascot-rays" shapes={mascot.rays} paints={paints} />
          )}
          <G transform={`rotate(${String(turn)} ${String(pivotX)} ${String(pivotY)})`}>
            <Shapes testID="mascot-body" shapes={mascot.figure} paints={paints} />
            {!hatOff && <Shapes testID="mascot-shine" shapes={mascot.shine} paints={paints} />}
            <Shapes testID="mascot-eyes" shapes={mascot.eyes[state]} paints={paints} />
            {!hatOff && accessory?.replacesHat !== true && (
              <G transform={`translate(0 ${String(hatDrop)})`}>
                <Shapes testID="mascot-hat" shapes={mascot.hat} paints={paints} />
              </G>
            )}
            {accessory !== undefined && (
              <Shapes testID="mascot-accessory" shapes={accessory.shapes} paints={paints} />
            )}
          </G>
          {hatOff && (
            <Shapes testID="mascot-hat-on-ground" shapes={mascot.hatOnGround} paints={paints} />
          )}
          {state === 'celebrates' && (
            <Shapes testID="mascot-confetti" shapes={mascot.confetti} paints={paints} />
          )}
          {state === 'sleeps' && (
            <Shapes testID="mascot-sleep-marks" shapes={mascot.sleepMarks} paints={paints} />
          )}
        </Svg>
      </Animated.View>
    </DecorView>
  );
}

/** One part of the vector, each shape in the colour its paint resolves to. */
function Shapes({
  shapes,
  paints,
  testID,
}: {
  shapes: readonly MascotShape[];
  paints: Paints;
  testID: string;
}) {
  return (
    <G testID={testID}>
      {shapes.map((shape, index) =>
        'fill' in shape ? (
          <Path
            key={index}
            testID={`${testID}-${String(index)}`}
            d={shape.path}
            fill={paintOf(shape.fill, paints)}
            opacity={shape.opacity}
          />
        ) : (
          <Path
            key={index}
            testID={`${testID}-${String(index)}`}
            d={shape.path}
            fill="none"
            stroke={paintOf(shape.stroke, paints)}
            strokeWidth={shape.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={shape.opacity}
          />
        ),
      )}
    </G>
  );
}

function paintOf(paint: string, paints: Paints): string {
  return paint === 'body' || paint === 'ink' || paint === 'accent' ? paints[paint] : paint;
}

/**
 * The figure's motion in `state` (`mascotMotion`); under Reduce Motion a
 * single fade in place instead, and the hat-off state stays still.
 */
function useFigureMotion(state: MascotState) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const shown = useSharedValue(reduceMotion ? 0 : 1);
  const plan = reduceMotion ? undefined : mascotMotion[state];

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (reduceMotion) {
      shown.value = 0;
      shown.value = withTiming(1, {
        duration: motion.reduceMotion.duration,
        easing: Easing.bezier(...motion.reduceMotion.easing),
        reduceMotion: ReduceMotion.Never,
      });
      return;
    }
    shown.value = 1;
    if (plan === undefined) return;
    const timing = withTiming(1, {
      duration: plan.duration,
      easing: Easing.bezier(...plan.easing),
      reduceMotion: ReduceMotion.Never,
    });
    progress.value =
      plan.repeat === 'once' ? timing : withRepeat(timing, -1, plan.repeat === 'alternate');
  }, [plan, progress, reduceMotion, shown]);

  return useAnimatedStyle(() => {
    if (plan === undefined) return { opacity: shown.value, transform: [] };
    const at = plan.frames.map((frame) => frame.at);
    const channel = (pick: (frame: MascotFrame) => number) =>
      interpolate(progress.value, at, plan.frames.map(pick));
    return {
      opacity: shown.value,
      transform: [
        { translateY: channel((frame) => frame.y ?? 0) },
        { rotate: `${String(channel((frame) => frame.rotate ?? 0))}deg` },
        { scaleX: channel((frame) => frame.scaleX ?? 1) },
        { scaleY: channel((frame) => frame.scaleY ?? 1) },
      ],
    };
  });
}

const styles = StyleSheet.create({
  mascot: { alignItems: 'center', gap: space[2], padding: space[4] },
  // The design turns the figure about 30% across and 60% down.
  figure: { transformOrigin: '30% 60%' },
  line: { fontSize: typeSize.body, fontWeight: '500', textAlign: 'center' },
});
