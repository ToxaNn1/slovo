import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { PressedTile } from '../primitives/PressedTile';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { crosswordLayout, roundLayout, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale a cell's letter, so it stays inside its cell. */
const CELL_MAX_FONT_SCALE = 1.3;

/** A cell of the grid, by its row and column from 0, from the top left corner. */
export interface CrosswordPlace {
  readonly row: number;
  readonly column: number;
}

/** A word of the grid: where it starts, which way it reads, its clue and whether it is filled right. */
export interface CrosswordWord {
  readonly start: CrosswordPlace;
  readonly direction: 'across' | 'down';
  readonly length: number;
  readonly clue: string;
  /** Whether its cells hold the right word, which the Core decides; it turns green. */
  readonly right?: boolean | undefined;
}

interface Selection {
  readonly place: CrosswordPlace;
  readonly direction: CrosswordWord['direction'];
}

/** The places of a word's letters, in reading order. */
function placesOf(word: CrosswordWord): CrosswordPlace[] {
  return Array.from({ length: word.length }, (_, index) =>
    word.direction === 'across'
      ? { row: word.start.row, column: word.start.column + index }
      : { row: word.start.row + index, column: word.start.column },
  );
}

const samePlace = (a: CrosswordPlace, b: CrosswordPlace) =>
  a.row === b.row && a.column === b.column;

/** The word that reads through a place in a direction, if one does. */
function wordAt(
  words: readonly CrosswordWord[],
  place: CrosswordPlace,
  direction: CrosswordWord['direction'],
): CrosswordWord | undefined {
  return words.find(
    (word) => word.direction === direction && placesOf(word).some((at) => samePlace(at, place)),
  );
}

const otherWay = (direction: CrosswordWord['direction']) =>
  direction === 'across' ? 'down' : 'across';

/**
 * The Daily Crossword's grid of pressed cells, its clue bar and its own
 * keyboard under them. A tap on a cell selects it and its word, across if
 * one reads that way and down otherwise; a second tap on a crossing cell
 * turns to the other word. The selected word's cells are highlighted, the
 * selected cell is red with an ink ring, and the word's clue is shown. A
 * key's letter fills the selected cell and moves on along the word; the
 * delete key erases the cell or, if it is empty, the one behind. Once every
 * word is right the keys take no letter. The cells of a right word turn
 * green and take no letter; a wrong letter is never marked. «Відкрити
 * літеру» opens the selected cell, a wrong letter in it included, unless its
 * word is right. The screen keeps the letters and which words are right
 * (the Core decides them) and passes the keyboard's rows and the texts; the
 * grid keeps the selection.
 */
export function CrosswordGrid({
  letters,
  words,
  keys,
  onLetter,
  onOpenLetter,
  texts,
  testID,
}: {
  /** The letters typed or opened, by row and column; a place no word reads through is a block. */
  letters: readonly (readonly (string | undefined)[])[];
  /** The grid's words; the first is selected at the start. */
  words: readonly CrosswordWord[];
  /** The keyboard's rows of letters, top to bottom; the delete key ends the last. */
  keys: readonly (readonly string[])[];
  /** Puts a letter in a cell, or erases it with `undefined`. */
  onLetter: (place: CrosswordPlace, letter: string | undefined) => void;
  /** Opens the selected cell; no «Відкрити літеру» without it. */
  onOpenLetter?: ((place: CrosswordPlace) => void) | undefined;
  /** The Edition's texts. */
  texts: {
    /** What VoiceOver reads for a cell: its letter, if any, and its place. */
    cellLabel: (letter: string | undefined, place: CrosswordPlace) => string;
    /** «Відкрити літеру». */
    openLetter: string;
    /** What VoiceOver reads for the delete key, «Стерти». */
    eraseKey: string;
  };
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const first = words[0];
  const [selection, setSelection] = useState<Selection | undefined>(
    first && { place: first.start, direction: first.direction },
  );
  const selected = selection && wordAt(words, selection.place, selection.direction);
  const selectedPlaces = selected ? placesOf(selected) : [];
  const rightPlaces = words.filter((word) => word.right === true).flatMap(placesOf);
  const isRight = (place: CrosswordPlace) => rightPlaces.some((at) => samePlace(at, place));
  const solved = words.every((word) => word.right === true);
  const letterAt = (place: CrosswordPlace) => letters[place.row]?.[place.column];

  const tap = (place: CrosswordPlace) => {
    const again = selection !== undefined && samePlace(selection.place, place);
    const preferred = again ? otherWay(selection.direction) : (selection?.direction ?? 'across');
    const direction = wordAt(words, place, preferred) ? preferred : otherWay(preferred);
    setSelection({ place, direction });
  };

  /** Moves the selection along its word, by `step` cells, past the cells of right words. */
  const move = (step: 1 | -1) => {
    if (!selection || !selected) return;
    const places = placesOf(selected);
    let index = places.findIndex((at) => samePlace(at, selection.place)) + step;
    let next = places[index];
    while (next && isRight(next)) {
      index += step;
      next = places[index];
    }
    if (next) setSelection({ ...selection, place: next });
    return next;
  };

  const type = (letter: string) => {
    if (!selection) return;
    if (!isRight(selection.place)) onLetter(selection.place, letter);
    move(1);
  };

  const erase = () => {
    if (!selection) return;
    if (letterAt(selection.place) !== undefined && !isRight(selection.place)) {
      onLetter(selection.place, undefined);
      return;
    }
    const behind = move(-1);
    if (behind) onLetter(behind, undefined);
  };

  return (
    <View style={styles.crossword}>
      <View testID={testID} style={styles.grid}>
        {letters.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((letter, columnIndex) => {
              const place = { row: rowIndex, column: columnIndex };
              const open = words.some((word) => placesOf(word).some((at) => samePlace(at, place)));
              if (!open)
                return (
                  <View
                    key={columnIndex}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[
                      styles.cell,
                      { backgroundColor: colors.silhouette, borderRadius: radii.tile },
                    ]}
                  />
                );
              return (
                <Cell
                  key={columnIndex}
                  testID={`${testID}-${String(rowIndex)}-${String(columnIndex)}`}
                  letter={letter}
                  label={texts.cellLabel(letter, place)}
                  selected={selection !== undefined && samePlace(selection.place, place)}
                  inWord={selectedPlaces.some((at) => samePlace(at, place))}
                  right={isRight(place)}
                  onPress={() => {
                    tap(place);
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
      {selected && (
        <View
          testID={`${testID}-clue-card`}
          style={[styles.clueBar, { backgroundColor: colors.ink, borderRadius: radii.tile }]}
        >
          <Text
            testID={`${testID}-clue`}
            accessibilityLiveRegion="polite"
            {...voice}
            style={[typeStyle('crosswordClue', tokens), { color: colors.background }]}
          >
            {selected.clue}
          </Text>
        </View>
      )}
      {onOpenLetter !== undefined && selection !== undefined && (
        <Button
          variant="neutral"
          label={texts.openLetter}
          onPress={() => {
            onOpenLetter(selection.place);
          }}
          disabled={isRight(selection.place)}
          testID={`${testID}-open-letter`}
        />
      )}
      <View style={styles.keyboard}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyRow}>
            {row.map((key) => (
              <Key
                key={key}
                testID={`${testID}-key-${key}`}
                label={key}
                disabled={solved}
                onPress={() => {
                  type(key);
                }}
              >
                {key}
              </Key>
            ))}
            {rowIndex === keys.length - 1 && (
              <Key
                testID={`${testID}-key-delete`}
                label={texts.eraseKey}
                disabled={solved}
                wide
                onPress={erase}
              >
                {ERASE_GLYPH}
              </Key>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The delete key's face. */
const ERASE_GLYPH = '⌫';

/**
 * One cell of a word, a pressed tile: highlighted in the selected word, red
 * with an ink ring when selected, green in a right word.
 */
function Cell({
  testID,
  letter,
  label,
  selected,
  inWord,
  right,
  onPress,
}: {
  testID: string;
  letter: string | undefined;
  label: string;
  selected: boolean;
  inWord: boolean;
  right: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const red = selected && !right;
  return (
    <PressedTile
      testID={testID}
      tone={red ? 'accent' : 'tile'}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      faceStyle={[
        styles.cell,
        right && { backgroundColor: colors.correct },
        !right && !selected && inWord && { backgroundColor: colors.highlight },
        selected && { borderWidth: crosswordLayout.ring, borderColor: colors.ink },
      ]}
    >
      <Text
        {...voice}
        maxFontSizeMultiplier={CELL_MAX_FONT_SCALE}
        style={[
          typeStyle('crosswordLetter', tokens),
          { color: right || red ? keyInk : colors.ink },
        ]}
      >
        {letter ?? ''}
      </Text>
    </PressedTile>
  );
}

/** A key of the crossword's keyboard: a shallow pressed tile, one letter wide or wider. */
function Key({
  testID,
  label,
  disabled,
  wide = false,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  disabled: boolean;
  wide?: boolean;
  onPress: () => void;
  children: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View style={wide ? styles.wideKey : styles.key}>
      <PressedTile
        testID={testID}
        depth="key"
        radius={crosswordLayout.keyRadius}
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        faceStyle={styles.keyFace}
      >
        <Text
          {...voice}
          maxFontSizeMultiplier={CELL_MAX_FONT_SCALE}
          style={[typeStyle('crosswordKey', tokens), { color: colors.ink }]}
        >
          {children}
        </Text>
      </PressedTile>
    </View>
  );
}

const styles = StyleSheet.create({
  crossword: { gap: roundLayout.sheetGap, alignItems: 'center' },
  grid: { gap: crosswordLayout.cellGap },
  row: { flexDirection: 'row', gap: crosswordLayout.cellGap },
  cell: {
    width: crosswordLayout.cell,
    height: crosswordLayout.cell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueBar: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: crosswordLayout.keyHeight,
    padding: crosswordLayout.cluePadding,
  },
  keyboard: { alignSelf: 'stretch', gap: crosswordLayout.keyRowGap },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: crosswordLayout.keyGap },
  key: { flex: 1 },
  wideKey: { flex: crosswordLayout.eraseKeyFlex },
  keyFace: { height: crosswordLayout.keyHeight, alignItems: 'center', justifyContent: 'center' },
});
