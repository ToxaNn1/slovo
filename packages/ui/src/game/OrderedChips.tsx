'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { ChipLayout, FixedChip, RoundAnswer } from '@slovo/core';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { Button } from '../primitives/Button';
import { PressedTile } from '../primitives/PressedTile';
import { fontScaleCap, motion, orderedChipsLayout, space, typeStyle } from '../tokens';
import { ease, RIGHT_FILL, WRONG_FILL } from './round-motion';

/** The columns letter tiles stand in (board 07). */
const TILE_COLUMNS = 4;
/** How faint a chip placed in the line stays among the shuffled ones. */
const PLACED_OPACITY = 0.25;

/**
 * Letter tiles as board 07 g2 draws them: a slot's size, corner and edge,
 * a tile's height, how faint a used tile stays, and the pop of a filled
 * slot, from 0.6 over 1.12 back to its size.
 */
const tileLook = {
  slotWidth: 42,
  slotHeight: 56,
  slotRadius: 12,
  slotEdge: 3,
  filledEdge: 4,
  tileHeight: 62,
  usedOpacity: 0.35,
  pop: { from: 0.6, over: 1.12 },
} as const;

/** A filled slot's pop, peaking at 60% of the design's pop (`slPop`); Reduce Motion leaves it out. */
const POP_UP = {
  duration: motion.pop.duration * 0.6,
  easing: ease,
  reduceMotion: ReduceMotion.Never,
};
const POP_DOWN = {
  duration: motion.pop.duration * 0.4,
  easing: ease,
  reduceMotion: ReduceMotion.Never,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The answer to a Round of the chips form. */
type ChipsAnswer = Extract<RoundAnswer, { form: 'chips' }>;

/** How a judged answer shows in the line; nothing before the answer. */
type Judged = 'right' | 'wrong' | undefined;

/**
 * The chips of a Round of the chips form, letters of a Word or words of an
 * expression, shuffled on tiles, and the answer line over them, a dashed
 * place for each chip. A tap moves a chip to the first empty place and a tap
 * in the line puts it back; the last chip gives the answer, the chips'
 * places in the order tapped. Once the answer is judged, a right line turns
 * red and a wrong one sinks, nothing shaking; the screen plays the answer's
 * haptic. VoiceOver reads every chip by its text, the line's in the order
 * placed, and skips the empty places. A character that stays in place, such
 * as an apostrophe, is no chip: it shows in the line once the chips before
 * it are there. As letter tiles (board 07 g2), the tiles stand in capitals,
 * in the Edition's locale, on a full-width grid of 4 columns, decoys among
 * them, under a sunken slot for each letter of the answer; a filled slot
 * turns red with a pop at once, its tile fades, and a tap on it gives the
 * letter back; the last slot filled gives the answer. With an erase label,
 * a key under the chips takes back the last chip placed, as «Анаграми» does
 * (spec #1674); it takes nothing from an empty line or a given answer. With
 * `showsRight`, a wrong answer shows the right chips in the line (board 06,
 * «Анаграми»). Words in a line
 * (board 07 g6, «Склади вислів») take their line in a sunken box, the words
 * placed on ink and only the next place dashed, and a placed word leaves an
 * empty dashed place among the chips. In the assembly field (spec #1880,
 * «Склади вислів» with decoys) the box holds the words placed and one dashed
 * mark for the next, a used word fades in its place among the chips, and the
 * last chip gives no answer: the check key gives the chips placed so far.
 * Key it by the Round, so a new Round starts with an empty line.
 */
export function OrderedChips({
  chips,
  kind,
  fixed = [],
  layout = 'line',
  slots = chips.length,
  eraseLabel,
  showsRight = false,
  checkLabel,
  answer,
  onAnswer,
}: {
  /** The chips, in the order shown. */
  chips: readonly string[];
  /** Whether the chips are a Word's letters or an expression's words, which sets their size. */
  kind: 'letter' | 'word';
  /** The characters that stay in place among the chips; none when left out. */
  fixed?: readonly FixedChip[] | undefined;
  /** A line of places or letter tiles in 4 columns: a line when left out. */
  layout?: ChipLayout | undefined;
  /** How many places the answer takes, every chip but the decoys: one for each chip when left out. */
  slots?: number | undefined;
  /** The key that takes back the last chip placed, e.g. «← Стерти літеру»; no key when left out. */
  eraseLabel?: string | undefined;
  /** Whether a wrong answer shows the right chips in the line, in place of the ones tapped. */
  showsRight?: boolean;
  /** The key under the assembly field that gives the answer, e.g. «Перевірити»; the field alone has one. */
  checkLabel?: string | undefined;
  /** The Round's answer, once given. */
  answer: ChipsAnswer | undefined;
  /** The places of the chips, in the order tapped, once every place of the line is filled, or on the check in the field. */
  onAnswer: (chosen: number[]) => void;
}) {
  const [tapped, setTapped] = useState<readonly number[]>([]);
  const line = answer?.chosen ?? tapped;
  const judged: Judged = answer === undefined ? undefined : answer.right ? 'right' : 'wrong';
  const { colors, radii } = useTokens();
  const { voice } = useEdition();
  const field = layout === 'field';
  /** Words in a line or in the field, which take board 07 g6's look. */
  const words = kind === 'word' && layout !== 'tiles';
  const tiles = layout === 'tiles';
  /** The places the line shows: the field's placed chips and, before the answer, a mark for the next while chips are left. */
  const places = !field
    ? slots
    : answer === undefined
      ? Math.min(line.length + 1, chips.length)
      : line.length;
  /** A chip's text as it shows: letter tiles in capitals, in the Edition's locale. */
  const shown = (text: string) =>
    tiles ? text.toLocaleUpperCase(voice.accessibilityLanguage) : text;

  return (
    <View testID="chips" style={styles.chips}>
      <View
        testID="chips-line"
        style={[
          styles.line,
          words && [
            styles.box,
            { backgroundColor: colors.surfaceSunken, borderRadius: radii.card },
          ],
        ]}
      >
        {Array.from({ length: places }, (_, index) => {
          const place = line[index];
          return (
            <Fragment key={index}>
              {index <= line.length &&
                fixed
                  .filter(({ at }) => at === index)
                  .map(({ text }, mark) => <FixedMark key={mark} text={text} kind={kind} />)}
              {place === undefined ? (
                <EmptySlot
                  index={index}
                  kind={kind}
                  edge={tiles ? 'sunken' : !words || index === line.length ? 'dashed' : 'none'}
                />
              ) : (
                <LineChip
                  key={place}
                  index={index}
                  text={shown(
                    (judged === 'wrong' && showsRight ? answer?.expected[index] : chips[place]) ??
                      '',
                  )}
                  kind={kind}
                  judged={judged}
                  onInk={words}
                  tile={tiles}
                  disabled={answer !== undefined}
                  onPress={() => {
                    setTapped(tapped.filter((other) => other !== place));
                  }}
                />
              )}
            </Fragment>
          );
        })}
        {line.length === places &&
          fixed
            .filter(({ at }) => at === places)
            .map(({ text }, mark) => <FixedMark key={mark} text={text} kind={kind} />)}
      </View>
      <Tray tiles={tiles}>
        {chips.map((text, place) => {
          const placed = line.includes(place);
          return (
            <Chip
              key={place}
              testID={`chips-${String(place)}`}
              text={shown(text)}
              kind={kind}
              placed={placed}
              leavesPlace={words && !field}
              tile={tiles}
              inert={placed || answer !== undefined}
              onPress={() => {
                const next = [...tapped, place];
                setTapped(next);
                if (!field && next.length === slots) onAnswer(next);
              }}
            />
          );
        })}
      </Tray>
      {field && checkLabel !== undefined && (
        <Button
          label={checkLabel}
          disabled={line.length === 0 || answer !== undefined}
          testID="chips-check"
          onPress={() => {
            onAnswer([...tapped]);
          }}
        />
      )}
      {eraseLabel !== undefined && (
        <Button
          variant="ghost"
          size="small"
          label={eraseLabel}
          disabled={line.length === 0 || answer !== undefined}
          testID="chips-erase"
          onPress={() => {
            setTapped(tapped.slice(0, -1));
          }}
        />
      )}
    </View>
  );
}

/** The chips under the line: wrapped and centred, or letter tiles in full-width rows of 4. */
function Tray({ tiles, children }: { tiles: boolean; children: ReactNode[] }) {
  if (!tiles) return <View style={styles.tray}>{children}</View>;
  const rows = Array.from({ length: Math.ceil(children.length / TILE_COLUMNS) }, (_, row) =>
    children.slice(row * TILE_COLUMNS, (row + 1) * TILE_COLUMNS),
  );
  return (
    <View style={styles.tiles}>
      {rows.map((row, index) => (
        <View key={index} testID={`chips-row-${String(index)}`} style={styles.tileRow}>
          {row}
        </View>
      ))}
    </View>
  );
}

/**
 * An empty place of the answer line, dashed, a sunken slot of letter tiles,
 * or a place of words not next, with no edge; VoiceOver skips it. It carries
 * `chips-slot-${index}`.
 */
function EmptySlot({
  index,
  kind,
  edge,
}: {
  index: number;
  kind: 'letter' | 'word';
  edge: 'dashed' | 'sunken' | 'none';
}) {
  const { colors } = useTokens();
  if (edge === 'sunken')
    return (
      <View
        testID={`chips-slot-${String(index)}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.tileSlot,
          {
            backgroundColor: colors.surfaceSunken,
            boxShadow: `inset 0 ${String(tileLook.slotEdge)}px 0 ${colors.tileEdge}`,
          },
        ]}
      />
    );
  return (
    <View
      testID={`chips-slot-${String(index)}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.slot,
        kind === 'letter' ? styles.letter : styles.word,
        edge === 'dashed'
          ? { borderColor: colors.line, borderStyle: 'dashed' }
          : { borderColor: 'transparent', borderStyle: 'solid' },
      ]}
    />
  );
}

