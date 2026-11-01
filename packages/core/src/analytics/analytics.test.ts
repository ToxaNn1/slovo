import { describe, expect, it } from 'vitest';

import {
  createAnalytics,
  createMemoryUserStatePort,
  createSettings,
  openComposition,
  openUserState,
  type AnalyticsPort,
  type FeatureSwitch,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, idiom, settle, testEdition, word } from '../test-support';

const SECOND = 1000;

const content = createMemoryContentPort({
  words: [word('w_one', { rarity: 4, categoryId: 'human-body' })],
  corrections: [correction('c_one', { categoryId: 'calques' })],
  idioms: [idiom('i_one')],
});

/** A port that keeps what reached it. */
function fakePort() {
  const events: unknown[][] = [];
  let stops = 0;
  const port: AnalyticsPort = {
    // The onboarding, which opens on a fresh user state, has events of its own.
    track: (event, properties) => {
      if (!event.startsWith('onboarding')) events.push([event, properties]);
    },
    stop: () => void (stops += 1),
  };
  return { port, events, stops: () => stops };
}

/** One app run with the Analytics port, its settings over the same user state. */
async function run({ on = ['knowledge', 'analytics'] }: { on?: readonly FeatureSwitch[] } = {}) {
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
    analytics: fake.port,
  });
  const settings = createSettings({
    userState,
    defaults: edition.userSettingDefaults,
    analytics: createAnalytics({ edition, userState, port: fake.port }),
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
