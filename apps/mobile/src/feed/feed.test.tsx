import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import { openComposition, type Composition, type FeedCard } from '@slovo/core';
import {
  createMemoryContentPort,
  seedUserState,
  loadEdition,
  SEEN_DWELL_MS,
} from '@slovo/core/testing';
import type { VerticalPagerHandle } from '@slovo/ui';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Activity, type ReactNode } from 'react';

import { useFeed } from './feed';
import { createReaderPlace } from './reader-place';
import { createWordOfTheDayLanding } from './word-of-the-day-landing';
import { activeEditionFiles } from '../edition/edition';

const { config } = activeEditionFiles;

/** The composition the Feed reads, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({ useComposition: () => mockComposition }));
/**
 * The Feed's tab as a test moves it: focused, or out of focus and then
 * hidden in an Activity a frame later, as the tabs' screen layout does.
 */
let mockTab = { focused: true, hidden: false };
const mockTabListeners = new Set<() => void>();
function mockUseTab() {
  return jest.requireActual<typeof import('react')>('react').useSyncExternalStore(
    (listener: () => void) => {
      mockTabListeners.add(listener);
      return () => {
        mockTabListeners.delete(listener);
      };
    },
    () => mockTab,
  );
}
// The app is in the foreground.
jest.mock('expo-router', () => ({ useIsFocused: () => mockUseTab().focused }));

/** The Feed's tab as the tabs' screen layout keeps it: out of focus, it waits in a hidden Activity. */
function TabScreen({ children }: { children: ReactNode }) {
  return <Activity mode={mockUseTab().hidden ? 'hidden' : 'visible'}>{children}</Activity>;
}

/** Moves the Feed's tab as the tabs' screen layout does. */
async function switchTab(to: typeof mockTab) {
  mockTab = to;
  await act(() => {
    for (const listener of mockTabListeners) listener();
  });
}

/** Opens another tab, and comes back to the Feed's. */
async function switchTabAndBack() {
  await switchTab({ focused: false, hidden: false });
  await switchTab({ focused: false, hidden: true });
  await switchTab({ focused: true, hidden: false });
}
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));
/** The media prefetch the Feed asks for, by the Words it names. */
const mockPrefetchAhead = jest.fn((_shell: unknown, _wordIds: readonly string[], _voice: string) =>
  Promise.resolve(),
);
jest.mock('../shell-value', () => ({ useShell: () => ({}) }));
jest.mock('../media/shell-media', () => ({
  prefetchAhead: (shell: unknown, wordIds: readonly string[], voice: string) =>
    mockPrefetchAhead(shell, wordIds, voice),
}));

/** A Word «слово{n}» that links the Correction `c_one`. */
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
  correctionIds: ['c_one'],
  retired: false,
});

const correction: Correction = {
  kind: 'correction',
  id: 'c_one',
  nonStandardForm: 'bad one',
  correctionType: 'calque',
  standardEquivalents: ['good one'],
  explanation: 'Why one reads better.',
  examplePair: { nonStandard: 'They said bad one.', standard: 'They said good one.' },
  categoryId: 'everyday',
  sources: [{ title: 'Test source' }],
  literaryUses: [],
  retired: false,
};

/** The pager the Feed turns, which keeps the page it shows and how it got there. */
function fakePager() {
  const pager: VerticalPagerHandle & { page?: number; turned: number[] } = {
    turned: [],
    turnTo(index) {
      pager.page = index;
      pager.turned.push(index);
    },
    showPage(index) {
      pager.page = index;
    },
  };
  return pager;
}

