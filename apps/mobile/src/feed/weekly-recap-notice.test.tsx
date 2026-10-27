import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { WeeklyRecapModel } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { WeeklyRecapNotice } from './weekly-recap-notice';

const mockRecap: WeeklyRecapModel = {
  firstDay: { year: 2026, month: 10, day: 19 },
  lastDay: { year: 2026, month: 10, day: 25 },
  seen: 23,
  saved: 4,
  known: 9,
  streak: 6,
};

/** The composition, as far as the card reads it: one object, as the app keeps it. */
const mockComposition = { weeklyRecap: { of: () => Promise.resolve(mockRecap) } };
jest.mock('../composition', () => ({ useComposition: () => mockComposition }));

/** What the reader sees in effect: the Share Cards switch and the Streak. */
let mockShown: { entryButtons: { shareCard: boolean }; stats: { streak: boolean } };
jest.mock('../shown-in-effect', () => ({ useShown: () => mockShown }));
// A binary that can capture the Share Card.
jest.mock('../share/device-share', () => ({
  shareCardOnDevice: () => Promise.resolve('closed'),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

beforeEach(() => {
  mockShown = { entryButtons: { shareCard: true }, stats: { streak: true } };
});

async function renderNotice() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <WeeklyRecapNotice day={{ year: 2026, month: 10, day: 26 }} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  // The recap's numbers are read once the card is drawn.
  await act(async () => {
    await Promise.resolve();
  });
}

/** The Share Card in the share sheet's preview. */
function previewCard() {
  return within(screen.getByTestId('share-preview')).getByTestId('share-card');
}

describe('the Weekly Recap card', () => {
  it('shares «Мій тиждень у SLOVO» with the dates and the four numbers', async () => {
    await renderNotice();

    await fireEvent.press(screen.getByRole('button', { name: 'Поділитися' }));

    expect(previewCard()).toHaveAccessibleName(
      '19–25 жовтня. Мій тиждень у SLOVO. 23 переглянуто. 4 збережено. 9 знаю. 6 серія',
    );
  });

  it('leaves the Streak off its Share Card while the reader hides it', async () => {
    mockShown.stats.streak = false;
    await renderNotice();

    await fireEvent.press(screen.getByRole('button', { name: 'Поділитися' }));

    expect(previewCard()).toHaveAccessibleName(
      '19–25 жовтня. Мій тиждень у SLOVO. 23 переглянуто. 4 збережено. 9 знаю',
    );
  });

  it('has no «Поділитися» with the Share Cards switch off', async () => {
    mockShown.entryButtons.shareCard = false;
    await renderNotice();

    expect(screen.getByLabelText('23 переглянуто')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Поділитися' })).not.toBeOnTheScreen();
  });
});
