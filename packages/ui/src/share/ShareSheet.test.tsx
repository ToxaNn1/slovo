import type { EditionStrings } from '@slovo/contracts';
import type { CorrectionCardModel } from '@slovo/core';
import { EditionProvider, ShareSheet, type ShareSheetOutcome } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = {
  share: {
    title: 'Share the card',
    format: 'Format',
    story: 'Story',
    square: 'Square',
    share: 'Share',
    captureFailed: 'Could not make the image.',
    nonStandard: 'Often said',
    standard: 'Better',
  },
  correctionCard: { correctionTypes: { calque: 'calque' } },
} as unknown as EditionStrings;

const card: CorrectionCardModel = {
  kind: 'correction',
  correctionId: 'c1',
  nonStandardForm: 'take part',
  mainEquivalent: 'join in',
  otherEquivalents: [],
  correctionType: 'calque',
  explanation: 'Why join in is better.',
  examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
  sourceTitles: [],
};

/** How long the toast stays, from the design. */
const TOAST_MS = 4000;

async function renderSheet(outcome: ShareSheetOutcome) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <ShareSheet
          visible
          card={card}
          wordOfTheDay={false}
          watermark="SLOVO"
          initialFormat="story"
          onFormatChange={jest.fn()}
          onShare={() => Promise.resolve(outcome)}
          onClose={onClose}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onClose };
}

describe('ShareSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('says so for 4 s when sharing fails, and stays open', async () => {
    const { onClose } = await renderSheet('failed');

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByText('Could not make the image.')).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TOAST_MS);
    });
    expect(screen.queryByText('Could not make the image.')).not.toBeOnTheScreen();
  });

  it('closes once the system share sheet closes', async () => {
    const { onClose } = await renderSheet('closed');

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Could not make the image.')).not.toBeOnTheScreen();
  });
});
