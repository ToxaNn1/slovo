import { describe, expect, it, jest } from '@jest/globals';
import type { Correction, Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import type { VerticalPagerHandle } from '@slovo/ui';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useFeed } from './feed';
import { createWordOfTheDayLanding } from './word-of-the-day-landing';
import { activeEditionFiles } from '../edition/edition';

const { config } = activeEditionFiles;

/** The composition the Feed reads, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({ useComposition: () => mockComposition }));
// The Feed is in sight: its tab is focused and the app in the foreground.
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

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
      categories: [{ id: 'nature', displayName: 'Природа' }],
      correctionCategories: [{ id: 'everyday', displayName: 'Щоденне' }],
      words: Array.from({ length: 10 }, (_, i) => word(i)),
      corrections: [correction],
    }),
    edition: loadEdition(config),
    userState: await openUserState({
      port: createMemoryUserStatePort(
        new Map([['onboarding.finished', JSON.stringify('2026-10-01T09:00:00Z')]]),
      ),
    }),
    clock,
    random: { next: () => 0 },
  });
  const pager = fakePager();
  const ref = { current: pager };
  const landing = createWordOfTheDayLanding();
  const feed = await renderHook(() => useFeed(ref, { clock, landing }));
  await waitFor(() => {
    expect(feed.result.current.cards.length).toBeGreaterThan(1);
  });
  return { feed, pager };
}

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
});
