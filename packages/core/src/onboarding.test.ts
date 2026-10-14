import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
} from './index';

const word: Word = {
  kind: 'word',
  id: 'w_one',
  lemma: 'one',
  stress: [0],
  partOfSpeech: 'noun',
  primaryDefinition: 'The meaning of one.',
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'test',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
};
const content = createMemoryContentPort({ words: [word], corrections: [] });

/** A clock the test moves by hand. */
function fakeClock(start = '2026-10-14T09:00:00+03:00') {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
  };
}

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock().clock,
}: { records?: Map<string, string>; clock?: Clock } = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      categories: [{ id: 'test', displayName: 'Test' }],
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: false },
        notificationTimes: [],
      },
      isFeatureEnabled: () => false,
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
}

describe('Onboarding', () => {
  it('is not finished on a fresh install', async () => {
    const app = await run();

    expect(app.onboarding.state).toEqual({ finishedAt: undefined });
  });

  it('is finished as of the moment it ends, and tells the subscribers', async () => {
    const app = await run();
    const before = app.onboarding.state;
    let told = 0;
    app.onboarding.subscribe(() => {
      told += 1;
    });

    await app.onboarding.finish();

    expect(app.onboarding.state).toEqual({ finishedAt: new Date('2026-10-14T09:00:00+03:00') });
    expect(app.onboarding.state).not.toBe(before);
    expect(told).toBe(1);
  });

  it('stays finished when the app is opened again', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).onboarding.finish();

    const reopened = await run({ records });

    expect(reopened.onboarding.state).toEqual({
      finishedAt: new Date('2026-10-14T09:00:00+03:00'),
    });
  });

  it('stays unfinished when the app is closed before it ends', async () => {
    const records = new Map<string, string>();
    await run({ records });

    const reopened = await run({ records });

    expect(reopened.onboarding.state.finishedAt).toBeUndefined();
  });

  it('keeps the first moment when it ends again, and tells nobody', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await app.onboarding.finish();
    const finished = app.onboarding.state;
    let told = 0;
    app.onboarding.subscribe(() => {
      told += 1;
    });

    time.advance(60_000);
    await app.onboarding.finish();

    expect(app.onboarding.state).toBe(finished);
    expect(told).toBe(0);
  });

  it('is not finished by a record it cannot read', async () => {
    const app = await run({ records: new Map([['onboarding.finished', '"yesterday"']]) });

    expect(app.onboarding.state.finishedAt).toBeUndefined();
  });
});
