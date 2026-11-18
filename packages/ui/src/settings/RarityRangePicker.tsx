'use no memo';

import { fill } from '@slovo/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  type PanGestureConfig,
} from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useEdition } from '../providers/EditionProvider';
import { useHaptics } from '../providers/HapticsProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { motion, rarityRangeDrawing as drawing, settingsRowDrawing, typeStyle } from '../tokens';

/** Both ends of a Rarity Range, the lowest rarity first; they may be the same. */
export interface RarityRangeValue {
  readonly from: number;
  readonly to: number;
}

/**
 * Where a tap on the bar of `rarity` takes the range, among the rarities from
 * `lowest` to `highest`: a bar outside it pulls the nearer end out to it; an
 * end of a range of several bars leaves that rarity alone («лише 3»); a bar
 * inside moves the nearer end in to it, the top on a tie. A tap on the one bar
 * of a single rarity takes every rarity back.
 */
function tapped(
  range: RarityRangeValue,
  rarity: number,
  lowest: number,
  highest: number,
): RarityRangeValue {
  const { from, to } = range;
  if (rarity < from) return { from: rarity, to };
  if (rarity > to) return { from, to: rarity };
  if (from === to) return { from: lowest, to: highest };
  if (rarity === from || rarity === to) return { from: rarity, to: rarity };
  return rarity - from < to - rarity ? { from: rarity, to } : { from, to: rarity };
}

const same = (a: RarityRangeValue, b: RarityRangeValue) => a.from === b.from && a.to === b.to;

/**
 * «Рідкість» in Settings, the Rarity Range (ADR 0156): its heading and the
 * range it holds, «від 2 до 4» or «лише 3», over one slanted bar per rarity,
 * each taller than the last; the bars of the range are red; and a line under
 * them that says how a range is picked. A tap on a bar
 * moves the range as `tapped` says, from the range shown; a drag across the bars picks the range
 * from the bar it starts on to the one under the finger, shown as it goes and
 * handed to `onChange` when the finger lifts. A bar the range takes springs
 * up as it reddens, with a light haptic; under Reduce Motion it only fades.
 * It sits in a `SettingsGroup` with a row's padding.
 */
