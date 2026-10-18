import type { EditionStrings } from '@slovo/contracts';
import type { EntryFeedCard, Haptics } from '@slovo/core';
import { EditionProvider, EntryCard, HapticsProvider, VerticalPager } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';

const strings = {
  correctionCard: {
    title: 'Correction',
    correctionType: 'Type: {type}',
    correctionTypes: { calque: 'calque' },
    nonStandard: 'Non-standard',
    standard: 'Standard',
    otherEquivalents: 'Also: {equivalents}',
    exampleNonStandard: 'Not: {text}',
    exampleStandard: 'Right: {text}',
  },
} as unknown as EditionStrings;

const card: EntryFeedCard = {
  kind: 'correction',
  correctionCard: {
    kind: 'correction',
    correctionId: 'c1',
    nonStandardForm: 'take part',
    mainEquivalent: 'join in',
    otherEquivalents: [],
    correctionType: 'calque',
    explanation: 'A long explanation.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
  },
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const actions = <Text testID="card-actions">actions</Text>;

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

describe('EntryCard', () => {
  it('scrolls its text inside the frame in the Feed and keeps the actions below it', async () => {
    await render(
      inEdition(
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={[card]}
            onIndexChange={() => undefined}
            renderPage={(item) => <EntryCard card={item} actions={actions} scrollable />}
          />
        </HapticsProvider>,
      ),
    );
    await fireEvent(screen.getByTestId('pager'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });

    const scroll = within(screen.getByTestId('entry-card-scroll'));
    expect(scroll.getByTestId('correction-explanation')).toBeTruthy();
    expect(scroll.queryByTestId('card-actions')).toBeNull();
    const frame = within(screen.getByTestId('correction-card'));
    expect(frame.getByTestId('entry-card-scroll')).toBeTruthy();
    expect(screen.getByTestId('card-actions')).toBeTruthy();
  });

  it('draws the card without a scroll of its own outside the Feed', async () => {
    await render(inEdition(<EntryCard card={card} actions={actions} />));

    expect(screen.queryByTestId('entry-card-scroll')).toBeNull();
    expect(screen.getByTestId('correction-explanation')).toBeTruthy();
    expect(screen.getByTestId('card-actions')).toBeTruthy();
  });
});
