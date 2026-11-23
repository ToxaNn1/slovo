import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import { openComposition, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import type { VerticalPagerHandle } from '@slovo/ui';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Activity, type ReactNode } from 'react';

import { useFeed } from './feed';
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

/** Opens another tab, and comes back to the Feed's. */
async function switchTabAndBack() {
  for (const to of [
    { focused: false, hidden: false },
    { focused: false, hidden: true },
    { focused: true, hidden: false },
  ]) {
    mockTab = to;
    await act(() => {
      for (const listener of mockTabListeners) listener();
    });
  }
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
  const clock = { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };
  mockComposition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      correctionCategories: [
        { id: 'everyday', displayName: 'Щоденне', description: 'Щоденне.', tone: 'loud' },
      ],
      words: Array.from({ length: 10 }, (_, i) => word(i)),
      corrections: [correction],
    }),
    edition: loadEdition(config),
    userState: await seedUserState({ onboardingFinished: '2026-10-01T09:00:00Z' }),
    clock,
    random: { next: () => 0 },
  });
  const pager = fakePager();
  const ref = { current: pager };
  const landing = createWordOfTheDayLanding();
  const feed = await renderHook(
    ({ voice }: { voice: string }) => useFeed(ref, { clock, landing, voice }),
    { initialProps: { voice: 'oksana' }, wrapper: TabScreen },
  );
  await waitFor(() => {
    expect(feed.result.current.cards.length).toBeGreaterThan(1);
  });
  return { feed, pager };
}

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
});
