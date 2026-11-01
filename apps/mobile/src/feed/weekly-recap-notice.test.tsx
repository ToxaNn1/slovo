import { describe, expect, it } from '@jest/globals';
import type { WeeklyRecapModel } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { WeeklyRecapNotice } from './weekly-recap-notice';

const recap: WeeklyRecapModel = {
  firstDay: { year: 2026, month: 10, day: 19 },
  lastDay: { year: 2026, month: 10, day: 25 },
  seen: 23,
  saved: 4,
  known: 9,
  streak: 6,
};

/** The Edition in effect: as it ships, or with Share Cards off. */
const editionWith = ({ shareCards }: { shareCards: boolean }): typeof edition => ({
  ...edition,
  isFeatureEnabled: (feature) =>
    feature === 'shareCards' ? shareCards : edition.isFeatureEnabled(feature),
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * The card over the Core's composition of a test Shell, whose recap of the
 * week holds the numbers above, on a binary that can capture the Share Card,
 * with Share Cards on in effect and the Streak shown unless a test says otherwise.
 */
async function renderNotice({ shareCards = true, noCounters = false } = {}) {
  const composition = await testShell().composition.opened();
  const shell = testShell({
    composition: opened({
      ...composition,
      weeklyRecap: { ...composition.weeklyRecap, of: () => Promise.resolve(recap) },
    }),
    remoteSwitches: switchedTo(editionWith({ shareCards })),
    settings: await settingsAt({ noCounters }),
    shareCard: () => Promise.resolve('closed'),
  });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <WeeklyRecapNotice day={{ year: 2026, month: 10, day: 26 }} />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
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
      '19–25 жовтня. Мій тиждень у SLOVO. переглянуто 23 записи. збережено 4 записи. позначено «Знаю»: 9 записів. серія: 6 днів поспіль',
    );
  });

  it('leaves the Streak off its Share Card while the reader hides it', async () => {
    await renderNotice({ noCounters: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Поділитися' }));

    expect(previewCard()).toHaveAccessibleName(
      '19–25 жовтня. Мій тиждень у SLOVO. переглянуто 23 записи. збережено 4 записи. позначено «Знаю»: 9 записів',
    );
  });

  it('has no «Поділитися» with the Share Cards switch off', async () => {
    await renderNotice({ shareCards: false });

    expect(screen.getByLabelText('переглянуто 23 записи')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Поділитися' })).not.toBeOnTheScreen();
  });
});