/** Opens the app's Feed over 10 Words and a Correction they link, past the onboarding. */
async function openFeed() {
  let now = new Date('2026-10-26T09:00:00Z').getTime();
  const clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  const userState = await seedUserState({ onboardingFinished: '2026-10-01T09:00:00Z' });
  const content = createMemoryContentPort({
    categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
    correctionCategories: [
      { id: 'everyday', displayName: 'Щоденне', description: 'Щоденне.', tone: 'loud' },
    ],
    words: Array.from({ length: 10 }, (_, i) => word(i)),
    corrections: [correction],
  });
  // A reopen, as after a sync or a Patch, opens a new composition over the same user state.
  const open = () =>
    openComposition({
      content,
      edition: loadEdition(config),
      userState,
      clock,
      random: { next: () => 0 },
    });
  mockComposition = await open();
  const pager = fakePager();
  const ref = { current: pager };
  const landing = createWordOfTheDayLanding();
  const place = createReaderPlace();
  const feed = await renderHook(
    ({ voice }: { voice: string }) => useFeed(ref, { clock, landing, place, voice }),
    { initialProps: { voice: 'oksana' }, wrapper: TabScreen },
  );
  await waitFor(() => {
    expect(feed.result.current.cards.length).toBeGreaterThan(1);
  });
  return {
    feed,
    pager,
    landing,
    place,
    /** Lets the card on screen stay long enough to be Seen. */
    dwell: () => {
      now += SEEN_DWELL_MS;
    },
    reopen: async () => {
      await mockComposition.close();
      mockComposition = await open();
      await feed.rerender({ voice: 'oksana' });
    },
  };
}

/** Whether `card` is the Feed's goal-reached card, «Ціль дня виконано!». */
const isGoalCard = (card: FeedCard | undefined) =>
  card?.kind === 'notice' && card.notice === 'goalReached';

beforeEach(() => {
  mockTab = { focused: true, hidden: false };
});

describe('the Feed on its pager', () => {
  it('turns the pager to a linked Correction it opens, right after the Word', async () => {
    const { feed, pager } = await openFeed();
    const position = feed.result.current.cards.findIndex(
      (card) => card.kind === 'word' && card.model.linkedCorrections.length > 0,
    );
    expect(position).not.toBe(-1);

    await act(() => {
      feed.result.current.openCorrection(position, 'c_one');
    });

    await waitFor(() => {
      expect(pager.turned).toEqual([position + 1]);
    });
    expect(feed.result.current.cards[position + 1]?.entryId).toBe('c_one');
  });

  it('keeps the reader on the card they read on to after a Correction when they switch tabs and come back', async () => {
    const { feed, pager } = await openFeed();
    const position = feed.result.current.cards.findIndex(
      (card) => card.kind === 'word' && card.model.linkedCorrections.length > 0,
    );
    await act(() => {
      feed.result.current.openCorrection(position, 'c_one');
    });
    await waitFor(() => {
      expect(pager.turned).toEqual([position + 1]);
    });
    await act(() => {
      feed.result.current.onCardChange(position + 2);
    });
    pager.page = position + 2;

    await switchTabAndBack();

    expect(pager.turned).toEqual([position + 1]);
    expect(pager.page).toBe(position + 2);
  });

  it('keeps the pager on the reader’s card when a hide drops a card before it', async () => {
    const { feed, pager } = await openFeed();
    await act(() => {
      feed.result.current.onCardChange(1);
    });
    pager.page = 1;
    await waitFor(() => {
      expect(feed.result.current.cards.length).toBeGreaterThan(2);
    });
    const [hidden, reader] = feed.result.current.cards.map((card) => card.entryId);

    await act(() => mockComposition.hiddenEntries.hide(hidden ?? ''));

    expect(feed.result.current.cards[0]?.entryId).toBe(reader);
    expect(pager.page).toBe(0);
    expect(mockComposition.feed.position).toBe(0);
  });

  it('downloads the media of the Words after the card the reader turned to', async () => {
    const { feed } = await openFeed();

    await act(() => {
      feed.result.current.onCardChange(1);
    });

    const ahead = feed.result.current.cards
      .slice(2)
      .flatMap((card) => (card.kind === 'word' ? [card.model.wordId] : []));
    expect(ahead.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(mockPrefetchAhead.mock.lastCall?.[1]).toEqual(ahead);
    });
  });

  it('downloads the media ahead again in the voice the reader chose', async () => {
    const { feed } = await openFeed();
    await act(() => {
      feed.result.current.onCardChange(1);
    });
    await waitFor(() => {
      expect(mockPrefetchAhead.mock.lastCall?.[2]).toBe('oksana');
    });

    await feed.rerender({ voice: 'taras' });

    await waitFor(() => {
      expect(mockPrefetchAhead.mock.lastCall?.[2]).toBe('taras');
    });
  });

  it('keeps a page turned out of sight for the Feed’s return, but not for a reopened Feed', async () => {
    const { feed, place, reopen } = await openFeed();
    await switchTab({ focused: false, hidden: false });
    await act(() => {
      feed.result.current.onCardChange(2);
    });
    await switchTab({ focused: true, hidden: false });
    await waitFor(() => {
      expect(mockComposition.feed.position).toBe(2);
    });
    expect(place.cardInFront()).toBe(feed.result.current.cards[2]);

    await switchTab({ focused: false, hidden: false });
    await act(() => {
      feed.result.current.onCardChange(0);
    });
    await reopen();
    expect(mockComposition.feed.startPosition).not.toBe(0);
    await switchTab({ focused: true, hidden: false });

    // The new Feed opens on the reader's card, not on the page turned in the Feed before it.
    expect(mockComposition.feed.position).toBe(mockComposition.feed.startPosition);
    expect(place.cardInFront()).toBe(feed.result.current.cards[mockComposition.feed.startPosition]);
  });
});

