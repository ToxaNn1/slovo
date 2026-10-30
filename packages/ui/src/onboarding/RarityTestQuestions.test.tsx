import type { EditionStrings } from '@slovo/contracts';
import {
  EditionProvider,
  RarityTestQuestions,
  type RarityTestQuestion,
  type RarityTestScreen,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

const strings = {
  onboarding: { mix: { next: 'Next' } },
  rarityTest: { progress: '{n} of {total}', result: 'Your level: from {n}' },
  knowledge: { known: 'Known', unknown: 'Unknown' },
} as unknown as EditionStrings;

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

async function renderTest(floor: number | undefined) {
  const handlers = {
    onApply: jest.fn((): Promise<number | undefined> => Promise.resolve(floor)),
    onDone: jest.fn(),
  };
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <RarityTestQuestions testID="test" words={words} frame={frame} {...handlers} />
    </EditionProvider>,
  );
  return handlers;
}

describe('RarityTestQuestions', () => {
  it('asks each Word in turn under where the test is', async () => {
    const { onApply } = await renderTest(2);

    expect(screen.getByTestId('test-question')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByLabelText('first word')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));

    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(screen.getByLabelText('second word')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies all the answers on the last one and shows the floor they set', async () => {
    const { onApply, onDone } = await renderTest(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onApply).toHaveBeenCalledWith([
      { rarity: 1, known: false },
      { rarity: 3, known: true },
    ]);
    expect(await screen.findByTestId('test-result')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Your level: from 2' })).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('goes on at once when the answers set no floor', async () => {
    const { onApply, onDone } = await renderTest(undefined);

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('test-result')).toBeNull();
  });
});
