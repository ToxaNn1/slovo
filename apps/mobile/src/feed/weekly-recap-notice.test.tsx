import { describe, expect, it } from '@jest/globals';
import type { WeeklyRecapModel } from '@slovo/core';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { editionAtLaunch as edition } from '../edition/edition-at-launch';
import { settingsAt, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';
import { WeeklyRecapNotice } from './weekly-recap-notice';

const recap: WeeklyRecapModel = {
  firstDay: { year: 2026, month: 10, day: 19 },
  lastDay: { year: 2026, month: 10, day: 25 },
  seen: 23,
  saved: 4,
  known: 9,
  streak: 6,
  xp: 140,
  goalDays: 3,
};

/** The Edition in effect: as it ships, or with Share Cards off. */
const editionWith = ({ shareCards }: { shareCards: boolean }): typeof edition => ({
  ...edition,
  isFeatureEnabled: (feature) =>
    feature === 'shareCards' ? shareCards : edition.isFeatureEnabled(feature),
});

/**
 * The card of the week with the numbers above, on a binary that can capture the Share Card,
 * with Share Cards on in effect and the Streak shown unless a test says otherwise.
 */
async function renderNotice({ shareCards = true, noCounters = false } = {}) {
  const shell = testShell({
    remoteSwitches: switchedTo(editionWith({ shareCards })),
    settings: await settingsAt({ noCounters }),
    shareCard: () => Promise.resolve('closed'),
  });
  await renderApp(<WeeklyRecapNotice recap={recap} />, { shell });
}

/** The Share Card in the share sheet's preview. */
function previewCard() {
  return within(screen.getByTestId('share-preview')).getByTestId('share-card');
}

describe('the Weekly Recap card', () => {
  it("shares «Мій тиждень у SLOVO» with the dates, the four numbers and the week's XP and goal days", async () => {
    await renderNotice();

    await fireEvent.press(screen.getByRole('button', { name: 'Поділитися' }));

    expect(previewCard()).toHaveAccessibleName(
      '19–25 жовтня. Мій тиждень у SLOVO. переглянуто 23 картки. збережено 4 картки. позначено «Знаю»: 9 карток. серія: 6 днів поспіль. 140 XP за тиждень. ціль виконано: 3 дні із семи',
    );
  });

  it('leaves the Streak, the XP and the goal days off the card and its Share Card with «Без лічильників»', async () => {
    await renderNotice({ noCounters: true });

    expect(screen.queryByLabelText('140 XP за тиждень')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('ціль виконано: 3 дні із семи')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Поділитися' }));

    expect(previewCard()).toHaveAccessibleName(
      '19–25 жовтня. Мій тиждень у SLOVO. переглянуто 23 картки. збережено 4 картки. позначено «Знаю»: 9 карток',
    );
  });

  it('has no «Поділитися» with the Share Cards switch off', async () => {
    await renderNotice({ shareCards: false });

    expect(screen.getByLabelText('переглянуто 23 картки')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Поділитися' })).not.toBeOnTheScreen();
  });
});
