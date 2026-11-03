import { sentences } from '@slovo/core';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { HalftoneGround } from '../primitives/HalftoneGround';
import { PressedTile } from '../primitives/PressedTile';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { dailyCrosswordCard, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the card's text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.3;
/** A letter of the small grid keeps its size, so it stays inside its 22 pt cell. */
const MINI_MAX_FONT_SCALE = 1;

/** A place of the small grid on the card: dark where no word reads through, else a cell with the letter in it, if any. */
export type CrosswordMiniCell =
  { readonly kind: 'block' } | { readonly kind: 'cell'; readonly letter: string | undefined };

/**
 * The Daily Crossword's card on top of the mode screen, as the design's
 * red card on its deep edge under the halftone raster: today's grid in
 * small, with the letters in, beside its name, the day and «Почати»,
 * «Продовжити» or the solved mark, in the key ink; an arrow follows the
 * state until it is solved. A tap anywhere on it opens the crossword's
 * screen, and VoiceOver reads it as one button. Each place of the grid
 * carries the test ID `${testID}-cell-${row}-${column}`, or `-block-` where
 * no word reads through.
 */
export function DailyCrosswordCard({
  title,
  day,
  state,
  solved,
  grid,
  onPress,
  testID,
}: {
  /** Its name, such as «Кросворд дня». */
  title: string;
  /** Today's day, such as «26 жовтня». */
  day: string;
  /** «Почати», «Продовжити» or the solved mark, such as «✓ Розв’язано». */
  state: string;
  /** Whether today's is solved, which takes the arrow off its state. */
  solved: boolean;
  /** Today's grid, by row and column. */
  grid: readonly (readonly CrosswordMiniCell[])[];
  /** Opens the crossword's screen. */
  onPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const light = useSchemeColors('light');
  const keyInk = light.ink;
  const [size, setSize] = useState<{ width: number; height: number }>();
  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize({ width, height });
  };
  const placeId = (kind: CrosswordMiniCell['kind'], row: number, column: number) =>
    testID === undefined ? undefined : `${testID}-${kind}-${String(row)}-${String(column)}`;
  return (
    <PressedTile
      tone="accent"
      depth="card"
      radius={tokens.radii.card}
      accessibilityLabel={sentences([title, day, state])}
      onPress={onPress}
      faceStyle={styles.face}
      testID={testID}
    >
      <View style={StyleSheet.absoluteFill} onLayout={measure}>
        {size === undefined ? null : (
          <HalftoneGround id="daily-crossword" width={size.width} height={size.height} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.grid}>
          {grid.map((cells, row) => (
            <View key={row} style={styles.gridRow}>
              {cells.map((cell, column) =>
                cell.kind === 'block' ? (
                  <View
                    key={column}
                    testID={placeId('block', row, column)}
                    style={[styles.cell, { backgroundColor: keyInk }]}
                  />
                ) : (
                  <View
                    key={column}
                    testID={placeId('cell', row, column)}
                    style={[
                      styles.cell,
                      styles.letterCell,
                      {
                        backgroundColor: light.background,
                        borderBottomColor: tokens.colors.accentEdge,
                      },
                    ]}
                  >
                    {cell.letter === undefined ? null : (
                      <Text
                        maxFontSizeMultiplier={MINI_MAX_FONT_SCALE}
                        style={[typeStyle('crosswordMiniLetter', tokens), { color: keyInk }]}
                      >
                        {cell.letter}
                      </Text>
                    )}
                  </View>
                ),
              )}
            </View>
          ))}
        </View>
        <View style={styles.texts}>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[typeStyle('crosswordTitle', tokens), { color: keyInk }]}
          >
            {title}
          </Text>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[typeStyle('crosswordDay', tokens), { color: keyInk }]}
          >
            {day}
          </Text>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[typeStyle('crosswordState', tokens), styles.state, { color: keyInk }]}
          >
            {solved ? state : `${state} →`}
          </Text>
        </View>
      </View>
    </PressedTile>
  );
}

const { mini } = dailyCrosswordCard;

const styles = StyleSheet.create({
  face: { overflow: 'hidden' },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: dailyCrosswordCard.padding,
    gap: dailyCrosswordCard.gap,
  },
  grid: { gap: mini.gap },
  gridRow: { flexDirection: 'row', gap: mini.gap },
  cell: { width: mini.cell, height: mini.cell, borderRadius: mini.radius },
  // The edge sits inside the cell's side, as the design's 2 pt shadow under a 22 pt cell.
  letterCell: { borderBottomWidth: mini.depth, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, minWidth: 0, gap: dailyCrosswordCard.lineGap },
  state: { marginTop: dailyCrosswordCard.stateGap },
});
