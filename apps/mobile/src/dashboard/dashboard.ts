import type { CorrectionType } from '@slovo/contracts';
import type { DashboardBlock, LocalDate } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { wordOfTheDayLanding, type LandingAsked } from '../feed/word-of-the-day-landing';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { useOpenScreen } from '../use-open-screen';

/** What the Dashboard screen draws and does. */
export interface DashboardScreen {
  /** The blocks of the local day, in display order. */
  readonly blocks: readonly DashboardBlock[];
  /** «Розкрити»: reveals the hero in place and makes the Word of the Day Seen. */
  readonly reveal: () => void;
  /** «До картки →»: opens the Feed on the Word of the Day card. */
  readonly toCard: () => void;
  /** Today, the Feed's local day, which turns at midnight with the app open. */
  readonly today: LocalDate;
  /** A Mood tile: chooses today's Mood, or changes it. */
  readonly chooseMood: (moodId: string) => void;
  /** A row of «Попередні слова»: opens its Entry card as Search does, making nothing Seen. */
  readonly openPreviousWord: (entryId: string) => void;
  /** A tile of the Correction Types rail: opens its type's screen. */
  readonly openCorrectionType: (type: CorrectionType) => void;
  /** A card of the Curated Collections rail: marks the collection opened, so «Нова» goes. */
  readonly openCuratedCollection: (collectionId: string) => void;
  /** The Categories rail's header: opens the grid of them all, k1. */
  readonly openCategories: () => void;
  /** A tile of the Categories rail or of k1: opens its Category's screen. */
  readonly openCategory: (categoryId: string) => void;
  /** The Correction Types rail's header: opens the grid of the Categories of Corrections, k2. */
  readonly openCorrectionCategories: () => void;
}

const previousWordsTitle = editionStrings.dashboard.previousWords.title;

/** The last ask that opened the Feed, kept across Dashboard mounts so each ask opens it once. */
let feedOpenedFor: LandingAsked | undefined;

/**
 * The Dashboard's blocks and actions. A landing on the Word of the Day card,
 * asked by «До картки →» or by the «Слово дня» App Intent, opens the Feed
 * over the Dashboard, where the Feed lands it (ADR 0076). Each ask opens the
 * Feed once: it keeps waiting there for the card, such as on a cold start, so
 * a return to the Dashboard while the Feed lacks the card stays on it.
 */
export function useDashboardScreen(): DashboardScreen {
  const { dashboard, feed, mood, curatedCollections } = useComposition();
  const blocks = useSubscribed(dashboard, (source) => source.blocks);
  const today = useSubscribed(feed, (source) => source.today);
  const openScreen = useOpenScreen();
  const focused = useIsFocused();
  const asked = useSyncExternalStore(wordOfTheDayLanding.subscribe, wordOfTheDayLanding.asked);
  useEffect(() => {
    if (!focused || asked === undefined || asked === feedOpenedFor) return;
    feedOpenedFor = asked;
    openScreen('/feed');
  }, [focused, asked, openScreen]);
  return {
    blocks,
    today,
    reveal: () => {
      void keep('the reveal of the Word of the Day', dashboard.reveal());
    },
    toCard: wordOfTheDayLanding.ask,
    chooseMood: (moodId) => {
      void keep("today's Mood", mood.choose(moodId));
    },
    openPreviousWord: (entryId) => {
      openScreen(`/search/${entryId}?back=${encodeURIComponent(previousWordsTitle)}`);
    },
    openCorrectionType: (type) => {
      openScreen(`/correction-type/${type}`);
    },
    openCuratedCollection: (collectionId) => {
      void keep('the opened Curated Collections', curatedCollections.open(collectionId));
      openScreen(`/curated-collection/${collectionId}`);
    },
    openCategories: () => {
      openScreen('/categories');
    },
    openCategory: (categoryId) => {
      openScreen(`/category/${categoryId}`);
    },
    openCorrectionCategories: () => {
      openScreen('/correction-categories');
    },
  };
}
