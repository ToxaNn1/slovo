import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EntryRowModel } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { CommunityWordNotice } from './community-word-notice';

const mockRow: EntryRowModel = {
  kind: 'correction',
  entryId: 'c_abc123',
  title: 'зважати на',
  secondLine: 'приймати до уваги',
  labelKey: 'correction',
  spoken: 'зважати на, приймати до уваги',
  correctionType: 'calque',
};

/** The composition, as far as the card reads it: one object, as the app keeps it. */
const mockComposition = {
  entryRow: (entryId: string) => Promise.resolve(entryId === mockRow.entryId ? mockRow : undefined),
};
jest.mock('../composition', () => ({ useComposition: () => mockComposition }));

/** The screens the card opens, by their path. */
const mockOpened: string[] = [];
jest.mock('../entries/use-open-screen', () => ({
  useOpenScreen: () => (href: string) => mockOpened.push(href),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

beforeEach(() => {
  mockOpened.length = 0;
});

async function renderNotice(adds: number) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <CommunityWordNotice entryId="c_abc123" adds={adds} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  // The Entry's row is read once the card is drawn.
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the Community Word card in the Feed', () => {
  it('shows «Слово тижня спільноти», the Entry and how many readers added it', async () => {
    await renderNotice(12);

    expect(screen.getByText('Слово тижня спільноти')).toBeTruthy();
    expect(screen.getByText('додали 12 читачів')).toBeTruthy();
    expect(screen.getByText('зважати на')).toBeTruthy();
    expect(screen.getByText('замість «приймати до уваги»')).toBeTruthy();
  });

  it.each([
    [1, 'додав 1 читач'],
    [3, 'додали 3 читачі'],
    [5, 'додали 5 читачів'],
    [21, 'додав 21 читач'],
    [24, 'додали 24 читачі'],
    [111, 'додали 111 читачів'],
  ])('says %i adds in the Edition’s plural form', async (adds, text) => {
    await renderNotice(adds);

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('opens the Entry over the Feed on a tap', async () => {
    await renderNotice(12);

    await fireEvent.press(screen.getByTestId('community-word-open'));

    expect(mockOpened).toEqual(['/entry/c_abc123']);
  });
});
