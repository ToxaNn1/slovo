import type { EditionStrings } from '@slovo/contracts';
import type { WeeklyRecapModel } from '@slovo/core';
import { EditionProvider, WeeklyRecapCard } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

const strings = {
  feedNotices: {
    weeklyRecap: {
      title: 'Your week',
      seen: 'seen',
      saved: 'saved',
      known: 'known',
      streak: 'streak',
    },
  },
  share: { share: 'Share' },
} as unknown as EditionStrings;

const recap: WeeklyRecapModel = {
  firstDay: { year: 2026, month: 10, day: 19 },
  lastDay: { year: 2026, month: 10, day: 25 },
  seen: 23,
  saved: 4,
  known: 9,
  streak: 6,
};

async function renderCard(props: Parameters<typeof WeeklyRecapCard>[0]) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <WeeklyRecapCard {...props} />
    </EditionProvider>,
  );
}

describe('the Weekly Recap card', () => {
  it("shows «Your week» with the week's Seen, saved and Known numbers and the Streak, each under its label", async () => {
    await renderCard({ recap });

    expect(screen.getByTestId('feed-notice-weeklyRecap')).toBeTruthy();
    expect(screen.getByText('Your week')).toBeTruthy();
    expect(screen.getByLabelText('23 seen')).toBeTruthy();
    expect(screen.getByLabelText('4 saved')).toBeTruthy();
    expect(screen.getByLabelText('9 known')).toBeTruthy();
    expect(screen.getByLabelText('6 streak')).toBeTruthy();
  });

  it('leaves the Known number out when the recap has none, with the Knowledge Marks off', async () => {
    const { known: _, ...withoutKnown } = recap;
    await renderCard({ recap: withoutKnown });

    expect(screen.getByLabelText('23 seen')).toBeTruthy();
    expect(screen.queryByText('known')).toBeNull();
  });

  it('leaves the Streak out while the reader hides it', async () => {
    await renderCard({ recap, hideStreak: true });

    expect(screen.getByLabelText('9 known')).toBeTruthy();
    expect(screen.queryByText('streak')).toBeNull();
  });

  it('shows only its title while the numbers are not read yet', async () => {
    await renderCard({ recap: undefined });

    expect(screen.getByText('Your week')).toBeTruthy();
    expect(screen.queryByText('seen')).toBeNull();
  });

  it('opens its Share Card from «Share» once its numbers are read', async () => {
    const onShare = jest.fn();
    await renderCard({ recap, onShare });

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('has no «Share» without sharing, or while its numbers are not read', async () => {
    await renderCard({ recap });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();

    await renderCard({ recap: undefined, onShare: jest.fn() });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
});
