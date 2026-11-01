import { openComposition, SEEN_DWELL_MS, type Edition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import type { AppStateStatus } from 'react-native';
import { describe, expect, it } from 'vitest';

import { reportForeground } from '../foreground/foreground-reports';
import { openOnce, type Opening } from '../opening';
import { fakeClock, strings, ukrainian } from '../test-support';
import { handOverSpotlight } from './spotlight-hand-over';
import { createSpotlightIndex, type SpotlightItem } from './spotlight-index';

const nature = { id: 'nature-weather', displayName: 'Природа і погода' };

const content = createMemoryContentPort({
  categories: [nature],
  words: ['w_one', 'w_two', 'w_three'].map((id) => ({
    kind: 'word' as const,
    id,
    lemma: id.slice(2),
    stress: [],
    partOfSpeech: 'adverb' as const,
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: nature.id,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
  })),
});

/** The device's app state, moved by the test. */
function fakeAppState() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const source = {
    currentState: 'active' as AppStateStatus,
    addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
        },
      };
    },
  };
  return {
    source,
    change(state: AppStateStatus) {
      source.currentState = state;
      for (const listener of Array.from(listeners)) listener(state);
    },
  };
}

/** Lets every hand-over in flight land. */
async function settled() {
  for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** What an opening holds once it is open. */
function held<T>(opening: Opening<T>): T {
  const { state } = opening;
  if (state.status !== 'ready') throw new Error('The opening is not ready.');
  return state.value;
}

/**
 * The app as the lifecycle runs it: the composition over one user state,
 * reopened over the Edition in effect, the foreground reports, and the hand-over
 * to an index over a native module that keeps each list of items it was given.
 */
async function app() {
  const time = fakeClock('2026-10-28T09:00:00Z');
  const userState = await seedUserState();
  let edition: Edition = ukrainian;
  const composition = openOnce(
    () =>
      openComposition({
        content,
        edition,
        userState,
        clock: time.clock,
        random: { next: () => 0.25 },
      }),
    { onError: () => undefined },
  );
  const appState = fakeAppState();
  const reports = reportForeground({ clock: time.clock, appState: appState.source });
  const writes: SpotlightItem[][] = [];
  const index = createSpotlightIndex(
    {
      replaceIndex(items) {
        writes.push(items);
        return Promise.resolve();
      },
    },
    'uk',
  );
  const stop = handOverSpotlight({ reports, composition, index, strings });
  await composition.opened();
  await settled();
  return {
    time,
    composition,
    writes,
    /** The routes of the last items handed over, each in the UA Edition, without the Edition's mark. */
    lastRoutes: () =>
      writes.at(-1)?.map(({ route }) => {
        expect(route).toMatch(/[?&]edition=uk$/);
        return route.replace(/[?&]edition=uk$/, '');
      }),
    background: async () => {
      appState.change('background');
      await settled();
    },
    comeBack: async () => {
      appState.change('active');
      await settled();
    },
    /** Reopens the composition, as a sync or a changed Feature Switch does. */
    reopen: async (over: Edition = edition) => {
      edition = over;
      await composition.reopen();
      await settled();
    },
    stop: () => {
      stop();
      reports.stop();
    },
  };
}

describe('the Spotlight hand-over', () => {
  it('hands over a snapshot when the composition opens and a fresh one each time the app goes to the background', async () => {
    const { writes, background, comeBack } = await app();
    expect(writes).toEqual([[]]);

    await background();
    await comeBack();
    await background();

    expect(writes).toEqual([[], [], []]);
  });

  it('hands over a fresh snapshot after each change of Favorites, the Collections and the archive', async () => {
    const { time, composition, writes, lastRoutes } = await app();
    const open = held(composition);

    await open.favorites.add('w_one');
    await settled();
    expect(lastRoutes()).toEqual(['entry/w_one']);

    const created = await open.collections.create('Осінь');
    if (!created.ok) throw new Error('The Collection was not created');
    const { id } = created.collection;
    await settled();
    expect(lastRoutes()).toEqual(['entry/w_one', `saved/collections/${id}`]);

    await open.collections.add(id, 'w_two');
    await settled();
    expect(lastRoutes()).toEqual(['entry/w_one', 'entry/w_two', `saved/collections/${id}`]);

    const today = open.feed.cards[0]?.entryId;
    if (today === undefined) throw new Error('The Feed has no first card');
    const before = writes.length;
    await open.feed.show(0);
    time.advance(SEEN_DWELL_MS);
    await open.feed.show(undefined);
    await settled();
    expect(writes.length).toBe(before + 1);
    expect(lastRoutes()).toContain(`entry/${today}`);
  });

  it('follows the composition a reopen opens, and hands over an empty snapshot once the switch is off', async () => {
    const { composition, writes, lastRoutes, reopen } = await app();
    const old = held(composition);
    await old.favorites.add('w_one');
    await settled();

    await reopen();
    expect(lastRoutes()).toEqual(['entry/w_one']);

    await reopen({
      ...ukrainian,
      isFeatureEnabled: (feature) => feature !== 'spotlight' && ukrainian.isFeatureEnabled(feature),
    });
    expect(writes.at(-1)).toEqual([]);

    const before = writes.length;
    await held(composition).favorites.add('w_two');
    await settled();
    expect(writes.length).toBe(before + 1);
    expect(writes.at(-1)).toEqual([]);
  });

  it('hands over nothing once stopped', async () => {
    const { composition, writes, background, stop } = await app();
    stop();

    await held(composition).favorites.add('w_one');
    await background();

    expect(writes).toEqual([[]]);
  });
});
