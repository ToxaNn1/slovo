import type { CalendarDay } from '@slovo/core';
import { BreakCard, coreTokens, EditionProvider, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { testStrings } from '../test-strings';

const strings = testStrings({
  stats: { calendar: { days: { break: '{day} {month}, break' } } },
  dates: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
});

function breakDays(count: number): CalendarDay[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
    day: index + 1,
    month: 11,
    state: 'break',
  }));
}

async function renderCard(strip: readonly CalendarDay[]) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <BreakCard
          testID="break"
          streak={12}
          kicker="Break"
          paused="Streak paused"
          until="Until 14 Nov"
          strip={strip}
          next="Next from 1 Dec"
        />
      </EditionProvider>
    </TokensProvider>,
  );
}

describe('BreakCard', () => {
  it('draws the strip of the Break, a week to a row', async () => {
    await renderCard(breakDays(14));
    expect(screen.getAllByLabelText(/, break$/)).toHaveLength(14);
  });

  it('draws no empty week for a strip without days', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderCard([]);
    expect(screen.getByText('Streak paused')).toBeOnTheScreen();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
