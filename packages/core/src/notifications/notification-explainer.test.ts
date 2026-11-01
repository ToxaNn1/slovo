import { describe, expect, it } from 'vitest';

import type { FeatureSwitch, Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type NotificationPermission,
} from '../index';
import { createFakeNotificationScheduler, createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';

const words: readonly Word[] = Array.from({ length: 40 }, (_, index) =>
  word(`w_${String(index).padStart(2, '0')}`),
);

/** The onboarding was finished on 2026-10-11, the onboarding day 1. */
const onboarded: [string, string] = [
  'onboarding.finished',
  JSON.stringify('2026-10-11T06:00:00.000Z'),
];

/** The record of XP earned on a local date. */
const xpOn = (date: string, amount: number): [string, string] => [
  `xp.xp-${date}-${String(amount)}`,
  JSON.stringify({ kind: 'xp', date, at: `${date}T07:00:00.000Z`, source: 'game-round', amount }),
];

const switches: readonly FeatureSwitch[] = [
  'notifications',
  'notificationExplainer',
  'xpLog',
  'dailyGoal',
];

/** One app run at 09:00 on a local date, over the records, so the user state survives between runs. */
async function run({
  records,
  date,
  permission = 'not-asked',
  answer = 'allowed',
  on = switches,
}: {
  records: Map<string, string>;
  date: string;
  permission?: NotificationPermission;
  answer?: 'allowed' | 'denied';
  on?: readonly FeatureSwitch[];
}): Promise<Composition> {
  const { clock } = fakeClock(`${date}T09:00:00+03:00`);
  return openComposition({
    content: createMemoryContentPort({ words }),
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
      userSettingDefaults: {
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: randomOf(0.25),
    scheduling: {
      scheduler: createFakeNotificationScheduler({ permission, answer }),
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Пауза',
      streakWarning: 'Серія',
      goalNotMet: 'Ціль',
    },
  });
}

/** The ask the Feed of a run shows in its first cards, if any. */
async function askIn(app: Composition): Promise<string | undefined> {
  for (let position = 0; position < 3; position += 1) await app.feed.show(position);
  const found = app.feed.cards.find(
    (card) =>
      card.kind === 'notice' &&
      (card.notice === 'notificationExplainer' || card.notice === 'notificationReask'),
  );
  return found?.kind === 'notice' ? found.notice : undefined;
}

/** The ask on each of the local dates, one app run each, over the same records. */
async function asksOn(
  records: Map<string, string>,
  dates: readonly string[],
): Promise<(string | undefined)[]> {
  const asks: (string | undefined)[] = [];
  for (const date of dates) asks.push(await askIn(await run({ records, date })));
  return asks;
}

// Spec #1358, ticket #1381, ADR 0067: the explainer right after the first met Daily Goal, no later than day 3.
describe('the notification explainer', () => {
  it('comes on the day the Daily Goal is first met', async () => {
    const records = new Map([onboarded, xpOn('2026-10-11', 20)]);

    expect(await askIn(await run({ records, date: '2026-10-11' }))).toBe('notificationExplainer');
  });

  it('comes on day 3 at the latest, not before, while no goal is met', async () => {
    const records = new Map([onboarded]);

    expect(await asksOn(records, ['2026-10-11', '2026-10-12', '2026-10-13'])).toEqual([
      undefined,
      undefined,
      'notificationExplainer',
    ]);
  });

  it('comes before the onboarding is finished never, nor to a reader the device asked already', async () => {
    const goal = xpOn('2026-10-13', 20);
    const before = await run({ records: new Map([goal]), date: '2026-10-13' });
    const allowed = await run({
      records: new Map([onboarded, goal]),
      date: '2026-10-13',
      permission: 'allowed',
    });
    const denied = await run({
      records: new Map([onboarded, goal]),
      date: '2026-10-13',
      permission: 'denied',
    });

    for (const app of [before, allowed, denied]) expect(await askIn(app)).toBeUndefined();
  });

  it('never comes while its Feature Switch is off', async () => {
    const app = await run({
      records: new Map([onboarded, xpOn('2026-10-13', 20)]),
      date: '2026-10-13',
      on: switches.filter((feature) => feature !== 'notificationExplainer'),
    });

    expect(await askIn(app)).toBeUndefined();
  });

  it('asks the device only on «Так»', async () => {
    const records = new Map([onboarded]);
    const app = await run({ records, date: '2026-10-13' });
    expect(await askIn(app)).toBe('notificationExplainer');
    expect(app.notifications.state.permission).toBe('not-asked');

    expect(await app.notifications.askPermission()).toBe('allowed');
  });

  it('after a refusal asks once more 7 days later, then never again', async () => {
    const records = new Map([onboarded]);

    expect(
      await asksOn(records, [
        '2026-10-13',
        '2026-10-13',
        '2026-10-14',
        '2026-10-19',
        '2026-10-20',
        '2026-10-20',
        '2026-10-21',
        '2026-11-20',
      ]),
    ).toEqual([
      'notificationExplainer',
      // Swiped past, it is closed for the day, as every Feed Notice.
      undefined,
      undefined,
      undefined,
      'notificationReask',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('asks no more once the reader answered the device', async () => {
    const records = new Map([onboarded]);
    const app = await run({ records, date: '2026-10-13', answer: 'denied' });
    expect(await askIn(app)).toBe('notificationExplainer');
    await app.notifications.askPermission();

    const later = await run({ records, date: '2026-10-20', permission: 'denied' });
    expect(await askIn(later)).toBeUndefined();
  });
});
