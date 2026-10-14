import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  type Composition,
  type FakeNotificationScheduler,
} from '@slovo/core';
import type { Word } from '@slovo/contracts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  allowNotifications,
  postponeNotifications,
  sampleNotificationOf,
} from './onboarding-notifications';

const ukrainian = loadEdition(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../editions/uk/edition.json', import.meta.url)),
      'utf8',
    ),
  ),
);

const wordOf = (
  id: string,
  lemma: string,
  stress: number,
  primaryDefinition: string,
  categoryId: string,
): Word => ({
  kind: 'word',
  id,
  lemma,
  stress: [stress],
  partOfSpeech: 'adjective',
  primaryDefinition,
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId,
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
});

/** The Core composition of a first launch, over a small Language Pack and the fake scheduler. */
async function open(
  scheduler?: FakeNotificationScheduler,
  records = new Map<string, string>(),
): Promise<Composition> {
  const category = ukrainian.categories[0]?.id ?? '';
  return openComposition({
    content: createMemoryContentPort({
      words: [
        wordOf('w_shparkyi', 'шпаркий', 4, 'швидкий, жвавий', category),
        wordOf('w_two', 'друге', 0, 'The second.', category),
        wordOf('w_three', 'третє', 0, 'The third.', category),
        wordOf('w_four', 'четверте', 0, 'The fourth.', category),
      ],
      corrections: [],
    }),
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: { now: () => new Date('2026-10-14T09:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0 },
    ...(scheduler === undefined ? {} : { scheduling: { scheduler, ellipsis: '…' } }),
  });
}

describe("the onboarding's sample notification", () => {
  it("is built from today's Word of the Day, at the first Notification time", async () => {
    const { feed, notifications } = await open();

    const sample = sampleNotificationOf({
      cards: feed.cards,
      times: notifications.state.times,
      ellipsis: '…',
    });

    const wordOfTheDay = feed.cards.find((card) => card.kind === 'word' && card.wordOfTheDay);
    if (wordOfTheDay?.kind !== 'word') throw new Error('Expected the Word of the Day');
    expect(sample?.wordCard).toBe(wordOfTheDay.wordCard);
    expect(sample?.body).toBe(wordOfTheDay.wordCard.primaryDefinition);
    expect(sample?.time).toBe('09:00');
  });

  it('cuts a long Definition the way the notification does', async () => {
    const { feed } = await open();
    const [card] = feed.cards;
    if (card?.kind !== 'word') throw new Error('Expected a Word card');
    const long = {
      ...card,
      wordCard: { ...card.wordCard, primaryDefinition: 'дуже '.repeat(30).trim() },
    };

    const sample = sampleNotificationOf({ cards: [long], times: ['09:00'], ellipsis: '…' });

    expect(sample?.body.endsWith('…')).toBe(true);
    expect(Array.from(sample?.body ?? '').length).toBeLessThanOrEqual(80);
  });

  it('shows no time once every Notification time is removed', async () => {
    const { feed } = await open();

    expect(sampleNotificationOf({ cards: feed.cards, times: [], ellipsis: '…' })?.time).toBe(
      undefined,
    );
  });

  it('is left out when the Feed has no Word card', () => {
    expect(sampleNotificationOf({ cards: [], times: ['09:00'], ellipsis: '…' })).toBeUndefined();
  });
});

describe('the end of the onboarding', () => {
  it('«Дозволити сповіщення» asks for permission and then finishes', async () => {
    const scheduler = createFakeNotificationScheduler({
      permission: 'not-asked',
      answer: 'allowed',
    });
    const { notifications, onboarding } = await open(scheduler);

    await allowNotifications({ notifications, onboarding });

    expect(notifications.state.permission).toBe('allowed');
    expect(scheduler.plan?.length).toBeGreaterThan(0);
    expect(onboarding.state.finishedAt).toBeDefined();
  });

  it('finishes with permission denied, keeping the times', async () => {
    const scheduler = createFakeNotificationScheduler({
      permission: 'not-asked',
      answer: 'denied',
    });
    const { notifications, onboarding } = await open(scheduler);

    await allowNotifications({ notifications, onboarding });

    expect(notifications.state.permission).toBe('denied');
    expect(notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
    expect(onboarding.state.finishedAt).toBeDefined();
  });

  it('finishes when nothing can ask, as on a dev client without the module', async () => {
    const { notifications, onboarding } = await open();

    await allowNotifications({ notifications, onboarding });

    expect(notifications.state.permission).toBe('not-asked');
    expect(onboarding.state.finishedAt).toBeDefined();
  });

  it('finishes even when asking fails', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'not-asked' });
    const failing = {
      ...scheduler,
      askPermission: () => Promise.reject(new Error('The prompt could not open')),
    };
    const { notifications, onboarding } = await open(failing);

    await allowNotifications({ notifications, onboarding });

    expect(onboarding.state.finishedAt).toBeDefined();
  });

  it('«Пізніше» finishes without asking', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'not-asked' });
    const { notifications, onboarding } = await open(scheduler);

    await postponeNotifications({ onboarding });

    expect(await scheduler.permission()).toBe('not-asked');
    expect(notifications.state.permission).toBe('not-asked');
    expect(onboarding.state.finishedAt).toBeDefined();
  });

  it('keeps the times changed on the step, so Settings › Сповіщення shows them', async () => {
    const records = new Map<string, string>();
    const first = await open(undefined, records);

    await first.notifications.removeTime('13:00');
    await first.notifications.keepTime('21:30');
    await postponeNotifications({ onboarding: first.onboarding });

    const reopened = await open(undefined, records);
    expect(reopened.notifications.state.times).toEqual(['09:00', '19:00', '21:30']);
    expect(reopened.onboarding.state.finishedAt).toBeDefined();
  });
});
