import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  loadEdition,
  openComposition,
  systemRandom,
  type Clock,
  type Composition,
  type FeedCard,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState, type UserStateFacts } from '@slovo/core/testing';
import type { VerticalPagerHandle } from '@slovo/ui';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { useFeed } from './feed';
import { createWordOfTheDayLanding, type WordOfTheDayLanding } from './word-of-the-day-landing';
import { activeEditionFiles } from '../edition/edition';

const { config } = activeEditionFiles;

/** The composition the Feed reads, opened afresh for each test. */
let composition: Composition;

// The Feed is in sight: its tab is focused.
jest.mock('expo-router', () => ({ useIsFocused: () => true }));

/** Whether the app is in the foreground, as a test moves it, and who listens to it. */
let mockInForeground = true;
const mockForegroundListeners = new Set<() => void>();

jest.mock('../foreground/in-foreground', () => ({
  useInForeground: () =>
    jest.requireActual<typeof import('react')>('react').useSyncExternalStore(
      (listener: () => void) => {
        mockForegroundListeners.add(listener);
        return () => {
          mockForegroundListeners.delete(listener);
        };
      },
      () => mockInForeground,
    ),
}));

/** Sends the app to the background, or brings it back to the foreground. */
async function moveApp(to: 'background' | 'foreground') {
  mockInForeground = to === 'foreground';
  await act(() => {
    for (const listener of mockForegroundListeners) listener();
  });
}

/** A Word «слово{n}» with nothing but what its card reads. */
const word = (index: number): Word => ({
  kind: 'word',
  id: `w_test${String(index)}`,
  lemma: `слово${String(index)}`,
  stress: [2],
  partOfSpeech: 'noun',
  primaryDefinition: `The meaning of test${String(index)}.`,
  extraDefinitions: [],
  examples: [{ text: `Речення: слово${String(index)}.` }],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
});

/** A clock stopped at `at` in Kyiv, which a test moves on. */
function clockAt(at: string): Clock & { set(to: string): void } {
  let now = new Date(at);
  return {
    now: () => now,
    timeZone: () => 'Europe/Kyiv',
    set(to) {
      now = new Date(to);
    },
  };
}

/** The pager the Feed turns, which keeps the page it shows. */
function fakePager() {
  const pager: VerticalPagerHandle & { page?: number } = {
    turnTo(index) {
      pager.page = index;
    },
    showPage(index) {
      pager.page = index;
    },
  };
  return pager;
}

/**
 * Opens the app's Feed over 10 Words and the user state kept from before,
 * on the given clock, with a landing of its own.
 */
async function openFeed(clock: Clock, kept: UserStateFacts = {}) {
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа' }],
      words: Array.from({ length: 10 }, (_, i) => word(i)),
    }),
    edition: loadEdition(config),
    // The reader is past the onboarding, which would cover the Feed.
    userState: await seedUserState({ onboardingFinished: '2026-10-01T09:00:00Z', ...kept }),
    clock,
    random: systemRandom,
  });
  const pager = fakePager();
  const ref = { current: pager };
  const landing = createWordOfTheDayLanding();
  const shell = testShell({ composition: opened(composition) });
  const feed = await renderHook(() => useFeed(ref, { clock, landing }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ShellProvider shell={shell}>{children}</ShellProvider>
    ),
  });
  await waitFor(() => {
    expect(feed.result.current.cards.length).toBeGreaterThan(1);
  });
  return { feed, pager, landing };
}

/** The local date `YYYY-MM-DD` whose Word of the Day `card` is, if it is one. */
function wordOfTheDayOn(card: FeedCard | undefined): string | undefined {
  if (card?.kind !== 'word' || card.wordOfTheDay === undefined) return undefined;
  const { year, month, day } = card.wordOfTheDay;
  return [year, month, day].map((part) => String(part).padStart(2, '0')).join('-');
}

/** Asks for the landing, as the «Слово дня» intent does, and lets the Feed land it. */
async function ask(landing: WordOfTheDayLanding) {
  await act(() => {
    landing.ask();
  });
}

beforeEach(() => {
  mockInForeground = true;
});

describe('the «Слово дня» intent', () => {
  it('lands on the Word of the Day card when the reader is on another card of the day', async () => {
    const clock = clockAt('2026-10-26T09:00:00Z');
    // The reader was on слово5 today, after today's Word of the Day, слово3.
    const { feed, pager, landing } = await openFeed(clock, {
      wordOfTheDay: { entryId: 'w_test3', date: '2026-10-26' },
      feedPosition: { entryId: 'w_test5', date: '2026-10-26' },
    });
    expect(feed.result.current.startPosition).toBe(1);

    await ask(landing);

    expect(pager.page).toBe(0);
    expect(feed.result.current.cards[0]?.entryId).toBe('w_test3');
    expect(wordOfTheDayOn(feed.result.current.cards[0])).toBe('2026-10-26');
    // The Feed is told the reader is on it, so it is Seen like any card on screen.
    await waitFor(() => {
      expect(composition.feed.position).toBe(0);
    });
    expect(landing.asked()).toBeUndefined();
  });

  it("on a cold start on a new day lands on today's Word of the Day, not yesterday's", async () => {
    const clock = clockAt('2026-10-26T09:00:00Z');
    const { feed, pager, landing } = await openFeed(clock, {
      wordOfTheDay: { entryId: 'w_test3', date: '2026-10-25' },
      feedPosition: { entryId: 'w_test5', date: '2026-10-25' },
    });

    await ask(landing);

    expect(pager.page).toBe(0);
    expect(wordOfTheDayOn(feed.result.current.cards[0])).toBe('2026-10-26');
    expect(landing.asked()).toBeUndefined();
  });

  it('back from the background on a new day waits for the day’s Word of the Day and lands on it', async () => {
    const clock = clockAt('2026-10-25T20:00:00Z');
    const { feed, pager, landing } = await openFeed(clock);
    await act(() => {
      feed.result.current.onCardChange(1);
    });

    await moveApp('background');
    clock.set('2026-10-26T06:00:00Z');
    await ask(landing);
    // The Feed still holds yesterday's Word of the Day: the ask waits.
    expect(landing.asked()).toBeDefined();
    await act(() => composition.resume());
    await moveApp('foreground');

    await waitFor(() => {
      expect(wordOfTheDayOn(feed.result.current.cards[pager.page ?? -1])).toBe('2026-10-26');
    });
    expect(landing.asked()).toBeUndefined();
  });

  it('lands each time it is asked', async () => {
    const clock = clockAt('2026-10-26T09:00:00Z');
    const { feed, pager, landing } = await openFeed(clock);
    await ask(landing);
    expect(pager.page).toBe(0);

    await act(() => {
      feed.result.current.onCardChange(1);
    });
    pager.page = 1;
    await ask(landing);

    expect(pager.page).toBe(0);
  });
});
