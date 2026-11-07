'use no memo';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import {
  crosswordLayout,
  crossingCrosswordLayout,
  minTouchTarget,
  motion,
  typeStyle,
} from '../tokens';
import { ease } from './round-motion';

/** How far the largest text sizes of iOS may scale a cell's letter or number, so it stays inside its cell. */
const CELL_MAX_FONT_SCALE = 1.3;

/**
 * A cell of the crossing Daily Crossword's grid: a block, or a white cell
 * with its letter (pre-filled or filled), the number of the Words that start
 * there, whether it is in the current Word or in a solved one, and what
 * VoiceOver reads for it.
 */
/** A cell of the grid, by its row and column from 0, from the top left corner. */
export interface CrosswordPlace {
  readonly row: number;
  readonly column: number;
}

export type CrossingGridCell =
  | { readonly kind: 'block' }
  | {
      readonly kind: 'cell';
      readonly letter: string | undefined;
      readonly number: number | undefined;
      readonly current: boolean;
      readonly solved: boolean;
      readonly label: string;
    };

const POP_UP = {
  duration: motion.pop.duration / 2,
  easing: ease,
  reduceMotion: ReduceMotion.Never,
};

/**
 * The crossing Daily Crossword's grid (ADR 0087, board 08): blocks in ink,
 * white cells with their numbers and letters, the current Word's cells
 * highlighted and a solved Word's cells red, with a short pop as they turn,
 * calmed under Reduce Motion. A tap on a white cell asks `onSelect`; the grid
 * holds no rules.
 */
export function CrossingGrid({
  cells,
  onSelect,
  testID,
}: {
  cells: readonly (readonly CrossingGridCell[])[];
  onSelect: (place: CrosswordPlace) => void;
  testID: string;
}) {
  const { colors, radii } = useTokens();
  return (
    <View testID={testID} style={styles.grid}>
      {cells.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) =>
            cell.kind === 'block' ? (
              <View
                key={c}
                testID={`${testID}-${String(r)}-${String(c)}-block`}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.cell, { backgroundColor: colors.ink, borderRadius: radii.tile }]}
              />
            ) : (
              <Cell
                key={c}
                testID={`${testID}-${String(r)}-${String(c)}`}
                cell={cell}
                onPress={() => {
                  onSelect({ row: r, column: c });
                }}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/** A white cell: a tile that pops once as its Word is solved. */
function Cell({
  testID,
  cell,
  onPress,
}: {
  testID: string;
  cell: Extract<CrossingGridCell, { kind: 'cell' }>;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const shownSolved = useRef(cell.solved);
  useEffect(() => {
    if (!cell.solved) {
      shownSolved.current = false;
      return;
    }
    if (shownSolved.current) return;
    shownSolved.current = true;
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(crossingCrosswordLayout.pop, POP_UP),
      withTiming(1, POP_UP),
    );
  }, [cell.solved, reduceMotion, scale]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ink = cell.solved ? colors.onAccent : colors.ink;

  return (
    <Animated.View style={popStyle}>
      <PressedTile
        testID={testID}
        tone={cell.solved ? 'accent' : 'tile'}
        accessibilityLabel={cell.label}
        accessibilityState={{ selected: cell.current }}
        onPress={onPress}
        faceStyle={[
          styles.cell,
          cell.solved && { backgroundColor: colors.correct },
          !cell.solved && cell.current && { backgroundColor: colors.highlight },
          cell.current && { borderWidth: crosswordLayout.ring, borderColor: colors.ink },
        ]}
      >
        {cell.number !== undefined && (
          <Text
            maxFontSizeMultiplier={CELL_MAX_FONT_SCALE}
            style={[typeStyle('crosswordCellNumber', tokens), styles.cellNumber, { color: ink }]}
          >
            {String(cell.number)}
          </Text>
        )}
        <Text
          {...voice}
          maxFontSizeMultiplier={CELL_MAX_FONT_SCALE}
          style={[typeStyle('crosswordLetter', tokens), { color: ink }]}
        >
          {cell.letter ?? ''}
        </Text>
      </PressedTile>
    </Animated.View>
  );
}

/**
 * The ink clue bar over the crossing Daily Crossword's grid: the current
 * Word's number and direction on a red chip, its clue, read with both, and
 * «next», which moves to the next open Word.
 */
export function CrossingClueBar({
  number,
  clue,
  label,
  next,
  onNext,
  testID,
}: {
  /** The chip, such as «1→». */
  number: string;
  clue: string;
  /** What VoiceOver reads for the clue: its number, direction and clue. */
  label: string;
  /** What VoiceOver reads for «next», such as «Наступне слово». */
  next: string;
  onNext: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      style={[styles.clueBar, { backgroundColor: colors.ink, borderRadius: radii.tile }]}
    >
      <View
        accessible
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        {...voice}
        style={styles.clueText}
      >
        <View style={[styles.clueNumber, { backgroundColor: colors.accent }]}>
          <Text
            maxFontSizeMultiplier={CELL_MAX_FONT_SCALE}
            style={[typeStyle('crosswordClueNumber', tokens), { color: colors.onAccent }]}
          >
            {number}
          </Text>
        </View>
        <Text
          testID={`${testID}-clue`}
          style={[typeStyle('crosswordClue', tokens), styles.clue, { color: colors.background }]}
        >
          {clue}
        </Text>
      </View>
      <PressedTile
        testID={`${testID}-next`}
        tone="none"
        accessibilityLabel={next}
        onPress={onNext}
        faceStyle={styles.next}
      >
        <Text style={[typeStyle('crosswordClueNumber', tokens), { color: colors.background }]}>
          →
        </Text>
      </PressedTile>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: crosswordLayout.cellGap, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: crosswordLayout.cellGap },
  cell: {
    width: crossingCrosswordLayout.cell,
    height: crossingCrosswordLayout.cell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNumber: {
    position: 'absolute',
    left: crosswordLayout.cellNumberLeft,
    top: crosswordLayout.cellNumberTop,
  },
  clueBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: crosswordLayout.clueGap,
    minHeight: crosswordLayout.keyHeight,
    padding: crosswordLayout.cluePadding,
  },
  clueText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: crosswordLayout.clueGap },
  clueNumber: {
    minWidth: crosswordLayout.clueNumber.minWidth,
    height: crosswordLayout.clueNumber.height,
    borderRadius: crosswordLayout.clueNumber.radius,
    paddingHorizontal: crosswordLayout.clueNumber.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clue: { flex: 1 },
  next: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
