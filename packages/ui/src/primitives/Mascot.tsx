'use no memo';
import type { MascotFigure, MascotShape, MascotState } from '@slovo/contracts';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { useDecor } from '../decor/DecorProvider';
import { DecorView } from '../decor/DecorView';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import {
  mascotBleed,
  mascotMotion,
  mascotRayFlicker,
  mascotPose,
  mascotSleepMarks,
  mascotWidth,
  motion,
  space,
  typeStyle,
  type Easing as Curve,
  type MascotFrame,
} from '../tokens';

/** The colour of each paint role of the Mascot's vector. */
type Paints = Readonly<Record<'body' | 'ink' | 'accent', string>>;

/**
 * The Mascot (ADR 0070) in a state, drawn from the Edition's vector with its
 * design motion, and the Edition's short line for it under it. `onRed` draws
 * the variant for a red ground; `width` sets a smaller figure, such as the
 * Round's. `plate` sets the line on an ink plate in the surface colour, for
 * a Mascot over any screen, as a celebration is; the figure on it is never
 * the red variant. It is silent and takes no touch, so it never
 * stands in the reader's way. An Edition without a vector shows the line alone.
 */
export function Mascot({
  state,
  line,
  onRed = false,
  plate = false,
  width = mascotWidth,
  testID = `mascot-${state}`,
}: {
  state: MascotState;
  line?: string;
  /** The figure's width in points; the Mascot's own by default. */
  width?: number;
  testID?: string;
} & ({ onRed?: boolean; plate?: false } | { plate: true; onRed?: false })) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { mascot } = useDecor();
  return (
    <View testID={testID} pointerEvents="none" style={styles.mascot}>
      {mascot !== undefined && <Figure mascot={mascot} state={state} onRed={onRed} width={width} />}
      {line !== undefined && (
        <View
          testID={`${testID}-line`}
          style={
            plate
              ? [styles.plate, { backgroundColor: colors.ink, borderRadius: tokens.radii.chip }]
              : undefined
          }
        >
          <Text
            {...voice}
            testID={`${testID}-line-text`}
            style={[
              typeStyle('sub', tokens),
              styles.line,
              { color: plate ? colors.surface : onRed ? colors.onAccent : colors.muted },
            ]}
          >
            {line}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The figure in its state, moving as the design moves it. */
function Figure({
  mascot,
  state,
  onRed,
  width,
}: {
  mascot: MascotFigure;
  state: MascotState;
  onRed: boolean;
  width: number;
}) {
  const { colors } = useTokens();
  // The design's black on red is the light Theme's ink in both Themes, its cream the light background.
  const key = useSchemeColors('light');
  const inkOnRed = key.ink;
  const { mascotAccessory } = useDecor();
  const hatOff = state === 'hatOff';
  // The design's hat-off figure is muted on any ground, its eyes cream.
  const paints: Paints = onRed
    ? { body: hatOff ? colors.muted : key.background, ink: inkOnRed, accent: inkOnRed }
    : { body: hatOff ? colors.muted : colors.accent, ink: colors.ink, accent: colors.accent };
  const accessory = hatOff ? undefined : mascotAccessory;
  // An accessory worn instead of the hat is headwear: it drops as the hat does.
  const onHead = accessory?.replacesHat === true;
  const [pivotX, pivotY] = mascot.pivot;
  const turn = state === 'sad' ? mascotPose.sadTurn : hatOff ? mascotPose.hatOffTurn : 0;
  const hatDrop = state === 'cringes' ? mascotPose.cringeHatDrop : 0;
  const style = useFigureMotion(state);

  return (
    <DecorView>
      <Animated.View
        testID="mascot-figure"
        style={[styles.figure, { width, height: (width * mascot.height) / mascot.width }, style]}
      >
        <Canvas mascot={mascot} width={width}>
          <G transform={`rotate(${String(turn)} ${String(pivotX)} ${String(pivotY)})`}>
            <Shapes testID="mascot-body" shapes={mascot.figure} paints={paints} />
            {!hatOff && <Shapes testID="mascot-shine" shapes={mascot.shine} paints={paints} />}
            <Shapes testID="mascot-eyes" shapes={mascot.eyes[state]} paints={paints} />
            {!hatOff && !onHead && (
              <G transform={`translate(0 ${String(hatDrop)})`}>
                <Shapes testID="mascot-hat" shapes={mascot.hat} paints={paints} />
              </G>
            )}
            {accessory !== undefined && (
              <G transform={`translate(0 ${String(onHead ? hatDrop : 0)})`}>
                <Shapes testID="mascot-accessory" shapes={accessory.shapes} paints={paints} />
              </G>
            )}
          </G>
          {hatOff && (
            <Shapes testID="mascot-hat-on-ground" shapes={mascot.hatOnGround} paints={paints} />
          )}
          {state === 'celebrates' && (
            <Shapes testID="mascot-confetti" shapes={mascot.confetti} paints={paints} />
          )}
        </Canvas>
        {(state === 'shouts' || state === 'celebrates') && (
          <Rays mascot={mascot} paints={paints} width={width} />
        )}
        {state === 'sleeps' &&
          mascot.sleepMarks.map((shape, index) => (
            <SleepMark
              key={index}
              mascot={mascot}
              shape={shape}
              index={index}
              paints={paints}
              width={width}
            />
          ))}
      </Animated.View>
    </DecorView>
  );
}

/**
 * The vector's frame at `width`, laid out at the frame's size, with room past
 * it (`mascotBleed`) so parts the design lets overflow are never cut.
 */
function Canvas({
  mascot,
  width,
  children,
}: {
  mascot: MascotFigure;
  width: number;
  children: ReactNode;
}) {
  const scale = width / mascot.width;
  const boxWidth = mascot.width + 2 * mascotBleed;
  const boxHeight = mascot.height + 2 * mascotBleed;
  return (
    <Svg
      width={boxWidth * scale}
      height={boxHeight * scale}
      viewBox={`${String(-mascotBleed)} ${String(-mascotBleed)} ${String(boxWidth)} ${String(boxHeight)}`}
      testID="mascot-canvas"
      style={[styles.canvas, { left: -mascotBleed * scale, top: -mascotBleed * scale }]}
    >
      {children}
    </Svg>
  );
}

/** The rays of a shouting or celebrating figure, over it, flickering as the design's do. */
function Rays({ mascot, paints, width }: { mascot: MascotFigure; paints: Paints; width: number }) {
  const style = useRayFlicker();
  return (
    <Animated.View
      testID="mascot-rays-flicker"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Canvas mascot={mascot} width={width}>
        <Shapes testID="mascot-rays" shapes={mascot.rays} paints={paints} />
      </Canvas>
    </Animated.View>
  );
}

/** One mark of a sleeping figure, drifting up and fading as the design's `z` does. */
function SleepMark({
  mascot,
  shape,
  index,
  paints,
  width,
}: {
  mascot: MascotFigure;
  shape: MascotShape;
  index: number;
  paints: Paints;
  width: number;
}) {
  const style = useSleepMarkDrift(index, width / mascot.width);
  return (
    <Animated.View
      testID={`mascot-sleep-mark-${String(index)}-drift`}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Canvas mascot={mascot} width={width}>
        <Shape testID={`mascot-sleep-marks-${String(index)}`} shape={shape} paints={paints} />
      </Canvas>
    </Animated.View>
  );
}

/**
 * The drift of the `index`-th sleep mark (`mascotSleepMarks`), `scale` points
 * to the vector's unit. Until its delay it stands still and whole, as the
 * design's mark does; under Reduce Motion it stays so.
 */
function useSleepMarkDrift(index: number, scale: number) {
  const reduceMotion = useReduceMotion();
  // Below 0 the mark has not started.
  const cycle = useSharedValue(-1);
  const { duration, delays, easing, from, to } = mascotSleepMarks;
  const delay = delays[index] ?? 0;

  useEffect(() => {
    cancelAnimation(cycle);
    cycle.value = -1;
    if (reduceMotion) return;
    cycle.value = withDelay(
      delay,
      withSequence(
        withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }),
        withRepeat(
          withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
          -1,
        ),
      ),
    );
  }, [cycle, delay, duration, reduceMotion]);

  return useAnimatedStyle(() => {
    const t = cycle.value;
    if (t < 0) return { opacity: 1, transform: [] };
    const [x1, y1, x2, y2] = easing;
    const eased = Easing.bezierFn(x1, y1, x2, y2);
    const opacity = t < 0.5 ? eased(t * 2) : 1 - eased((t - 0.5) * 2);
    const rise = eased(t);
    return {
      opacity,
      transform: [
        { translateX: (from.x + (to.x - from.x) * rise) * scale },
        { translateY: (from.y + (to.y - from.y) * rise) * scale },
      ],
    };
  });
}

/** The rays' flicker (`mascotRayFlicker`), in steps; under Reduce Motion they hold still. */
function useRayFlicker() {
  const reduceMotion = useReduceMotion();
  const cycle = useSharedValue(0);
  const { duration, opacities } = mascotRayFlicker;

  useEffect(() => {
    cancelAnimation(cycle);
    cycle.value = 0;
    if (reduceMotion) return;
    cycle.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
    );
  }, [cycle, duration, reduceMotion]);

  return useAnimatedStyle(() => {
    const step = Math.min(opacities.length - 1, Math.floor(cycle.value * opacities.length));
    return { opacity: opacities[step] ?? 1 };
  });
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
      {shapes.map((shape, index) => (
        <Shape key={index} testID={`${testID}-${String(index)}`} shape={shape} paints={paints} />
      ))}
    </G>
  );
}

