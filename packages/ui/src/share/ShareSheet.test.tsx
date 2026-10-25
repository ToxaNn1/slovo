import type { EditionStrings } from '@slovo/contracts';
import type { EntryFeedCard, IdiomCardModel, IdiomFeedCard } from '@slovo/core';
import { EditionProvider, ShareSheet, type ShareSheetOutcome } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = {
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or' },
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
  idiomCard: { idiomTypes: { idiom: 'idiom', placeName: 'place name' }, etymology: 'Origin' },
} as unknown as EditionStrings;

const card: EntryFeedCard = {
  kind: 'correction',
  entryId: 'c1',
  model: {
    kind: 'correction',
    correctionId: 'c1',
    nonStandardForm: 'take part',
    nonStandardStressedVowels: [],
    mainEquivalent: 'join in',
    mainEquivalentStressedVowels: [],
    otherEquivalents: [],
    correctionType: 'calque',
    categoryId: 'everyday',
    categoryName: 'Everyday speech',
    explanation: 'Why join in is better.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
    sourceTitles: [],
    literaryUses: [],
  },
};

/** How long the toast stays, from the design. */
const TOAST_MS = 4000;

async function renderSheet(outcome: ShareSheetOutcome, shown: EntryFeedCard = card) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <ShareSheet
          visible
          card={shown}
          todaysWordOfTheDay={false}
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

function idiomCard(overrides: Partial<IdiomCardModel> = {}): IdiomFeedCard {
  const model: IdiomCardModel = {
    kind: 'idiom',
    idiomId: 'i1',
    expression: 'to beat the bushes',
    idiomType: 'idiom',
    primaryDefinition: 'To idle about.',
    extraDefinitions: ['To waste time.'],
    examples: [{ text: 'He beat the bushes all day.' }],
    etymology: 'From the hunt.',
    sourceTitles: ['A phrase dictionary'],
    ...overrides,
  };
  return { kind: 'idiom', entryId: model.idiomId, model };
}

/** The Share Card in the preview; the one drawn off screen for the image is the same. */
function previewCard() {
  return within(screen.getByTestId('share-preview')).getByTestId('share-card');
}

describe('The Share Card of an Idiom', () => {
  it("shows an idiom's chip, its expression and its primary Definition", async () => {
    await renderSheet('closed', idiomCard());

    const shown = previewCard();
    expect(within(shown).getByText('idiom')).toBeOnTheScreen();
    expect(within(shown).getByText('to beat the bushes')).toBeOnTheScreen();
    expect(within(shown).getByText('To idle about.')).toBeOnTheScreen();
    expect(within(shown).queryByText('To waste time.')).not.toBeOnTheScreen();
    expect(within(shown).queryByText('From the hunt.')).not.toBeOnTheScreen();
    expect(within(shown).queryByText('He beat the bushes all day.')).not.toBeOnTheScreen();
    expect(shown).toHaveAccessibleName('idiom. to beat the bushes. To idle about.');
  });

  it("adds a place name's etymology under «Origin»", async () => {
    await renderSheet(
      'closed',
      idiomCard({
        idiomId: 'i2',
        expression: 'Kyiv',
        idiomType: 'placeName',
        primaryDefinition: 'The capital on the Dnipro.',
        etymology: 'Named after Kyi',
      }),
    );

    const shown = previewCard();
    expect(within(shown).getByText('place name')).toBeOnTheScreen();
    expect(within(shown).getByText('Kyiv')).toBeOnTheScreen();
    expect(within(shown).getByText('The capital on the Dnipro.')).toBeOnTheScreen();
    expect(within(shown).getByText('Origin')).toBeOnTheScreen();
    expect(within(shown).getByText('Named after Kyi')).toBeOnTheScreen();
    expect(shown).toHaveAccessibleName(
      'place name. Kyiv. The capital on the Dnipro. Origin: Named after Kyi',
    );
  });
});
