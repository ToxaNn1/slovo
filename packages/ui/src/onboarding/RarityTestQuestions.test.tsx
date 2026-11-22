import {
  EditionProvider,
  RarityTestQuestions,
  type RarityTestQuestion,
  type RarityTestResult,
  type RarityTestScreen,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { MixPlace } from '@slovo/contracts';
import type { ComponentProps } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  rarityTest: {
    progress: '{n} of {total}',
    announcement: 'Word {n} of {total}: {word}',
    next: 'Next',
    question: 'Do you know this word?',
    resultChanged: 'Rarity is now {range}',
    resultKept: 'Rarity stays {range}',
    known: {
      tab: '{known} of {total} words known.',
      settings: '{known} of {total} words known. Change it in Settings.',
    },
    done: 'DONE',
    again: 'Test again',
  },
  knowledge: { known: 'Known', unknown: 'Unknown' },
  settings: { rarity: { range: 'from {from} to {to}', single: 'only {rarity}' } },
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
  onAgain?: () => void,
  mixPlace: MixPlace = 'tab',
) {
  const handlers = {
    onApply: jest.fn<ComponentProps<typeof RarityTestQuestions>['onApply']>(() =>
      Promise.resolve(result),
    ),
    onDone: jest.fn(),
  };
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings} mixPlace={mixPlace}>
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
    const { onApply } = await renderTest({ top: 2, changed: true, known: 1, total: 2 });

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
    const { onApply } = await renderTest({ top: 2, changed: true, known: 1, total: 2 });
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
    await renderTest({ top: 2, changed: true, known: 1, total: 2 });

    expect(announce).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(announce).toHaveBeenCalledWith('Word 2 of 2: second word');
  });

  it('asks with «Unknown» before «Known», as the board has them', async () => {
    await renderTest({ top: 2, changed: true, known: 1, total: 2 });

    expect(screen.getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'Unknown' }),
      screen.getByRole('button', { name: 'Known' }),
    ]);
  });

  it('applies all the answers on the last one and shows the Rarity Range they set', async () => {
    const { onApply, onDone } = await renderTest({ top: 2, changed: true, known: 1, total: 2 });

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onApply).toHaveBeenCalledWith([
      { rarity: 1, known: false },
      { rarity: 3, known: true },
    ]);
    expect(await screen.findByTestId('test-result')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Rarity is now from 1 to 2' })).toBeTruthy();
    expect(screen.getByText('1 of 2 words known.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Test again' })).toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('says where the Rarity Range is changed in Settings while the Mix has no tab (ADR 0201)', async () => {
    await renderTest({ top: 2, changed: true, known: 1, total: 2 }, undefined, 'settings');
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(await screen.findByText('1 of 2 words known. Change it in Settings.')).toBeTruthy();
  });

  it('says the Rarity Range stays when the test set the one the reader had', async () => {
    await renderTest({ top: 1, changed: false, known: 0, total: 2 });
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));

    expect(await screen.findByRole('header', { name: 'Rarity stays only 1' })).toBeTruthy();
  });

  it('offers «DONE» and the test again when its caller takes it again', async () => {
    const onAgain = jest.fn();
    const { onDone } = await renderTest({ top: 2, changed: true, known: 1, total: 2 }, onAgain);
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Test again' }));
    expect(onAgain).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'DONE' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('goes on at once when the answers set no Rarity Range', async () => {
    const { onApply, onDone } = await renderTest(undefined);

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('test-result')).toBeNull();
  });
});
