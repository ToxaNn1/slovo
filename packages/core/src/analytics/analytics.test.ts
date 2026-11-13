import { describe, expect, it } from 'vitest';

import { FeatureSwitchesSchema } from '@slovo/contracts';

import {
  createAnalytics,
  createSettings,
  createVisit,
  evaluateSwitches,
  openComposition,
  readInstallId,
  type AnalyticsPort,
  type FeatureSwitch,
} from '../index';
import { type AnalyticsReader, type AnalyticsSwitches } from './analytics';
import { type RemoteRule } from '../edition/switch-evaluator';
import { createFakeNotificationScheduler, createMemoryContentPort } from '../testing';
import {
  analyticsInto,
  correction,
  fakeClock,
  idiom,
  readerFacts,
  seededRandom,
  settle,
  testEdition,
  word,
} from '../test-support';
import { createMemoryUserStatePort, openUserState, type UserState } from '../user-state/user-state';

const SECOND = 1000;

const content = createMemoryContentPort({
  words: [word('w_one', { rarity: 4, categoryId: 'human-body' })],
  corrections: [correction('c_one', { categoryId: 'calques' })],
  idioms: [idiom('i_one')],
});

/** A port that keeps what reached it. */
function fakePort() {
  const events: unknown[][] = [];
  const readers: AnalyticsReader[] = [];
  let stops = 0;
  const port: AnalyticsPort = {
    // The onboarding, which opens on a fresh user state, has events of its own.
    track: (event, properties, reader) => {
      if (event.startsWith('onboarding')) return;
      events.push([event, properties]);
      readers.push(reader);
    },
    stop: () => void (stops += 1),
  };
  return { port, events, readers, stops: () => stops };
}

/** One app run with the Analytics port, its settings over the same user state. */
async function run({
  on = ['knowledge', 'analytics'],
  switches,
}: {
  on?: readonly FeatureSwitch[];
  /** What the events say of the reader; the test device with no Rule unless given. */
  switches?: (userState: UserState) => Promise<AnalyticsSwitches>;
} = {}) {
  const fake = fakePort();
  const edition = testEdition({ isFeatureEnabled: (feature) => on.includes(feature) });
  const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
  const time = fakeClock('2026-10-31T09:00:00.000Z');
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: time.clock,
    random: { next: () => 0.25 },
    analytics:
      switches === undefined
        ? analyticsInto(fake.port)
        : { port: fake.port, switches: await switches(userState) },
  });
  const settings = createSettings({
    userState,
    defaults: edition.userSettingDefaults,
    analytics: createAnalytics({ edition, userState, sink: analyticsInto(fake.port) }),
  });
  return { app, settings, time, ...fake };
}

const theWord = { entryKind: 'word', rarity: 4, categoryId: 'human-body' };

// Spec #1358 story 85; ADR 0068: the events reach the port with their properties.
describe('Analytics', () => {
  it('sends the marks, Favorites, Pronunciation and Word History with the Entry kind, rarity and Category', async () => {
    const { app, events } = await run();

    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('c_one', 'unknown');
    await app.favorites.add('i_one');
    await app.favorites.remove('i_one');
    await app.analytics.pronunciationPlayed('w_one');
    await app.analytics.wordHistoryOpened('w_one');
    await settle();

    expect(events).toEqual([
      ['known', theWord],
      ['unknown', { entryKind: 'correction', rarity: null, categoryId: 'calques' }],
      ['favoriteAdded', { entryKind: 'idiom', rarity: null, categoryId: null }],
      ['favoriteRemoved', { entryKind: 'idiom', rarity: null, categoryId: null }],
      ['pronunciationPlayed', theWord],
      ['wordHistoryOpened', theWord],
    ]);
  });

  it('sends Seen once a card has been on screen, with what the Entry is', async () => {
    const { app, time, events } = await run();

    await app.feed.show(0);
    time.advance(2 * SECOND);
    await app.feed.show(undefined);
    await settle();

    expect(events).toHaveLength(1);
    expect([
      ['seen', theWord],
      ['seen', { entryKind: 'correction', rarity: null, categoryId: 'calques' }],
      ['seen', { entryKind: 'idiom', rarity: null, categoryId: null }],
    ]).toContainEqual(events[0]);
  });

  it('sends a screen viewed and a setting changed', async () => {
    const { app, settings, events } = await run();

    await app.analytics.screenViewed('settings');
    await settings.update({ theme: 'dark' });

    expect(events).toEqual([
      ['screenViewed', { screen: 'settings' }],
      ['settingChanged', { setting: 'theme', value: 'dark' }],
    ]);
  });

  it('sends a setting changed only for a value that changed', async () => {
    const { settings, events } = await run();
    const { theme } = await settings.read();

    await settings.update({ theme });
    await settings.update({ theme: 'dark', vibration: (await settings.read()).vibration });
    await settings.update({ theme: 'dark' });

    expect(events).toEqual([['settingChanged', { setting: 'theme', value: 'dark' }]]);
  });

  it('sends each notification opened with its kind, and nothing while sharing is off', async () => {
    const { app, settings, events } = await run();

    await app.analytics.notificationOpened('word');
    await app.analytics.notificationOpened('evening');
    await settings.update({ shareCounters: false });
    await app.analytics.notificationOpened('farewell');

    expect(events).toEqual([
      ['notificationOpened', { kind: 'word' }],
      ['notificationOpened', { kind: 'evening' }],
    ]);
  });

  it('sends «Без лічильників» turned on and off as a setting changed, and nothing while sharing is off', async () => {
    const { settings, events } = await run();

    await settings.update({ noCounters: true });
    await settings.update({ noCounters: false });
    await settings.update({ shareCounters: false });
    await settings.update({ noCounters: true });

    expect(events).toEqual([
      ['settingChanged', { setting: 'noCounters', value: true }],
      ['settingChanged', { setting: 'noCounters', value: false }],
    ]);
  });

  it('sends nothing once sharing is off, the change that turns it off included, and stops the port', async () => {
    const { app, settings, events, stops } = await run();

    await settings.update({ shareCounters: false });
    await app.knowledge.tap('w_one', 'known');
    await app.favorites.add('w_one');
    await app.analytics.screenViewed('feed');
    await settle();

    expect(events).toEqual([]);
    expect(stops()).toBe(1);
  });

  it('sends nothing while the Edition switches Analytics off', async () => {
    const { app, events } = await run({ on: ['knowledge'] });

    await app.knowledge.tap('w_one', 'known');
    await app.analytics.screenViewed('feed');
    await settle();

    expect(events).toEqual([]);
  });
});

