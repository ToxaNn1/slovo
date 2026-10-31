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
    track: (event, properties) => void events.push([event, properties]),
    stop: () => void (stops += 1),
  };
  return { port, events, stops: () => stops };
}

/** One app run with the Analytics port, its settings over the same user state. */
async function run({ on = ['knowledge', 'analytics'] }: { on?: readonly FeatureSwitch[] } = {}) {
  const fake = fakePort();
  const edition = testEdition({ isFeatureEnabled: (feature) => on.includes(feature) });
  const userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: fakeClock('2026-10-31T09:00:00.000Z').clock,
    random: { next: () => 0.25 },
    analytics: fake.port,
  });
  const settings = createSettings({
    userState,
    defaults: edition.userSettingDefaults,
    analytics: createAnalytics({ edition, userState, port: fake.port }),
  });
  return { app, settings, ...fake };
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

  it('sends a screen viewed and a setting changed', async () => {
    const { app, settings, events } = await run();

    await app.analytics.screenViewed('settings');
    await settings.update({ theme: 'dark' });

    expect(events).toEqual([
      ['screenViewed', { screen: 'settings' }],
      ['settingChanged', { setting: 'theme', value: 'dark' }],
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
