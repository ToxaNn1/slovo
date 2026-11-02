import { describe, expect, it } from 'vitest';

import { launchKind } from '../index';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

describe('launchKind', () => {
  it('is the first launch while the onboarding was never finished', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
    expect(await launchKind(userState)).toBe('first');
  });

  it('is the daily open once the onboarding was finished or skipped', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
    await userState.write(
      new Map(userStateRecords.onboardingFinished.change('2026-11-01T09:00:00.000Z')),
    );
    expect(await launchKind(userState)).toBe('daily');
  });
});
