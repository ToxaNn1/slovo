import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { onFill, roundLayout, space, typeSize } from '../tokens';

/** A cell's side, so five cells and their gaps fit the SE's width with the screen's margins. */
const CELL_SIZE = 56;
/** The gap between cells. */
const CELL_GAP = 4;
/** The selected cell's border. */
const SELECTED_BORDER = 2;
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
 * The Daily Crossword's grid with its clue line under it. A tap on a cell
 * selects it and its word, across if one reads that way and down otherwise; a
 * second tap on a crossing cell turns to the other word. The selected word's
 * cells are shaded and its clue shown. A tap opens the keyboard, unless every
 * word is right: a letter
 * fills the selected cell and moves on along the word, the delete key erases
 * the cell or, if it is empty, the one behind. The cells of a right word turn
 * green and take no letter; a wrong letter is never marked. «Відкрити літеру»
 * opens the selected cell, a wrong letter in it included, unless its word is
 * right. The screen keeps
 * the letters and which words are right (the Core decides them) and passes the
 * texts; the grid keeps the selection.
 */
export function CrosswordGrid({
  letters,
  words,
  onLetter,
  onOpenLetter,
  texts,
  testID,
}: {
  /** The letters typed or opened, by row and column; a place no word reads through is a block. */
  letters: readonly (readonly (string | undefined)[])[];
  /** The grid's words; the first is selected at the start. */
  words: readonly CrosswordWord[];
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
  };
  testID: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const keyboard = useRef<TextInput>(null);
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
    if (!solved) keyboard.current?.focus();
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

  const type = (text: string) => {
    const letter = text.slice(-1);
    if (!selection || letter.trim() === '') return;
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
                    style={[styles.cell, { backgroundColor: colors.accent }]}
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
        <Text
          testID={`${testID}-clue`}
          accessibilityLiveRegion="polite"
          {...voice}
          style={[styles.clue, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {selected.clue}
        </Text>
      )}
      <TextInput
        ref={keyboard}
        testID={`${testID}-keyboard`}
        accessibilityLabel={selected?.clue}
        {...voice}
        value=""
        onChangeText={type}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace') erase();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        caretHidden
        style={styles.keyboard}
      />
      {onOpenLetter !== undefined && selection !== undefined && (
        <SecondaryButton
          label={texts.openLetter}
          onPress={() => {
            onOpenLetter(selection.place);
          }}
          disabled={isRight(selection.place)}
          testID={`${testID}-open-letter`}
        />
      )}
    </View>
  );
}

/**
 * One cell of a word: shaded in the selected word, outlined when selected,
 * green with a white letter in a right word.
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
  const { colors, fontFamilies } = useTokens();
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      {...voice}
      onPress={onPress}
      style={[
        styles.cell,
        {
          backgroundColor: right ? light.correct : inWord ? colors.surfaceSunken : colors.surface,
          borderColor: selected ? colors.ink : colors.line,
          borderWidth: selected ? SELECTED_BORDER : 1,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={CELL_MAX_FONT_SCALE}
        style={[
          styles.letter,
          { color: right ? onFill : colors.ink, fontFamily: fontFamilies.word },
        ]}
      >
        {letter ?? ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crossword: { gap: roundLayout.gap, alignItems: 'center' },
  grid: { gap: CELL_GAP },
  row: { flexDirection: 'row', gap: CELL_GAP },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: typeSize.roundOption,
    lineHeight: typeSize.roundOption * 1.3,
    fontWeight: '500',
  },
  clue: {
    alignSelf: 'stretch',
    minHeight: typeSize.explanation * 1.55 * 2,
    paddingHorizontal: space[2],
    fontSize: typeSize.explanation,
    lineHeight: typeSize.explanation * 1.55,
    textAlign: 'center',
  },
  keyboard: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
