import {
  EditionProvider,
  RarityTestQuestions,
  type RarityTestQuestion,
  type RarityTestResult,
  type RarityTestScreen,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  rarityTest: {
    progress: '{n} of {total}',
    announcement: 'Word {n} of {total}: {word}',
    result: 'Your rarity: up to {n}',
    next: 'Next',
    question: 'Do you know this word?',
    resultLine: 'Your rarity is up to {n}.',
    known: '{known} of {total} words known.',
    done: 'DONE',
    again: 'Test again',
  },
  knowledge: { known: 'Known', unknown: 'Unknown' },
});

const words: RarityTestQuestion[] = [
  { rarity: 1, lemma: 'first', accessibilityLabel: 'first word' },
  { rarity: 3, lemma: 'second', accessibilityLabel: 'second word' },
];

/** The caller's frame: the screen's content over its buttons. */
function frame({ testID, footer, children }: RarityTestScreen) {
  return (
    <View testID={testID}>
      {children}
      {footer}
    </View>
  );
}

async function renderTest(
  result: RarityTestResult | undefined,
  onAgain: (() => void) | undefined = undefined,
) {
  const handlers = {
    onApply: jest.fn<ComponentProps<typeof RarityTestQuestions>['onApply']>(() =>
      Promise.resolve(result),
    ),
    onDone: jest.fn(),
  };
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <RarityTestQuestions
        testID="test"
        words={words}
        frame={frame}
        onAgain={onAgain}
        {...handlers}
      />
    </EditionProvider>,
  );
  return handlers;
}

describe('RarityTestQuestions', () => {
  it('asks each Word in turn under where the test is', async () => {
    const { onApply } = await renderTest({ ceiling: 2, known: 1, total: 2 });

    expect(screen.getByTestId('test-question')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('Do you know this word?')).toBeTruthy();
    expect(screen.getByLabelText('first word')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));

    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(screen.getByLabelText('second word')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('takes two taps before the screen redraws as answers to two Words', async () => {
    const { onApply } = await renderTest({ ceiling: 2, known: 1, total: 2 });
    const unknown = screen.getByRole('button', { name: 'Unknown' });
    const known = screen.getByRole('button', { name: 'Known' });

    await act(async () => {
      void fireEvent.press(unknown);
      void fireEvent.press(known);
      await Promise.resolve();
    });

    expect(onApply).toHaveBeenCalledWith([
      { rarity: 1, known: false },
      { rarity: 3, known: true },
    ]);
  });

  it("announces each next Word to VoiceOver with where the test is, in the Edition's words", async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    await renderTest({ ceiling: 2, known: 1, total: 2 });

    expect(announce).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(announce).toHaveBeenCalledWith('Word 2 of 2: second word');
  });

  it('asks with «Unknown» before «Known», as the board has them', async () => {
    await renderTest({ ceiling: 2, known: 1, total: 2 });

    const labels = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(labels).toEqual(['Unknown', 'Known']);
  });

  it('applies all the answers on the last one and shows the Rarity Ceiling they set', async () => {
    const { onApply, onDone } = await renderTest({ ceiling: 2, known: 1, total: 2 });

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onApply).toHaveBeenCalledWith([
      { rarity: 1, known: false },
      { rarity: 3, known: true },
    ]);
    expect(await screen.findByTestId('test-result')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Your rarity is up to 2.' })).toBeTruthy();
    expect(screen.getByText('1 of 2 words known.')).toBeTruthy();
    expect(screen.queryByText('Your rarity: up to 2')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Test again' })).toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('offers «DONE» and the test again when its caller takes it again', async () => {
    const onAgain = jest.fn();
    const { onDone } = await renderTest({ ceiling: 2, known: 1, total: 2 }, onAgain);
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Test again' }));
    expect(onAgain).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'DONE' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('goes on at once when the answers set no Rarity Ceiling', async () => {
    const { onApply, onDone } = await renderTest(undefined);

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('test-result')).toBeNull();
  });
});
