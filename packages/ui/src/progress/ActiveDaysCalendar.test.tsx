import type { CalendarDay, CalendarMonth, ProgressState } from '@slovo/core';
import { coreTokens, EditionProvider, StatsSheet } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
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
      title: '{month} {year}',
      months: monthNames(''),
      weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      hint: 'Swipe up or down to change the month',
      days: {
        active: '{day} {month}, active',
        missed: '{day} {month}, missed',
        today: 'Today, {day} {month}',
        todayActive: 'Today, {day} {month}, active',
        future: '{day} {month}, to come',
      },
    },
  },
  dates: { months: monthNames('.') },
});

const progress: ProgressState = {
  streak: 1,
  bestStreak: 1,
  freezesHeld: 0,
  seenToday: 0,
  favorites: 0,
  inCollections: 0,
  bestResult: undefined,
  known: { word: 0, correction: 0, idiom: 0, synonymRow: 0, tip: 0 },
  dueToday: 0,
};

/** A month starting on the weekday slot `leading` (Monday 0), each day in the state `stateOf` gives. */
function month(
  year: number,
  number: number,
  leading: number,
  length: number,
  stateOf: (day: number) => CalendarDay,
): CalendarMonth {
  const slots: (CalendarDay | undefined)[] = Array.from({ length: leading }, () => undefined);
  for (let day = 1; day <= length; day += 1) slots.push(stateOf(day));
  while (slots.length % 7 !== 0) slots.push(undefined);
  const weeks = Array.from({ length: slots.length / 7 }, (_, week) =>
    slots.slice(week * 7, week * 7 + 7),
  );
  return { year, month: number, weeks };
}

const date = (m: number, day: number) =>
  `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Today is 27 October 2026; the first Active Day is 29 September.
const september = month(2026, 9, 1, 30, (day) => ({
  date: date(9, day),
  day,
  state: day >= 29 ? 'active' : 'missed',
}));
const october = month(2026, 10, 3, 31, (day): CalendarDay => {
  const base = { date: date(10, day), day };
  if (day === 27) return { ...base, state: 'today', active: false };
  if (day > 27) return { ...base, state: 'future' };
  return { ...base, state: day === 1 || day === 26 ? 'active' : 'missed' };
});

async function renderSheet(calendar: readonly CalendarMonth[]) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <StatsSheet
          visible
          stats={progress}
          knowledge="none"
          calendar={calendar}
          onClose={() => undefined}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

/** A horizontal swipe across the calendar by `distance` points: negative to the left. */
async function swipe(distance: number) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('stats-calendar-swipe'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: distance / 2 },
      { state: State.END, translationX: distance },
    ]);
  });
}

const monthControl = () => screen.getByRole('adjustable', { name: 'Active days' });

/** VoiceOver's swipe up (`increment`) or down (`decrement`) on the month's name. */
async function adjust(actionName: 'increment' | 'decrement') {
  await fireEvent(monthControl(), 'accessibilityAction', { nativeEvent: { actionName } });
}

describe('the Active Days calendar on the stats sheet (spec #832)', () => {
  it('opens on the current month, Monday first, with each day read by VoiceOver', async () => {
    await renderSheet([september, october]);

    expect(monthControl()).toHaveAccessibilityValue({ text: 'Oct 2026' });
    expect(screen.getByText('Oct 2026')).toBeOnTheScreen();
    expect(screen.getByText('Mo', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('1 Oct., active')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 Oct., missed')).toBeOnTheScreen();
    expect(screen.getByLabelText('26 Oct., active')).toBeOnTheScreen();
    expect(screen.getByLabelText('Today, 27 Oct.')).toBeOnTheScreen();
    expect(screen.getByLabelText('31 Oct., to come')).toBeOnTheScreen();
  });

  it('marks an Active Day with a dot in the success colour, never the accent, and a missed one in grey', async () => {
    await renderSheet([september, october]);

    const { correct, track } = coreTokens.colors.light;
    expect(screen.getByTestId('stats-calendar-2026-10-01-dot')).toHaveStyle({
      backgroundColor: correct,
    });
    expect(screen.getByTestId('stats-calendar-2026-10-02-dot')).toHaveStyle({
      backgroundColor: track,
    });
  });

  it('reads today as an Active Day once it is one', async () => {
    const recorded = month(2026, 10, 3, 31, (day): CalendarDay => {
      const base = { date: date(10, day), day };
      if (day === 27) return { ...base, state: 'today', active: true };
      return day > 27 ? { ...base, state: 'future' } : { ...base, state: 'missed' };
    });

    await renderSheet([recorded]);

    expect(screen.getByLabelText('Today, 27 Oct., active')).toBeOnTheScreen();
  });

  it('swipes back to the first Active Day’s month and no further', async () => {
    await renderSheet([september, october]);

    await swipe(120);
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Sep 2026' });
    expect(screen.getByLabelText('28 Sep., missed')).toBeOnTheScreen();
    expect(screen.getByLabelText('29 Sep., active')).toBeOnTheScreen();

    await swipe(120);
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Sep 2026' });
  });

  it('swipes forward to the current month and no further, and a short drag turns nothing', async () => {
    await renderSheet([september, october]);

    await swipe(-120);
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Oct 2026' });

    await swipe(120);
    await swipe(10);
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Sep 2026' });

    await swipe(-120);
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Oct 2026' });
  });

  it('turns the month with VoiceOver’s swipe up and down, within the same limits', async () => {
    await renderSheet([september, october]);

    expect(monthControl()).toHaveProp('accessibilityHint', 'Swipe up or down to change the month');
    await adjust('increment');
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Oct 2026' });
    await adjust('decrement');
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Sep 2026' });
    await adjust('decrement');
    expect(monthControl()).toHaveAccessibilityValue({ text: 'Sep 2026' });
  });

  it('is left out with no months, as with its Feature Switch off', async () => {
    await renderSheet([]);

    expect(screen.queryByTestId('stats-calendar')).not.toBeOnTheScreen();
    expect(screen.getByTestId('stats-favorites')).toBeOnTheScreen();
  });
});