const everyFeatureOn = FeatureSwitchesSchema.parse(
  Object.fromEntries(FeatureSwitchesSchema.keyof().options.map((feature) => [feature, 'on'])),
);

const rule = (changes: Partial<RemoteRule> & Pick<RemoteRule, 'feature'>): RemoteRule => ({
  id: `${changes.feature}-rule`,
  verdict: 'on',
  targets: {},
  ...changes,
});

/** The verdicts of `rules` for an Install id, at a frozen moment. */
const verdictsFor = (rules: readonly RemoteRule[], installId: string) =>
  evaluateSwitches({
    rules,
    states: everyFeatureOn,
    facts: {
      ...readerFacts(),
      installId,
      clock: fakeClock('2026-11-08T12:00:00.000Z').clock,
      clockOffsetMs: 0,
    },
  });

/** The device's own Install id, made from a seeded random, and the verdicts of `rules` for it. */
const switchesOf =
  (rules: readonly RemoteRule[]) =>
  async (userState: UserState): Promise<AnalyticsSwitches> => {
    const installId = await readInstallId({ userState, random: seededRandom(11) });
    return { installId, verdicts: verdictsFor(rules, installId) };
  };

// Spec #1709 stories 29, 37, 38; ADR 0068, 0089: who an event comes from.
describe('Analytics distinct id and Variants', () => {
  const abTest = rule({ feature: 'gameTimed', verdict: { variants: ['a', 'b'] } });

  it('sends every event with the Install id as distinct id and the Variant of each A/B switch on', async () => {
    let installId = '';
    const { app, readers } = await run({
      switches: async (userState) => {
        const switches = await switchesOf([abTest])(userState);
        installId = switches.installId;
        return switches;
      },
    });

    await app.knowledge.tap('w_one', 'known');
    await app.analytics.screenViewed('feed');
    await settle();

    const verdict = verdictsFor([abTest], installId).gameTimed;
    const variant = verdict.on ? verdict.variant : undefined;
    expect(['a', 'b']).toContain(variant);
    expect(readers).toHaveLength(2);
    expect(readers).toEqual([
      { distinctId: installId, edition: 'test', variants: { variant_gameTimed: variant } },
      { distinctId: installId, edition: 'test', variants: { variant_gameTimed: variant } },
    ]);
  });

  it('sends nothing with Analytics off, while the Install id still picks the rollout share', async () => {
    const rollout = rule({
      id: 'rollout',
      feature: 'tips',
      verdict: 'off',
      targets: { share: 50 },
    });
    let switches: AnalyticsSwitches | undefined;
    const { app, settings, events, readers } = await run({
      switches: async (userState) => {
        switches = await switchesOf([abTest, rollout])(userState);
        return switches;
      },
    });
    await settings.update({ shareCounters: false });
    await app.knowledge.tap('w_one', 'known');
    await app.analytics.screenViewed('feed');
    await settle();

    const off = await run({ on: ['knowledge'], switches: switchesOf([abTest]) });
    await off.app.analytics.screenViewed('feed');
    await settle();

    expect([events, readers, off.events, off.readers]).toEqual([[], [], [], []]);
    expect(switches?.verdicts.tips).toEqual(verdictsFor([rollout], switches?.installId ?? '').tips);
  });

  it('adds no property for a switch without Variants and the same Variant to each event of one Install id', async () => {
    const plain = rule({ feature: 'tips' });
    const { app, readers } = await run({ switches: switchesOf([plain, abTest]) });

    await app.analytics.screenViewed('feed');
    await app.analytics.screenViewed('settings');
    await app.knowledge.tap('w_one', 'known');
    await settle();

    expect(readers).toHaveLength(3);
    expect(readers.map(({ variants }) => Object.keys(variants))).toEqual([
      ['variant_gameTimed'],
      ['variant_gameTimed'],
      ['variant_gameTimed'],
    ]);
    expect(new Set(readers.map(({ variants }) => variants.variant_gameTimed)).size).toBe(1);
  });
});

