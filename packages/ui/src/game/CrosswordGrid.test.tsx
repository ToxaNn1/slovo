import type { EditionStrings } from '@slovo/contracts';
import {
  coreTokens,
  CrosswordGrid,
  EditionProvider,
  type CrosswordPlace,
  type CrosswordWord,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';

const texts = {
  cellLabel: (letter: string | undefined, place: CrosswordPlace) =>
    `${letter ?? 'empty'}, row ${String(place.row + 1)}, column ${String(place.column + 1)}`,
  openLetter: 'Open a letter',
};

/**
 * A 5 × 5 grid of four words: «cat» and «ten» across in rows 1 and 3,
 * «cut» and «tin» down in columns 1 and 3, from the top left corner.
 *
 *     c a t . .
 *     u . i . .
 *     t e n . .
 */
const words: CrosswordWord[] = [
  { start: { row: 0, column: 0 }, direction: 'across', length: 3, clue: 'A pet that purrs' },
  { start: { row: 0, column: 0 }, direction: 'down', length: 3, clue: 'Sliced with a knife' },
  { start: { row: 0, column: 2 }, direction: 'down', length: 3, clue: 'A can of food' },
  { start: { row: 2, column: 0 }, direction: 'across', length: 3, clue: 'Ten minus nothing' },
];

const answers: Record<string, string> = {
  'A pet that purrs': 'cat',
  'Sliced with a knife': 'cut',
  'A can of food': 'tin',
  'Ten minus nothing': 'ten',
};

const empty = (): (string | undefined)[][] =>
  Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => undefined));

/** The grid as a screen holds it: the letters typed and which words are right. */
function Crossword({ onOpenLetter }: { onOpenLetter?: (place: CrosswordPlace) => void }) {
  const [letters, setLetters] = useState(empty);
  const read = (word: CrosswordWord) =>
    Array.from({ length: word.length }, (_, index) =>
      word.direction === 'across'
        ? letters[word.start.row]?.[word.start.column + index]
        : letters[word.start.row + index]?.[word.start.column],
    ).join('');
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={{} as EditionStrings}>
      <CrosswordGrid
        letters={letters}
        words={words.map((word) => ({ ...word, right: read(word) === answers[word.clue] }))}
        onLetter={(place, letter) => {
          setLetters((before) =>
            before.map((row, r) =>
              row.map((cell, c) => (r === place.row && c === place.column ? letter : cell)),
            ),
          );
        }}
        onOpenLetter={onOpenLetter}
        texts={texts}
        testID="crossword"
      />
    </EditionProvider>
  );
}

const cell = (row: number, column: number) =>
  screen.getByTestId(`crossword-${String(row)}-${String(column)}`);
const type = async (text: string) => {
  for (const letter of text)
    await fireEvent.changeText(screen.getByTestId('crossword-keyboard'), letter);
};
const { surfaceSunken } = coreTokens.colors.light;
const { correct } = coreTokens.colors.light;

describe('CrosswordGrid', () => {
  it('shows a cell for every letter of a word and none elsewhere', async () => {
    await render(<Crossword />);

    expect(screen.getByLabelText('empty, row 2, column 3')).toBeOnTheScreen();
    expect(screen.queryByLabelText('empty, row 2, column 2')).toBeNull();
    expect(screen.queryByLabelText(/row 4/)).toBeNull();
  });

  it('starts on the first word and shows its clue', async () => {
    await render(<Crossword />);

    expect(screen.getByText('A pet that purrs')).toBeOnTheScreen();
    expect(cell(0, 0)).toBeSelected();
    expect(cell(0, 2)).toHaveStyle({ backgroundColor: surfaceSunken });
    expect(cell(1, 0)).not.toHaveStyle({ backgroundColor: surfaceSunken });
  });

  it('selects the word of a tapped cell and shows its clue', async () => {
    await render(<Crossword />);

    await fireEvent.press(cell(1, 2));

    expect(screen.getByText('A can of food')).toBeOnTheScreen();
    expect(screen.queryByText('A pet that purrs')).toBeNull();
    expect(cell(1, 2)).toBeSelected();
    expect(cell(2, 2)).toHaveStyle({ backgroundColor: surfaceSunken });
    expect(cell(0, 1)).not.toHaveStyle({ backgroundColor: surfaceSunken });
  });

  it('keeps across on a first tap and turns down on a second tap of a crossing cell', async () => {
    await render(<Crossword />);

    await fireEvent.press(cell(2, 2));
    expect(screen.getByText('Ten minus nothing')).toBeOnTheScreen();

    await fireEvent.press(cell(2, 2));
    expect(screen.getByText('A can of food')).toBeOnTheScreen();
  });

  it('fills the selected word letter by letter as the reader types', async () => {
    await render(<Crossword />);

    await type('ca');

    expect(screen.getByLabelText('c, row 1, column 1')).toHaveTextContent('c');
    expect(screen.getByLabelText('a, row 1, column 2')).toHaveTextContent('a');
    expect(cell(0, 2)).toBeSelected();
  });

  it('erases the letter behind on the delete key', async () => {
    await render(<Crossword />);

    await type('ca');
    await fireEvent(screen.getByTestId('crossword-keyboard'), 'keyPress', {
      nativeEvent: { key: 'Backspace' },
    });

    expect(screen.getByLabelText('empty, row 1, column 2')).toBeSelected();
  });

  it('turns a right word green and never marks a wrong one', async () => {
    await render(<Crossword />);

    await type('cat');
    await fireEvent.press(cell(2, 0));
    await type('tan');

    for (const column of [0, 1, 2])
      expect(cell(0, column)).toHaveStyle({ backgroundColor: correct });
    expect(cell(2, 1)).not.toHaveStyle({ backgroundColor: correct });
    expect(cell(2, 1)).not.toHaveStyle({ backgroundColor: coreTokens.colors.light.wrong });
  });

  it('opens the keyboard on a tap of a cell, but not once the grid is solved', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await render(<Crossword />);
    focus.mockClear();

    await fireEvent.press(cell(2, 0));
    expect(focus).toHaveBeenCalledTimes(1);

    await type('ten');
    await fireEvent.press(cell(0, 0));
    await type('cat');
    await fireEvent.press(cell(1, 0));
    await type('u');
    await fireEvent.press(cell(1, 2));
    await type('i');
    focus.mockClear();
    await fireEvent.press(cell(0, 1));

    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
  });

  it('opens the selected cell with «open a letter»', async () => {
    const onOpenLetter = jest.fn();
    await render(<Crossword onOpenLetter={onOpenLetter} />);

    await fireEvent.press(cell(1, 2));
    await fireEvent.press(screen.getByRole('button', { name: 'Open a letter' }));

    expect(onOpenLetter).toHaveBeenCalledWith({ row: 1, column: 2 });
  });

  it('opens a cell that holds a wrong letter, never one of a right word', async () => {
    const onOpenLetter = jest.fn();
    await render(<Crossword onOpenLetter={onOpenLetter} />);
    await type('cxt');

    await fireEvent.press(cell(0, 1));
    await fireEvent.press(screen.getByRole('button', { name: 'Open a letter' }));
    expect(onOpenLetter).toHaveBeenCalledWith({ row: 0, column: 1 });

    await fireEvent.press(cell(0, 0));
    await fireEvent.press(cell(0, 0));
    await type('cut');
    await fireEvent.press(cell(1, 0));
    expect(screen.getByRole('button', { name: 'Open a letter' })).toBeDisabled();
  });
});
