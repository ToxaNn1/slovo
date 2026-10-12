import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, createSwipeHint, openUserState } from './index';

/** The swipe hint over user-state records that survive between app runs. */
async function swipeHintOver(records: Map<string, string>) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createSwipeHint({ userState });
}

describe('the swipe hint', () => {
  it('is due on the first launch', async () => {
    const hint = await swipeHintOver(new Map());

    expect(await hint.isDue()).toBe(true);
  });

  it('is no longer due once it was shown', async () => {
    const hint = await swipeHintOver(new Map());
    await hint.markShown();

    expect(await hint.isDue()).toBe(false);
  });

  it('stays shown across a restart, so it shows only once', async () => {
    const records = new Map<string, string>();
    await (await swipeHintOver(records)).markShown();

    expect(await (await swipeHintOver(records)).isDue()).toBe(false);
  });

  it('leaves the other user state untouched', async () => {
    const records = new Map([['feed.seen.w_1', 'true']]);
    await (await swipeHintOver(records)).markShown();

    expect(records.get('feed.seen.w_1')).toBe('true');
  });
});
