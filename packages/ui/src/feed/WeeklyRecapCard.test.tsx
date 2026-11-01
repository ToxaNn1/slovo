import type { WeeklyRecapModel } from '@slovo/core';
import { EditionProvider, WeeklyRecapCard } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  feedNotices: {
    weeklyRecap: {
      title: 'Your week',
      seen: 'seen',
      saved: 'saved',
      known: 'known',
      streak: 'streak',
      xp: 'XP',
      goalDays: 'goal days',
      spoken: {
        seen: { one: '{count} entry seen', other: '{count} entries seen' },
        saved: { one: '{count} entry saved', other: '{count} entries saved' },
        known: { one: 'marked known: {count} entry', other: 'marked known: {count} entries' },
        streak: { one: 'streak: {count} day', other: 'streak: {count} days' },
        xp: { one: '{count} XP this week', other: '{count} XP this week' },
        goalDays: { one: 'goal met on {count} day', other: 'goal met on {count} days' },
      },
    },
  },
  share: { share: 'Share' },
});

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
  it("shows «Your week» with the week's Seen, saved and Known numbers and the Streak, each under its label, which VoiceOver reads in the Edition's words", async () => {
    await renderCard({ recap });

    expect(screen.getByTestId('feed-notice-weeklyRecap')).toBeTruthy();
    expect(screen.getByText('Your week')).toBeTruthy();
    expect(screen.getByLabelText('23 entries seen')).toBeTruthy();
    expect(screen.getByLabelText('4 entries saved')).toBeTruthy();
    expect(screen.getByLabelText('marked known: 9 entries')).toBeTruthy();
    expect(screen.getByLabelText('streak: 6 days')).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByText('seen')).toBeTruthy();
  });

  it('VoiceOver reads a number of one in its singular', async () => {
    await renderCard({ recap: { ...recap, saved: 1, streak: 1 } });

    expect(screen.getByLabelText('1 entry saved')).toBeTruthy();
    expect(screen.getByLabelText('streak: 1 day')).toBeTruthy();
  });

  it('leaves the Known number out when the recap has none, with the Knowledge Marks off', async () => {
    const { known: _, ...withoutKnown } = recap;
    await renderCard({ recap: withoutKnown });

    expect(screen.getByLabelText('23 entries seen')).toBeTruthy();
    expect(screen.queryByText('known')).toBeNull();
  });

  it("shows the week's XP and goal days when the recap has them", async () => {
    await renderCard({ recap: { ...recap, xp: 140, goalDays: 3 } });

    expect(screen.getByLabelText('140 XP this week')).toBeTruthy();
    expect(screen.getByLabelText('goal met on 3 days')).toBeTruthy();
  });

  it('leaves XP and goal days out when the recap has none', async () => {
    await renderCard({ recap });

    expect(screen.queryByText('XP')).toBeNull();
    expect(screen.queryByText('goal days')).toBeNull();
  });

  it('leaves the Streak out while the reader hides it', async () => {
    await renderCard({ recap, hideStreak: true });

    expect(screen.getByLabelText('marked known: 9 entries')).toBeTruthy();
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
