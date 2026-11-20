import type { CalendarDay, CalendarWeek } from '@slovo/core';
import {
  ActiveDaysCalendar,
  coreTokens,
  EditionProvider,
  fontScaleCap,
  TokensProvider,
} from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const plural = (text: string) => ({ one: text, few: text, many: text, other: text });
const monthNames = (suffix: string) =>
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
    (name) => `${name}${suffix}`,
  );

const strings = testStrings({
  game: { round: { progress: '{passed} of {total}' } },
  stats: {
    title: 'Stats',
    streak: plural('days in a row'),
    bestStreak: 'best streak {count}',
    seenToday: plural('seen today'),
    favorites: 'favorites',
    inCollections: plural('in collections'),
    calendar: {
      label: 'Active days',
      weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      days: {
        active: '{day} {month}, active',
        missed: '{day} {month}, missed',
        today: 'Today, {day} {month}',
        todayActive: 'Today, {day} {month}, active',
        future: '{day} {month}, to come',
        break: '{day} {month}, break',
        frozen: '{day} {month}, frozen',
      },
    },
  },
  dates: { months: monthNames('.') },
});

/** 35 days from Monday 28 September 2026, today 28 October, each in the state `stateOf` gives. */
function weeksOf(stateOf: (month: number, day: number) => CalendarDay['state']): CalendarWeek[] {
  const days: CalendarDay[] = Array.from({ length: 35 }, (_, index) => {
    const at = new Date(Date.UTC(2026, 8, 28 + index));
    const month = at.getUTCMonth() + 1;
    const day = at.getUTCDate();
    const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const state = stateOf(month, day);
    return state === 'today'
      ? { date, day, month, state, active: false }
      : { date, day, month, state };
  });
  return Array.from({ length: 5 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}

const weeks = weeksOf((month, day) => {
  if (month === 10 && day === 28) return 'today';
  if (month === 11 || (month === 10 && day > 28)) return 'future';
  if (month === 10 && day === 5) return 'frozen';
  if (month === 10 && day === 12) return 'break';
  return day === 1 || day === 30 ? 'active' : 'missed';
});

// A red accent, as in the UA Edition, so that each day state has its own face.
const light = { ...coreTokens.colors.light, accent: '#E0301E' };
const tokens = { ...coreTokens, colors: { ...coreTokens.colors, light } };

async function renderCalendar(calendar: readonly CalendarWeek[]) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <TokensProvider tokens={tokens} colorScheme="light">
        <EditionProvider edition={{ locale: 'en' }} strings={strings}>
          <ActiveDaysCalendar weeks={calendar} />
        </EditionProvider>
      </TokensProvider>
    </SafeAreaProvider>,
  );
}

describe('the Active Days calendar', () => {
  it('shows the 35 days across months under the weekday names, with no month title', async () => {
    await renderCalendar(weeks);

    expect(screen.getByText('Mo', { includeHiddenElements: true })).toBeOnTheScreen();
    // VoiceOver reads the calendar's name over its weekday names, and each day its own date.
    expect(screen.getByRole('header', { name: 'Active days' })).toBeOnTheScreen();
    expect(screen.queryByText(/2026/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('28 Sep., missed')).toBeOnTheScreen();
    expect(screen.getByLabelText('30 Sep., active')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 Oct., active')).toBeOnTheScreen();
    expect(screen.getByLabelText('5 Oct., frozen')).toBeOnTheScreen();
    expect(screen.getByLabelText('12 Oct., break')).toBeOnTheScreen();
    expect(screen.getByLabelText('Today, 28 Oct.')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 Nov., to come')).toBeOnTheScreen();
  });

  it('keeps the day numbers and weekday names to their cells at the largest text sizes', async () => {
    await renderCalendar(weeks);

    const day = within(screen.getByLabelText('30 Sep., active')).getByText('30', {
      includeHiddenElements: true,
    });
    expect(day).toHaveProp('maxFontSizeMultiplier', fontScaleCap.number);
    expect(screen.getByText('Mo', { includeHiddenElements: true })).toHaveProp(
      'maxFontSizeMultiplier',
      fontScaleCap.number,
    );
  });

  it('draws each day as a tile in its state: active red, today ink, missed plain, to come none', async () => {
    await renderCalendar(weeks);

    const { accent, ink, tile } = light;
    const face = (date: string) => screen.getByTestId(`stats-calendar-${date}-face`);
    expect(face('2026-10-01')).toHaveStyle({ backgroundColor: accent });
    expect(face('2026-10-28')).toHaveStyle({ backgroundColor: ink });
    expect(face('2026-10-02')).toHaveStyle({ backgroundColor: tile });
    expect(face('2026-11-01')).toHaveStyle({
      backgroundColor: 'transparent',
      borderStyle: 'dashed',
    });
  });

  it('is left out with no weeks, as with its Feature Switch off', async () => {
    await renderCalendar([]);

    expect(screen.queryByTestId('stats-calendar')).not.toBeOnTheScreen();
  });
});