export function RarityRangePicker({
  rarities,
  range,
  onChange,
  testID,
}: {
  /** Every rarity, lowest first: one bar each. */
  rarities: readonly number[];
  range: RarityRangeValue;
  /** Keeps the range; the picker shows it until the promise it returns is done. */
  onChange: (range: RarityRangeValue) => Promise<void>;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const haptics = useHaptics();
  const texts = strings.settings.rarity;
  // A drag shows the range it spans (`draft`); a range handed over is shown
  // (`pending`) until `onChange` is done with it, as the range the screen
  // holds only changes once it is kept, some time later.
  const [draft, setDraft] = useState<RarityRangeValue | undefined>(undefined);
  const [pending, setPending] = useState<RarityRangeValue | undefined>(undefined);
  const held = pending ?? range;
  const shown = draft ?? held;
  const handed = useRef(0);

  const hand = (next: RarityRangeValue) => {
    handed.current += 1;
    const turn = handed.current;
    setPending(next);
    void onChange(next).finally(() => {
      if (handed.current === turn) setPending(undefined);
    });
  };

  const latest = useRef({ held, draft, hand, haptics });
  useEffect(() => {
    latest.current = { held, draft, hand, haptics };
  });

  const tap = (rarity: number) => {
    const next = tapped(held, rarity, rarities[0] ?? rarity, rarities.at(-1) ?? rarity);
    if (same(next, held)) return;
    haptics.impactLight();
    hand(next);
  };

  // The drag runs on the UI thread and hands the bars it spans over by their places.
  const drag = useCallback(
    (start: number, end: number) => {
      const first = rarities[Math.min(start, end)];
      const last = rarities[Math.max(start, end)];
      if (first === undefined || last === undefined) return;
      const next = { from: first, to: last };
      const before = latest.current.draft ?? latest.current.held;
      if (same(next, before)) return;
      latest.current.haptics.impactLight();
      latest.current.draft = next;
      setDraft(next);
    },
    [rarities],
  );
  // The dragged range is handed over in the same render that drops the draft,
  // so the bars never show the range from before the drag in between.
  const release = useCallback(() => {
    const { draft: last, held: kept, hand: handOver } = latest.current;
    latest.current.draft = undefined;
    setDraft(undefined);
    if (last !== undefined && !same(last, kept)) handOver(last);
  }, []);

  const width = useSharedValue(0);
  const start = useSharedValue(-1);
  const count = rarities.length;
  const config = useMemo((): PanGestureConfig => {
    const place = (x: number) => {
      'worklet';
      if (width.value <= 0) return -1;
      return Math.min(count - 1, Math.max(0, Math.floor((x / width.value) * count)));
    };
    return {
      activeOffsetX: [-drawing.dragStart, drawing.dragStart],
      failOffsetY: [-drawing.scrollYield, drawing.scrollYield],
      onBegin: ({ x }) => {
        'worklet';
        start.value = place(x);
      },
      onUpdate: ({ x }) => {
        'worklet';
        const at = place(x);
        if (start.value < 0 || at < 0) return;
        scheduleOnRN(drag, start.value, at);
      },
      onFinalize: () => {
        'worklet';
        start.value = -1;
        scheduleOnRN(release);
      },
      // How a component test finds the drag; Gesture Handler reads it in Jest only.
      testID: `${testID}-drag`,
    };
  }, [count, drag, release, start, testID, width]);
  const pan = usePanGesture(config);

  const onLayout = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width;
  };

  return (
    <View testID={testID} style={styles.picker}>
      <View style={styles.header}>
        <Text {...voice} style={[typeStyle('rangeTitle', tokens), { color: colors.ink }]}>
          {texts.title}
        </Text>
        <Text
          {...voice}
          testID={`${testID}-value`}
          style={[typeStyle('rangeValue', tokens), { color: colors.ink }]}
        >
          {shown.from === shown.to
            ? fill(texts.single, { rarity: String(shown.from) })
            : fill(texts.range, { from: String(shown.from), to: String(shown.to) })}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View testID={`${testID}-bars`} style={styles.bars} onLayout={onLayout}>
          {rarities.map((rarity, index) => (
            <Bar
              key={rarity}
              rarity={rarity}
              height={drawing.barBase + index * drawing.barStep}
              tallest={drawing.barBase + (count - 1) * drawing.barStep}
              on={rarity >= shown.from && rarity <= shown.to}
              label={fill(texts.bar, { rarity: String(rarity) })}
              onPress={() => {
                tap(rarity);
              }}
              testID={`${testID}-bar-${String(rarity)}`}
            />
          ))}
        </View>
      </GestureDetector>
      <Text
        {...voice}
        testID={`${testID}-hint`}
        style={[typeStyle('hint', tokens), styles.hint, { color: colors.muted }]}
      >
        {texts.hint}
      </Text>
    </View>
  );
}

/** One rarity's slanted bar: red while the range takes it, springing up as it turns red. */
function Bar({
  rarity,
  height,
  tallest,
  on,
  label,
  onPress,
  testID,
}: {
  rarity: number;
  height: number;
  tallest: number;
  on: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const lit = useSharedValue(on ? 1 : 0);
  const rise = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    // The bars a screen opens on are drawn as they are, with no motion.
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) {
      lit.value = withTiming(on ? 1 : 0, { duration: motion.reduceMotion.duration });
      return;
    }
    const spring = { ...drawing.spring, reduceMotion: ReduceMotion.Never };
    lit.value = withSpring(on ? 1 : 0, { ...spring, overshootClamping: true });
    if (on) {
      rise.value = withSequence(
        withTiming(drawing.dip, { duration: motion.press.duration }),
        withSpring(1, spring),
      );
    }
  }, [lit, on, reduceMotion, rise]);

  const faceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(lit.value, [0, 1], [colors.line, colors.accent]),
    transform: [{ skewX: drawing.skew }, { scaleY: rise.value }],
  }));
  const numberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(lit.value, [0, 1], [colors.muted, colors.onAccent]),
  }));

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityLanguage={voice.accessibilityLanguage}
      accessibilityState={{ selected: on }}
      style={[styles.slot, { height: tallest }]}
    >
      <Animated.View style={[styles.face, { height }, faceStyle]}>
        <Animated.Text style={[typeStyle('rangeNumber', tokens), numberStyle]}>
          {String(rarity)}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // It sits in a Settings group as a row does.
  picker: {
    paddingVertical: settingsRowDrawing.paddingVertical,
    paddingHorizontal: settingsRowDrawing.paddingHorizontal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: drawing.headerGap,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: drawing.gap },
  hint: { marginTop: drawing.headerGap },
  slot: { flex: 1, justifyContent: 'flex-end' },
  face: {
    borderRadius: drawing.radius,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: drawing.numberInset,
    transformOrigin: 'bottom',
  },
});
