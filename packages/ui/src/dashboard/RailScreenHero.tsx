'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { MascotState } from '@slovo/contracts';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { OnAccentProvider } from '../entries/on-accent';
import { HalftoneGround } from '../primitives/HalftoneGround';
import { Icon } from '../primitives/Icon';
import { Mascot } from '../primitives/Mascot';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import {
  motion,
  pressedFade,
  railScreen as place,
  space,
  typeStyle,
  withAlpha,
  type Wedge as WedgePoints,
} from '../tokens';
import { HeroBack, useHeroRoom } from './HeroBack';

/**
 * The hero of a screen a Dashboard rail's tile opens (board `SlovoApp`,
 * «fix» and «cat»): the red halftone ground cut at the bottom, the ink back
 * tile, the ink icon tile with the tile's red glyph beside the kicker, the
 * title, the description if the screen has one, the progress label over its skewed bar, and the
 * Mascot. Its right slot holds the button of the screen's kind: the toggle
 * of the Mix or of a Curated Collection's copy, or the Collection menu.
 */
export function RailScreenHero({
  id,
  glyph,
  kicker,
  title,
  description,
  progress,
  done,
  mascot,
  back,
  action,
}: {
  /** Unique on the screen: it names the raster and the test IDs. */
  id: string;
  /** The tile's glyph on the icon tile: a polygon or a `circle`. */
  glyph: WedgePoints | 'circle';
  kicker: string;
  title: string;
  /** What the screen gathers; none on a Collection's screen. */
  description?: string;
  /** «Розібрано 0 з 4», drawn in capitals. */
  progress: string;
  /** How much of the bar is filled, from 0 to 1. */
  done: number;
  mascot: MascotState;
  back: { label: string; onPress: () => void; testID?: string };
  /** The button at the top right, if the screen's kind has one. */
  action?: HeroAction;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { ink: keyInk, background: cream } = useSchemeColors('light');
  const { voice } = useEdition();
  const { width } = useWindowDimensions();
  const { shift, height, onLayout } = useHeroRoom(place.height);
  const text = (role: Parameters<typeof typeStyle>[0]) => [
    typeStyle(role, tokens),
    { color: keyInk },
  ];
  return (
    <View
      testID={id}
      style={{ minHeight: place.height + shift, paddingTop: place.column.top + shift }}
      onLayout={onLayout}
    >
      <HalftoneGround id={id} width={width} height={height} points={place.cut} />
      <OnAccentProvider value>
        <HeroBack id={id} back={back} place={place.back} shift={shift} tile={keyInk} ink={cream} />
        {action !== undefined && (
          <HeroActionButton id={id} action={action} top={place.add.top + shift} />
        )}
        {/* The column and the bar flow: the bar keeps the board's place unless the column reaches it. */}
        <View style={styles.columnRoom}>
          <View style={styles.column}>
            <View style={styles.kickerRow}>
              <View style={[styles.icon, { backgroundColor: keyInk }]}>
                {glyph === 'circle' ? (
                  <View style={[styles.circle, { backgroundColor: colors.accent }]} />
                ) : (
                  <Wedge
                    points={glyph}
                    color={colors.accent}
                    width={place.icon.glyph}
                    height={place.icon.glyph}
                  />
                )}
              </View>
              <Text {...voice} testID={`${id}-kicker`} style={text('railKicker')}>
                {kicker}
              </Text>
            </View>
            <Text {...voice} accessibilityRole="header" style={text('railTitle')}>
              {title}
            </Text>
            {description !== undefined && (
              <Text
                {...voice}
                testID={`${id}-description`}
                style={[text('railDescription'), styles.description]}
              >
                {description}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progress}>
            <Text {...voice} testID={`${id}-progress`} style={text('railProgress')}>
              {progress}
            </Text>
            <View
              style={[styles.bar, { backgroundColor: withAlpha(keyInk, place.progress.empty) }]}
            >
              {/* The filled part and the rest share the bar by flex: no percent string to build. */}
              <View style={{ flex: share(done), backgroundColor: keyInk }} />
              <View style={{ flex: 1 - share(done) }} />
            </View>
          </View>
          {/* The Mascot stands where the board has it beside the bar, and moves down with it. */}
          <View style={styles.mascot}>
            <Mascot state={mascot} onRed width={place.mascot.width} />
          </View>
        </View>
      </OnAccentProvider>
    </View>
  );
}

/**
 * The hero's right button: a toggle reads its label beside a plus, and once
 * on, beside a tick in reverse; the menu is an ink tile with the «more» glyph.
 */
export type HeroAction =
  | { kind: 'toggle'; label: string; on: boolean; onPress: () => void; testID?: string }
  | { kind: 'menu'; label: string; onPress: () => void; testID?: string };

function HeroActionButton({ id, action, top }: { id: string; action: HeroAction; top: number }) {
  const tokens = useTokens();
  const { ink: keyInk, background: cream } = useSchemeColors('light');
  const { voice } = useEdition();
  const common = {
    testID: action.testID ?? `${id}-action`,
    accessibilityRole: 'button',
    accessibilityLabel: action.label,
    ...voice,
    onPress: action.onPress,
  } as const;
  if (action.kind === 'menu') {
    return (
      <Pressable
        {...common}
        style={({ pressed }) => [
          styles.menu,
          { top, backgroundColor: keyInk },
          pressed && styles.pressed,
        ]}
      >
        <Icon name="more" size={place.back.icon} color={cream} />
      </Pressable>
    );
  }
  const { on } = action;
  return (
    <View style={[styles.addPlace, { top }]}>
      {/* The board's hard shadow, below the button and over the red, while it is off. */}
      {!on && (
        <View
          testID={`${common.testID}-edge`}
          style={[styles.addEdge, { backgroundColor: withAlpha(keyInk, place.add.edgeAlpha) }]}
        />
      )}
      <Pressable
        {...common}
        accessibilityRole="togglebutton"
        accessibilityState={{ checked: on }}
        style={({ pressed }) => [
          styles.add,
          { backgroundColor: on ? keyInk : cream },
          // A press lowers the button onto its shadow, as the board's `:active` does.
          pressed && !on && styles.addPressed,
        ]}
      >
        <ToggleIcon testID={`${common.testID}-icon`} on={on} color={on ? cream : keyInk} />
        <Text {...voice} style={[typeStyle('railAdd', tokens), { color: on ? cream : keyInk }]}>
          {action.label}
        </Text>
      </Pressable>
    </View>
  );
}

/** The board's `slPop`: the tick swells past its size and settles, in the canvas's `ease`. */
const TICK_POP = [0.6, 1.12, 1];
const TICK_POP_TIMING = {
  duration: place.add.popDuration,
  easing: Easing.bezier(...motion.pop.easing),
  reduceMotion: ReduceMotion.Never,
};

/**
 * The toggle's plus, or its tick once on. The tick pops in when the toggle
 * turns on while the screen is open, not when it opens already on; with
 * Reduce Motion it appears still.
 */
function ToggleIcon({ testID, on, color }: { testID: string; on: boolean; color: string }) {
  const reduceMotion = useReduceMotion();
  /** 0 as the tick appears, 1 once it rests. */
  const popped = useSharedValue(1);
  // Whether the toggle was on before, so only the press made now pops the tick.
  const wasOn = useRef(on);

  useEffect(() => {
    if (on && !wasOn.current && !reduceMotion) {
      popped.value = 0;
      popped.value = withTiming(1, TICK_POP_TIMING);
    }
    wasOn.current = on;
    // The shared value is stable, so only a change of `on` pops the tick.
  }, [on, reduceMotion, popped]);

  const pop = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(popped.value, [0, 0.6, 1], TICK_POP) }],
  }));
  return (
    <Animated.View testID={testID} style={pop}>
      <Wedge
        points={on ? place.addIcons.tick : place.addIcons.plus}
        color={color}
        width={place.add.icon}
        height={place.add.icon}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  addPlace: { position: 'absolute', right: place.add.right },
  addEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: place.add.edge,
    height: place.add.height,
    borderRadius: place.add.radius,
  },
  addPressed: { transform: [{ translateY: place.add.edge }] },
  add: {
    height: place.add.height,
    paddingHorizontal: place.add.paddingHorizontal,
    borderRadius: place.add.radius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: place.add.gap,
  },
  menu: {
    position: 'absolute',
    right: place.add.right,
    width: place.back.side,
    height: place.back.side,
    borderRadius: place.back.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: pressedFade },
  // From the column's top to the bar's on the board; a taller column grows it.
  columnRoom: { minHeight: place.progress.top - place.column.top },
  column: {
    marginLeft: place.column.left,
    marginRight: place.column.right,
    marginBottom: place.column.gap,
    gap: place.column.gap,
  },
  progressRow: { paddingBottom: place.bottom },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: place.column.kickerGap },
  icon: {
    width: place.icon.side,
    height: place.icon.side,
    borderRadius: place.icon.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: { width: place.icon.glyph, height: place.icon.glyph, borderRadius: place.icon.glyph / 2 },
  description: { maxWidth: place.column.descriptionWidth },
  progress: {
    marginLeft: place.progress.left,
    width: place.progress.width,
    gap: place.progress.gap,
  },
  bar: {
    flexDirection: 'row',
    height: place.progress.bar,
    transform: [{ skewX: place.progress.skew }],
  },
  // The Mascot pads its figure by `space[4]`; the board places the figure itself.
  mascot: {
    position: 'absolute',
    top: place.mascot.top - place.progress.top - space[4],
    right: place.mascot.right - space[4],
  },
});

/** How much of the bar is filled, clamped to 0 to 1. */
function share(done: number): number {
  return Math.min(1, Math.max(0, done));
}