/** One shape of the vector, filled or stroked in the colour its paint resolves to. */
function Shape({ shape, paints, testID }: { shape: MascotShape; paints: Paints; testID: string }) {
  return 'fill' in shape ? (
    <Path
      testID={testID}
      d={shape.path}
      fill={paintOf(shape.fill, paints)}
      opacity={shape.opacity ?? 1}
    />
  ) : (
    <Path
      testID={testID}
      d={shape.path}
      fill="none"
      stroke={paintOf(shape.stroke, paints)}
      strokeWidth={shape.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={shape.opacity ?? 1}
    />
  );
}

/** A design easing curve as Reanimated takes it. */
function curve([x1, y1, x2, y2]: Curve) {
  return Easing.bezier(x1, y1, x2, y2);
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
        easing: curve(motion.reduceMotion.easing),
        reduceMotion: ReduceMotion.Never,
      });
      return;
    }
    shown.value = 1;
    if (plan === undefined) return;
    // As in CSS, the easing shapes each step between two frames.
    const steps = plan.frames.slice(1).map((frame, index) =>
      withTiming(frame.at, {
        duration: (frame.at - (plan.frames[index]?.at ?? 0)) * plan.duration,
        easing: curve(plan.easing),
        reduceMotion: ReduceMotion.Never,
      }),
    );
    const [first, ...rest] = steps;
    if (first === undefined) return;
    const cycle = rest.length === 0 ? first : withSequence(first, ...rest);
    progress.value =
      plan.repeat === 'once' ? cycle : withRepeat(cycle, -1, plan.repeat === 'alternate');
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
  canvas: { position: 'absolute' },
  line: { textAlign: 'center' },
  plate: { paddingHorizontal: space[3], paddingVertical: space[2] },
});