/**
 * A chip among the shuffled ones, on a pressed tile. Once placed in the line
 * it stays faint in its place, or leaves an empty dashed place there, takes
 * no tap, and VoiceOver skips it. A letter tile fills its column, and once
 * used it fades on the sunken fill with no edge.
 */
function Chip({
  testID,
  text,
  kind,
  placed,
  leavesPlace,
  tile,
  inert,
  onPress,
}: {
  testID: string;
  text: string;
  kind: 'letter' | 'word';
  placed: boolean;
  /** Whether a placed chip leaves an empty dashed place rather than staying faint. */
  leavesPlace: boolean;
  /** Whether the chip is a letter tile of board 07 g2. */
  tile: boolean;
  inert: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      accessibilityElementsHidden={placed}
      importantForAccessibility={placed ? 'no-hide-descendants' : 'auto'}
      testID={placed && leavesPlace ? `${testID}-place` : undefined}
      style={[
        tile && styles.tileColumn,
        placed &&
          (leavesPlace
            ? [styles.left, { borderColor: colors.line }]
            : tile
              ? styles.used
              : styles.placed),
      ]}
      {...voice}
    >
      <View style={placed && leavesPlace && styles.gone}>
        <PressedTile
          testID={testID}
          tone={tile && placed ? 'none' : 'tile'}
          radius={orderedChipsLayout.chipRadius}
          accessibilityLabel={text}
          accessibilityState={{ disabled: inert }}
          inert={inert}
          onPress={onPress}
          faceStyle={
            tile
              ? [
                  styles.tileFace,
                  { borderColor: colors.line },
                  placed && { backgroundColor: colors.surfaceSunken },
                ]
              : [styles.chip, kind === 'letter' ? styles.letter : styles.word]
          }
        >
          <ChipText text={text} kind={kind} color={colors.ink} />
        </PressedTile>
      </View>
    </View>
  );
}