// Spec #1709, ticket #1727: the events the admin's Аналітика reads, each behind its own Feature Switch.
describe('Analytics for the admin', () => {
  const eventSwitches = [
    'analyticsSessions',
    'analyticsFeatureUsed',
    'analyticsSearchNoResult',
    'analyticsNotificationPermission',
    'analyticsNps',
    'analyticsGames',
  ] as const satisfies readonly FeatureSwitch[];

  async function runWith(on: readonly FeatureSwitch[]) {
    const fake = fakePort();
    const edition = testEdition({ isFeatureEnabled: (feature) => on.includes(feature) });
    const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
    const time = fakeClock('2026-10-31T09:00:00.000Z');
    const visit = createVisit();
    const reopen = () =>
      openComposition({
        content,
        edition,
        userState,
        clock: time.clock,
        random: { next: () => 0.25 },
        analytics: analyticsInto(fake.port),
        visit,
      });
    const app = await openComposition({
      content,
      edition,
      userState,
      clock: time.clock,
      random: { next: () => 0.25 },
      analytics: analyticsInto(fake.port),
      visit,
      scheduling: {
        scheduler: createFakeNotificationScheduler({ permission: 'not-asked', answer: 'denied' }),
        ellipsis: '…',
        titles: ['{word}'],
        farewell: 'Пауза',
        streakWarning: 'Серія',
        goalNotMet: 'Ціль',
      },
    });
    const analytics = createAnalytics({ edition, userState, sink: analyticsInto(fake.port) });
    return { app, analytics, time, reopen, ...fake };
  }

  /** Every new event, through the seams the app uses. */
  async function sendEach({ app, analytics, time }: Awaited<ReturnType<typeof runWith>>) {
    await app.analytics.sessionStarted();
    time.advance(90 * SECOND);
    await app.analytics.sessionEnded();
    await app.analytics.screenViewed('/search');
    await app.search.search('ябз');
    await app.notifications.askPermission();
    await analytics.track('npsAnswered', { score: 9 });
    await analytics.track('gameStarted', { mode: 'guessWord' });
    await settle();
  }

  it('sends each event with its Feature Switch on, with counts and labels only', async () => {
    const running = await runWith(['analytics', 'search', ...eventSwitches]);
    await sendEach(running);

    expect(running.events).toEqual([
      ['sessionStarted', {}],
      ['sessionEnded', { durationSeconds: 90 }],
      ['screenViewed', { screen: '/search' }],
      ['featureUsed', { feature: 'search' }],
      ['searchNoResult', { queryLength: 3 }],
      ['notificationPermissionAnswered', { granted: false }],
      ['npsAnswered', { score: 9 }],
      ['gameStarted', { mode: 'guessWord' }],
    ]);
    for (const reader of running.readers) expect(reader.edition).toBe('test');
  });

  it('sends none of them while its Feature Switch is off', async () => {
    const running = await runWith(['analytics', 'search']);
    await sendEach(running);

    expect(running.events).toEqual([['screenViewed', { screen: '/search' }]]);
  });

  it('sends no featureUsed for a screen of no Feature Switch', async () => {
    const running = await runWith(['analytics', ...eventSwitches]);
    await running.app.analytics.screenViewed('/entry/[entryId]');
    await settle();

    expect(running.events).toEqual([['screenViewed', { screen: '/entry/[entryId]' }]]);
  });

  it('ends a Visit begun before the composition reopened', async () => {
    const running = await runWith(['analytics', ...eventSwitches]);
    await running.app.analytics.sessionStarted();
    running.time.advance(90 * SECOND);
    const reopened = await running.reopen();
    await reopened.analytics.sessionEnded();
    await settle();

    expect(running.events).toEqual([
      ['sessionStarted', {}],
      ['sessionEnded', { durationSeconds: 90 }],
    ]);
  });
});
