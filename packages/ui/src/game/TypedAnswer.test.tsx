import { EditionProvider, TypedAnswer, type TypedAnswerBlank } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

const texts = {
  label: 'Your answer',
  submit: 'Check',
  openLetter: 'Open a letter',
  blankLabel: (place: number, letter: string | undefined) =>
    letter === undefined
      ? `${ORDINALS[place] ?? ''} letter, empty`
      : `${letter}, ${ORDINALS[place] ?? ''} letter`,
};

/** «don't» as blanks with its apostrophe in place and the first letter open. */
const dont: TypedAnswerBlank[] = [{ letter: 'd' }, {}, {}, { mark: "'" }, {}];

/** A Round's answer whose text the test types, as a screen holds it. */
function Answer({
  blanks,
  onSubmit,
  onOpenLetter,
}: {
  blanks?: readonly TypedAnswerBlank[];
  onSubmit: (text: string) => void;
  onOpenLetter?: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
      <TypedAnswer
        value={text}
        onChangeText={setText}
        onSubmit={() => {
          onSubmit(text);
        }}
        blanks={blanks}
        onOpenLetter={onOpenLetter}
        texts={texts}
        testID="answer"
      />
    </EditionProvider>
  );
}

describe('TypedAnswer', () => {
  it('submits what the reader typed, by its button and by the keyboard', async () => {
    const onSubmit = jest.fn();
    await render(<Answer onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByLabelText('Your answer'), 'craquelure');
    await fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    await fireEvent(screen.getByLabelText('Your answer'), 'submitEditing');

    expect(onSubmit).toHaveBeenNthCalledWith(1, 'craquelure');
    expect(onSubmit).toHaveBeenNthCalledWith(2, 'craquelure');
  });

  it('takes no submit while nothing but spaces is typed', async () => {
    const onSubmit = jest.fn();
    await render(<Answer onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByLabelText('Your answer'), '  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    await fireEvent(screen.getByLabelText('Your answer'), 'submitEditing');

    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows no blanks and no «open a letter» unless the Round has them', async () => {
    await render(<Answer onSubmit={jest.fn()} />);

    expect(screen.queryByTestId('answer-blanks')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open a letter' })).toBeNull();
  });

  it('shows the blanks with the open letters and the apostrophe in place, which VoiceOver reads by letter', async () => {
    await render(<Answer blanks={dont} onSubmit={jest.fn()} />);

    expect(screen.getByLabelText('d, first letter')).toHaveTextContent('d');
    expect(screen.getByText("'", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('second letter, empty')).toBeOnTheScreen();
    expect(screen.getByLabelText('fourth letter, empty')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/fifth letter/)).toBeNull();
  });

  it('reads the letters after a Stress mark by their place among the letters, skipping the mark', async () => {
    const stressed: TypedAnswerBlank[] = [{ letter: 'v' }, {}, { mark: '́' }, {}, {}];
    await render(<Answer blanks={stressed} onSubmit={jest.fn()} />);

    expect(screen.getByLabelText('v, first letter')).toBeOnTheScreen();
    expect(screen.getByLabelText('second letter, empty')).toBeOnTheScreen();
    expect(screen.getByLabelText('third letter, empty')).toBeOnTheScreen();
    expect(screen.getByLabelText('fourth letter, empty')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/fifth letter/)).toBeNull();
  });

  it('opens a letter while more than one is left', async () => {
    const onOpenLetter = jest.fn();
    await render(<Answer blanks={dont} onSubmit={jest.fn()} onOpenLetter={onOpenLetter} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open a letter' }));

    expect(onOpenLetter).toHaveBeenCalledTimes(1);
  });

  it('opens no letter once one is left', async () => {
    const onOpenLetter = jest.fn();
    const lastLeft: TypedAnswerBlank[] = [
      { letter: 'd' },
      { letter: 'o' },
      { letter: 'n' },
      { mark: "'" },
      {},
    ];
    await render(<Answer blanks={lastLeft} onSubmit={jest.fn()} onOpenLetter={onOpenLetter} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open a letter' }));

    expect(screen.getByRole('button', { name: 'Open a letter' })).toBeDisabled();
    expect(onOpenLetter).not.toHaveBeenCalled();
  });
});