/**
 * A chip in the answer line, in a place bordered in ink, or on ink. A right
 * answer turns the line red, a wrong one sinks it; nothing shakes. A letter
 * tile's slot turns red with a pop as it fills (Reduce Motion leaves the
 * pop out), stays red at a right answer and sinks at a wrong one.
 */
function LineChip({
  index,
  text,
  kind,
  judged,
  onInk,
  tile,
  disabled,
  onPress,
}: {
  /** Its place in the line. */
  index: number;
  text: string;
  kind: 'letter' | 'word';
  judged: Judged;
  /** Whether the chip lies on ink, its text in the tile's colour, before the answer. */
  onInk: boolean;
  /** Whether the chip fills a letter tile's slot of board 07 g2. */
  tile: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the chip has turned. */
  const turned = useSharedValue(judged === undefined ? 0 : 1);
  const scale = useSharedValue(1);
  // Whether the chip showed the answer before, so only the answer given now moves it.
  const shownJudged = useRef(judged !== undefined);

  useEffect(() => {
    if (judged === undefined || shownJudged.current) return;
    shownJudged.current = true;
    turned.value = withTiming(1, judged === 'right' ? RIGHT_FILL : WRONG_FILL);
    // The shared value is stable, so only the answer given turns the chip.
  }, [judged, turned]);

  // A letter tile's slot pops once, as it fills; a slot shown with its answer does not.
  const popped = useRef(!tile || judged !== undefined);
  useEffect(() => {
    if (popped.current) return;
    popped.current = true;
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(tileLook.pop.from, { duration: 0, reduceMotion: ReduceMotion.Never }),
      withTiming(tileLook.pop.over, POP_UP),
      withTiming(1, POP_DOWN),
    );
  }, [reduceMotion, scale]);

  const base = tile ? colors.accent : onInk ? colors.ink : colors.tile;
  const edge = tile ? colors.accentEdge : colors.ink;
  const face = judged === 'right' ? colors.accent : colors.surfaceSunken;
  const border = judged === 'right' ? colors.accentEdge : colors.ink;
  const motion = useAnimatedStyle(() =>
    judged === undefined
      ? { transform: [{ scale: scale.value }] }
      : {
          transform: [{ scale: scale.value }],
          backgroundColor: interpolateColor(turned.value, [0, 1], [base, face]),
          borderColor: interpolateColor(turned.value, [0, 1], [edge, border]),
        },
  );
  return (
    <AnimatedPressable
      testID={`chips-line-${String(index)}`}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled }}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      style={[
        tile
          ? [
              styles.tileSlot,
              {
                backgroundColor: base,
                borderColor: edge,
                boxShadow:
                  judged === 'wrong'
                    ? undefined
                    : `0 ${String(tileLook.filledEdge)}px 0 ${colors.accentEdge}`,
              },
            ]
          : [
              styles.slot,
              kind === 'letter' ? styles.letter : styles.word,
              { backgroundColor: base, borderColor: colors.ink, borderStyle: 'solid' },
            ],
        motion,
      ]}
    >
      <ChipText
        text={text}
        kind={kind}
        color={
          judged === 'right' || (tile && judged === undefined)
            ? keyInk
            : onInk && judged === undefined
              ? colors.tile
              : colors.ink
        }
      />
    </AnimatedPressable>
  );
}

