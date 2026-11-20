import type { CalendarDay } from '@slovo/core';
import {
  coreTokens,
  EditionProvider,
  fontScaleCap,
  StreakFreezeCard,
  TokensProvider,
} from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

import { testStrings } from '../test-strings';

const strings = testStrings({
  settings: {
    profile: {
      freezeCard: {
        title: 'Streak freeze',
        held: '{count} HELD',
        explanation: 'A freeze covers a missed day.',
        streakDays: { one: 'day-one', few: 'days-few', many: 'days-many', other: 'days-other' },
        saved: { one: 'saved-one', few: 'saved-few', many: 'saved-many', other: 'saved-other' },
      },
    },
  },
  stats: {
    calendar: {
      days: { active: '{day}, active', todayActive: '{day}, today', frozen: '{day}, frozen' },
    },
  },
  dates: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
});

const week: CalendarDay[] = [
  ...[9, 10, 11, 12, 13].map((day) => ({
    date: `2026-11-${String(day).padStart(2, '0')}`,
    day,
    month: 11,
    state: 'active' as const,
  })),
  { date: '2026-11-14', day: 14, month: 11, state: 'frozen' },
  { date: '2026-11-15', day: 15, month: 11, state: 'today', active: true },
];

async function renderCard(streak: number, saved: number) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
        <StreakFreezeCard testID="freeze" held={2} streak={streak} saved={saved} days={week} />
      </EditionProvider>
    </TokensProvider>,
  );
}

describe('StreakFreezeCard', () => {
  it.each([
    [1, 'day-one', 'saved-one'],
    [2, 'days-few', 'saved-few'],
    [5, 'days-many', 'saved-many'],
  ])(
    'reads %i as a big number over its caption, declined for it',
    async (number, streak, saved) => {
      await renderCard(number, number);

      const streakTile = within(screen.getByLabelText(`${String(number)} ${streak}`));
      expect(streakTile.getByText(String(number))).toBeOnTheScreen();
      expect(streakTile.getByText(streak)).toBeOnTheScreen();
      const savedTile = within(screen.getByLabelText(`${String(number)} ${saved}`));
      expect(savedTile.getByText(String(number))).toBeOnTheScreen();
      expect(savedTile.getByText(saved)).toBeOnTheScreen();
    },
  );

  it('shows the freezes held, what a freeze does and the 7 days', async () => {
    await renderCard(23, 1);

    expect(screen.getByText('2 HELD')).toBeOnTheScreen();
    expect(screen.getByText('A freeze covers a missed day.')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/, (active|frozen|today)$/)).toHaveLength(7);
    expect(screen.getByLabelText('15, today')).toBeOnTheScreen();
  });

  it('keeps the chip and the day numbers to their boxes at the largest text sizes', async () => {
    await renderCard(23, 1);

    expect(screen.getByText('2 HELD')).toHaveProp('maxFontSizeMultiplier', fontScaleCap.number);
    expect(
      within(screen.getByLabelText('15, today')).getByText('15', { includeHiddenElements: true }),
    ).toHaveProp('maxFontSizeMultiplier', fontScaleCap.number);
  });
});