// Ticket #2106: the goal-reached card holds its own Mascot, which learns of it from the reader's place.
describe('the card in front of the reader', () => {
  it('is the card the Feed opens on, with no swipe, and none while the Feed is out of sight', async () => {
    const { feed, place } = await openFeed();
    const { startPosition } = feed.result.current;

    expect(place.cardInFront()).toBe(feed.result.current.cards[startPosition]);

    await switchTab({ focused: false, hidden: false });
    expect(place.cardInFront()).toBeUndefined();
    await switchTab({ focused: false, hidden: true });
    await switchTab({ focused: true, hidden: false });
    expect(place.cardInFront()).toBe(feed.result.current.cards[startPosition]);
  });

  it('is the goal-reached card a hide puts in front of the reader, and again once back from another tab', async () => {
    const { feed, place, dwell } = await openFeed();
    await act(() => mockComposition.xpLog.setDailyGoal(3));
    // The reader reads on until the Word that meets the goal is on screen, with the card after it.
    let goal = -1;
    for (let position = 0; goal === -1 && position < 8; position += 1) {
      await act(() => {
        feed.result.current.onCardChange(position);
      });
      dwell();
      goal = feed.result.current.cards.findIndex(isGoalCard);
    }
    expect(goal).toBeGreaterThan(0);
    expect(mockComposition.feed.position).toBe(goal - 1);
    expect(isGoalCard(place.cardInFront())).toBe(false);
    const told: boolean[] = [];
    place.subscribe(() => told.push(isGoalCard(place.cardInFront())));

    await act(() =>
      mockComposition.hiddenEntries.hide(feed.result.current.cards[goal - 1]?.entryId ?? ''),
    );

    expect(isGoalCard(place.cardInFront())).toBe(true);
    expect(told.at(-1)).toBe(true);
    await switchTabAndBack();
    expect(told).toContain(false);
    expect(isGoalCard(place.cardInFront())).toBe(true);
  });

  it('is today’s Word of the Day card the landing turns the pager to', async () => {
    const { feed, place, pager, landing } = await openFeed();
    await act(() => {
      feed.result.current.onCardChange(2);
    });

    await act(() => {
      landing.ask();
    });

    const card = place.cardInFront();
    expect(card?.kind === 'word' && card.wordOfTheDay !== undefined).toBe(true);
    expect(feed.result.current.cards[pager.page ?? -1]).toBe(card);
    expect(landing.asked()).toBeUndefined();
  });
});