/** A character in place in the answer line, such as an apostrophe: no chip, never tapped. */
function FixedMark({ text, kind }: { text: string; kind: 'letter' | 'word' }) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.mark} {...voice}>
      <ChipText text={text} kind={kind} color={colors.ink} />
    </View>
  );
}

function ChipText({ text, kind, color }: { text: string; kind: 'letter' | 'word'; color: string }) {
  const tokens = useTokens();
  return (
    <Text
      maxFontSizeMultiplier={fontScaleCap.text}
      style={[typeStyle(kind === 'letter' ? 'chipLetter' : 'chipWord', tokens), { color }]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  chips: { gap: orderedChipsLayout.lineGap },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: orderedChipsLayout.chipGap,
  },
  tiles: { gap: orderedChipsLayout.chipGap },
  tileRow: { flexDirection: 'row', gap: orderedChipsLayout.chipGap },
  tileColumn: { flex: 1 },
  tileFace: {
    height: tileLook.tileHeight,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSlot: {
    width: tileLook.slotWidth,
    height: tileLook.slotHeight,
    borderRadius: tileLook.slotRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  used: { opacity: tileLook.usedOpacity },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: orderedChipsLayout.chipGap,
  },
  slot: {
    height: orderedChipsLayout.slotHeight,
    borderWidth: orderedChipsLayout.slotBorder,
    borderRadius: orderedChipsLayout.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { height: orderedChipsLayout.chipHeight, alignItems: 'center', justifyContent: 'center' },
  letter: { minWidth: orderedChipsLayout.chipWidth, paddingHorizontal: space[1] },
  word: { minWidth: orderedChipsLayout.chipWidth, paddingHorizontal: space[4] },
  placed: { opacity: PLACED_OPACITY },
  box: { padding: space[3] },
  left: {
    borderWidth: orderedChipsLayout.slotBorder,
    borderStyle: 'dashed',
    borderRadius: orderedChipsLayout.chipRadius,
  },
  gone: { opacity: 0 },
  mark: { height: orderedChipsLayout.slotHeight, justifyContent: 'center' },
});
