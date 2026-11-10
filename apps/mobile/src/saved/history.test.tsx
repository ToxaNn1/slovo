import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test/test-support';
import { useClearHistory, useHistoryCount, useHistorySections } from './history';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('expo-localization', () => ({
  ...jest.requireActual<object>('expo-localization'),
  getCalendars: () => [{ timeZone: 'Europe/Kyiv' }],
}));

const seen = { seenAt: '2026-10-13T08:00:00.000Z', wordOfTheDay: false };

afterEach(() => {
  jest.useRealTimers();
});

describe('the History hooks', () => {
  it('count the Entries in History and clear them', async () => {
    const { hook } = await renderOverComposition(
      () => ({ count: useHistoryCount(), clear: useClearHistory() }),
      { history: { w_one: seen, w_two: seen } },
    );
    expect(hook.result.current.count).toBe(2);

    await settled(() => {
      hook.result.current.clear();
    });

    expect(hook.result.current.count).toBe(0);
  });

  it('head a day by the device’s day when the screen comes back into focus past midnight', async () => {
    jest.useFakeTimers({ advanceTimers: true, now: new Date('2026-10-13T09:00:00Z') });
    const { hook } = await renderOverComposition(() => useHistorySections(), {
      history: { w_one: seen },
    });
    expect(hook.result.current.map(({ title }) => title)).toEqual(['Сьогодні']);

    // The clock moves past midnight in Kyiv while the screen is away; focus renders it again.
    jest.setSystemTime(new Date('2026-10-14T09:00:00Z'));
    await settled(() => hook.rerender(undefined));

    expect(hook.result.current.map(({ title }) => title)).toEqual(['Учора']);
  });
});
