'use no memo';
import { STRESS_MARK } from '@slovo/contracts';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';

import { Button } from '../primitives/Button';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { crosswordLayout, fontScaleCap, tracedCrosswordLayout, typeStyle } from '../tokens';
import type { CrosswordPlace } from './CrossingGrid';
import { ease } from './round-motion';
import { useTraceDrag, type TraceHit } from './useTraceDrag';

/** A letter of the grid and whether it carries the Stress mark. */
export interface TracedLetter {
  readonly letter: string;
  readonly stressed: boolean;
}

/** A hidden Word as the reader sees it: its clue, and its cells once found. */
export type TracedWord =
  | { readonly kind: 'hidden'; readonly clue: string; readonly length: number }
  | { readonly kind: 'found'; readonly clue: string; readonly path: readonly CrosswordPlace[] };

/** A trace that locked no Word, which fades out; a new `key` plays it again. */
export interface TracedMiss {
  readonly key: number;
  readonly path: readonly CrosswordPlace[];
}

const samePlace = (a: CrosswordPlace, b: CrosswordPlace) =>
  a.row === b.row && a.column === b.column;

const shown = ({ letter, stressed }: TracedLetter) =>
  stressed ? `${letter}${STRESS_MARK}` : letter;

/**
 * The traced Daily Crossword (ADR 0073): a square grid full of letters with
 * their Stress marks, which the reader traces by finger. The drag runs on the
 * UI thread and hit-tests the cell under the finger by the grid's layout, in
 * the inner part of each cell so a diagonal passes between corners; a dotted
 * line follows the trace. The grid holds no rules: it asks `onExtend` for each
 * cell the finger reaches and `onRelease` when it lifts, and draws the trace
 * and the Words found that the screen passes back from the Core. A trace that
 * locked nothing (`miss`) fades out. In accessible mode the cells are buttons:
 * a tap extends the trace, a tap on its last cell steps back, and
 * «Перевірити» releases it. Under the grid, each Word's clue and its answer
 * tiles, filled once found.
 */
