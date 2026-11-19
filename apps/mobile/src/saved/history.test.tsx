import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test/test-support';
import { useClearHistory, useHistoryCount, useHistoryRows } from './history';

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

  it('leave the count’s reader still when History changes but its count does not', async () => {
    let renders = 0;
    // `w_gone` is not in the Language Pack: History keeps its record, lists nothing for it.
    const { hook } = await renderOverComposition(
      () => {
        renders += 1;
        return { count: useHistoryCount(), clear: useClearHistory() };
      },
      { history: { w_gone: seen } },
    );
    const before = renders;

    await settled(() => {
      hook.result.current.clear();
    });

    expect(hook.result.current.count).toBe(0);
    expect(renders).toBe(before);
  });

  it('keep each row as it was while its Entry and the day stay the same', async () => {
    jest.useFakeTimers({ advanceTimers: true, now: new Date('2026-10-13T09:00:00Z') });
    const { hook } = await renderOverComposition(() => useHistoryRows(), {
      history: { w_one: seen, w_two: seen },
    });
    const before = hook.result.current;

    await settled(() => hook.rerender(undefined));

    expect(hook.result.current).toHaveLength(2);
    hook.result.current.forEach((row, at) => {
      expect(row).toBe(before[at]);
    });
  });

  it('say the day an Entry was Seen by the device’s day when the screen comes back into focus past midnight', async () => {
    jest.useFakeTimers({ advanceTimers: true, now: new Date('2026-10-13T09:00:00Z') });
    const { hook } = await renderOverComposition(() => useHistoryRows(), {
      history: { w_one: seen },
    });
    expect(hook.result.current.map(({ day }) => day)).toEqual([{ label: 'сьогодні', today: true }]);

    // The clock moves past midnight in Kyiv while the screen is away; focus renders it again.
    jest.setSystemTime(new Date('2026-10-14T09:00:00Z'));
    await settled(() => hook.rerender(undefined));

    expect(hook.result.current.map(({ day }) => day)).toEqual([{ label: 'учора', today: false }]);
  });
});
