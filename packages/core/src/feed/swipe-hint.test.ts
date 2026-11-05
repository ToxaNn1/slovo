import { describe, expect, it } from 'vitest';

import { createGesturesHint } from '../index';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** The gestures hint sheet over user-state records that survive between app runs. */
async function gesturesHintOver(records: Map<string, string>) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createGesturesHint({ userState });
}

describe('the gestures hint sheet', () => {
  it('is due on the first launch', async () => {
    expect(await (await gesturesHintOver(new Map())).isDue()).toBe(true);
  });

  it('is due for a reader who saw the retired swipe hint', async () => {
    const records = new Map([['feed.swipeHintShown', 'true']]);

    expect(await (await gesturesHintOver(records)).isDue()).toBe(true);
  });

  it('is no longer due once it was shown, and stays shown across a restart', async () => {
    const records = new Map<string, string>();
    const hint = await gesturesHintOver(records);
    await hint.markShown();

    expect(await hint.isDue()).toBe(false);
    expect(await (await gesturesHintOver(records)).isDue()).toBe(false);
  });

  it('leaves the other user state untouched', async () => {
    const records = new Map([['feed.seen.w_1', '1']]);
    await (await gesturesHintOver(records)).markShown();

    expect(records.get('feed.seen.w_1')).toBe('1');
  });
});
