import { describe, expect, it } from '@jest/globals';

import { renderOverComposition, settled } from '../hook-test-support';
import { useClearHistory, useHistoryCount } from './history';

const seen = { seenAt: '2026-10-13T08:00:00.000Z', wordOfTheDay: false };

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
});