export function TracedCrosswordGrid({
  grid,
  words,
  trace,
  miss,
  accessibleMode,
  onExtend,
  onStepBack,
  onRelease,
  texts,
  testID,
}: {
  grid: readonly (readonly TracedLetter[])[];
  words: readonly TracedWord[];
  /** The cells of the trace, first to last. */
  trace: readonly CrosswordPlace[];
  miss?: TracedMiss | undefined;
  /** Cells as buttons and «Перевірити», as with VoiceOver on. */
  accessibleMode: boolean;
  onExtend: (place: CrosswordPlace) => void;
  onStepBack: () => void;
  onRelease: () => void;
  texts: {
    /** What VoiceOver reads for a cell: its letter with its Stress mark and its place. */
    cellLabel: (letter: string, place: CrosswordPlace) => string;
    /** What VoiceOver reads for a clue: the clue, and the Word once found. */
    clueLabel: (clue: string, found: string | undefined) => string;
    /** «Перевірити». */
    check: string;
  };
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const size = grid.length;
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  // A row is a cell and its edge deep, a column a cell wide, so each has its own pitch.
  const columnStep = useSharedValue(0);
  const rowStep = useSharedValue(0);
  const gap = crosswordLayout.cellGap;
  const stepOf = (length: number) => (size === 0 ? 0 : (length + gap) / size);
  const found = (place: CrosswordPlace) =>
    words.some((word) => word.kind === 'found' && word.path.some((at) => samePlace(at, place)));
  const traced = (place: CrosswordPlace) => trace.some((at) => samePlace(at, place));

  const hit = useCallback(
    (x: number, y: number): TraceHit<CrosswordPlace> | undefined => {
      'worklet';
      const across = columnStep.value;
      const down = rowStep.value;
      if (across <= 0 || down <= 0) return undefined;
      const column = Math.floor(x / across);
      const row = Math.floor(y / down);
      if (row < 0 || column < 0 || row >= size || column >= size) return undefined;
      const cell = across - gap;
      const dx = x - (column * across + cell / 2);
      const dy = y - (row * down + cell / 2);
      if (Math.hypot(dx, dy) > cell * tracedCrosswordLayout.hitRadius) return undefined;
      return { index: row * size + column, place: { row, column } };
    },
    [size, gap, columnStep, rowStep],
  );
  const drag = useTraceDrag({
    hit,
    enabled: !accessibleMode,
    testID,
    onExtend,
    onRelease,
  });

  const layout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setMeasured({ width, height });
    columnStep.value = stepOf(width);
    rowStep.value = stepOf(height);
  };
  const width = measured.width;
  const across = stepOf(measured.width);
  const down = stepOf(measured.height);
  const half = (across - gap) / 2;

  return (
    <View style={styles.crossword}>
      <GestureDetector gesture={drag}>
        <View testID={testID} onLayout={layout} style={styles.grid}>
          {grid.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((cell, c) => {
                const place = { row: r, column: c };
                const isFound = found(place);
                const isTraced = traced(place);
                const ink = isTraced ? colors.onAccent : colors.ink;
                return (
                  <View key={c} style={styles.column}>
                    <PressedTile
                      testID={`${testID}-${String(r)}-${String(c)}`}
                      tone={isTraced ? 'accent' : 'tile'}
                      accessibilityLabel={texts.cellLabel(shown(cell), place)}
                      accessibilityState={{ selected: isTraced, disabled: isFound }}
                      inert={!accessibleMode || isFound}
                      onPress={() => {
                        const end = trace[trace.length - 1];
                        if (end !== undefined && samePlace(end, place)) onStepBack();
                        else onExtend(place);
                      }}
                      faceStyle={[styles.cell, isFound && { backgroundColor: colors.correct }]}
                    >
                      <Text
                        {...voice}
                        maxFontSizeMultiplier={fontScaleCap.number}
                        style={[typeStyle('crosswordLetter', tokens), { color: ink }]}
                      >
                        {shown(cell)}
                      </Text>
                    </PressedTile>
                  </View>
                );
              })}
            </View>
          ))}
          {miss !== undefined && width > 0 && (
            <MissFade
              key={miss.key}
              path={miss.path}
              across={across}
              down={down}
              gap={gap}
              testID={`${testID}-miss`}
            />
          )}
          {trace.length > 1 && width > 0 && (
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Polyline
                points={trace
                  .map(
                    (at) => `${String(at.column * across + half)},${String(at.row * down + half)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke={colors.ink}
                strokeWidth={tracedCrosswordLayout.dot}
                strokeLinecap="round"
                strokeDasharray={[0, tracedCrosswordLayout.dotGap]}
              />
            </Svg>
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
      <View style={styles.clues}>
        {words.map((word, index) => {
          const letters =
            word.kind === 'found'
              ? word.path.map(({ row, column }) => {
                  const cell = grid[row]?.[column];
                  return cell === undefined ? '' : shown(cell);
                })
              : Array.from({ length: word.length }, () => '');
          return (
            <View
              key={index}
              testID={`${testID}-clue-${String(index)}`}
              accessible
              accessibilityLabel={texts.clueLabel(
                word.clue,
                word.kind === 'found' ? letters.join('') : undefined,
              )}
              accessibilityState={{ checked: word.kind === 'found' }}
              {...voice}
              style={styles.clue}
            >
              <Text style={[typeStyle('crosswordClue', tokens), { color: colors.ink }]}>
                {word.clue}
              </Text>
              <View style={styles.tiles}>
                {letters.map((letter, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tile,
                      {
                        borderRadius: radii.tile,
                        backgroundColor: word.kind === 'found' ? colors.correct : colors.highlight,
                      },
                    ]}
                  >
                    <Text
                      maxFontSizeMultiplier={fontScaleCap.number}
                      style={[typeStyle('crosswordClue', tokens), { color: colors.ink }]}
                    >
                      {letter}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The cells of a trace that locked nothing, in the wrong colour, fading out. */
function MissFade({
  path,
  across,
  down,
  gap,
  testID,
}: {
  path: readonly CrosswordPlace[];
  /** The column and the row pitch of the grid. */
  across: number;
  down: number;
  gap: number;
  testID: string;
}) {
  const { colors, radii } = useTokens();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withTiming(0, {
      duration: tracedCrosswordLayout.missFade,
      easing: ease,
      reduceMotion: ReduceMotion.Never,
    });
  }, [opacity]);
  const fading = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cell = across - gap;
  return (
    <Animated.View testID={testID} pointerEvents="none" style={[StyleSheet.absoluteFill, fading]}>
      {path.map(({ row, column }) => (
        <View
          key={`${String(row)}-${String(column)}`}
          style={{
            position: 'absolute',
            left: column * across,
            top: row * down,
            width: cell,
            height: cell,
            borderRadius: radii.tile,
            backgroundColor: colors.wrong,
          }}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  crossword: { gap: crosswordLayout.clueGap },
  grid: { gap: crosswordLayout.cellGap },
  row: { flexDirection: 'row', gap: crosswordLayout.cellGap },
  column: { flex: 1 },
  cell: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  clues: { gap: crosswordLayout.clueGap },
  clue: { gap: crosswordLayout.keyGap },
  tiles: { flexDirection: 'row', gap: crosswordLayout.keyGap },
  tile: {
    width: tracedCrosswordLayout.tile,
    height: tracedCrosswordLayout.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
