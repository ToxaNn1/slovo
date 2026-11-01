import { describe, expect, it } from 'vitest';

import { openTrackedUserState } from '../user-state/tracked-user-state';
import { createMemoryUserStatePort } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { readFact, seedUserState } from './seeded-user-state';

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

describe('a seeded user state', () => {
  it('holds each fact it was seeded with, a single value or one per id', async () => {
    const userState = await seedUserState({
      installed: true,
      onboardingFinished: '2026-09-01T09:00:00Z',
      gameBest: { 'guess-word': 13, 'odd-one-out': 4 },
    });

    expect(await readFact(userState, 'installed')).toBe(true);
    expect(await readFact(userState, 'onboardingFinished')).toBe('2026-09-01T09:00:00Z');
    expect(await readFact(userState, 'gameBest')).toEqual(
      new Map([
        ['guess-word', 13],
        ['odd-one-out', 4],
      ]),
    );
  });

  it('holds nothing it was not seeded with', async () => {
    const userState = await seedUserState();

    expect(await readFact(userState, 'installed')).toBeUndefined();
    expect(await readFact(userState, 'history')).toEqual(new Map());
  });

  it('leaves no pending change for a seeded fact, as a record kept from before', async () => {
    const userState = await seedUserState({ selfCheck: true, activeDays: { '2026-10-27': true } });

    expect(await userState.pendingChanges()).toEqual(new Map());
  });

  it('tracks each later write of a synced record at the clock’s time', async () => {
    const userState = await seedUserState({}, { clock });

    await userState.write(userStateRecords.selfCheck.change(true));

    expect(await userState.pendingChanges()).toEqual(
      new Map([
        ['settings.selfCheck', { changedAt: new Date('2026-10-28T09:00:00Z'), value: 'true' }],
      ]),
    );
  });

  it('seeds the port given, so the user state opened over it again finds the facts', async () => {
    const port = createMemoryUserStatePort();
    await seedUserState({ noCounters: true }, { port });

    const reopened = await openTrackedUserState({ port, clock });

    expect(await readFact(reopened, 'noCounters')).toBe(true);
  });
});
