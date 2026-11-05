import type { CorrectionType } from '@slovo/contracts';
import type { DashboardBlock } from '@slovo/core';
import { useIsFocused } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { wordOfTheDayLanding } from '../feed/word-of-the-day-landing';
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
  /** A Mood chip: chooses today's Mood, or changes it. */
  readonly chooseMood: (moodId: string) => void;
  /** «Не сьогодні»: skips the Mood check-in till tomorrow. */
  readonly skipMood: () => void;
  /** A row of «Попередні слова»: opens its Entry card as Search does, making nothing Seen. */
  readonly openPreviousWord: (entryId: string) => void;
  /** A tile of the Correction Types rail: opens its type's screen. */
  readonly openCorrectionType: (type: CorrectionType) => void;
  /** A card of the Curated Collections rail: marks the collection opened, so «Нова» goes. */
  readonly openCuratedCollection: (collectionId: string) => void;
}

const previousWordsTitle = editionStrings.dashboard.previousWords.title;

/**
 * The Dashboard's blocks and actions. A landing on the Word of the Day card,
 * asked by «До картки →» or by the «Слово дня» App Intent, opens the Feed
 * over the Dashboard, where the Feed lands it (ADR 0076).
 */
export function useDashboardScreen(): DashboardScreen {
  const { dashboard, mood, curatedCollections } = useComposition();
  const blocks = useSubscribed(dashboard, (source) => source.blocks);
  const openScreen = useOpenScreen();
  const focused = useIsFocused();
  const asked = useSyncExternalStore(wordOfTheDayLanding.subscribe, wordOfTheDayLanding.asked);
  useEffect(() => {
    if (focused && asked !== undefined) openScreen('/feed');
  }, [focused, asked, openScreen]);
  return {
    blocks,
    reveal: () => {
      void dashboard.reveal();
    },
    toCard: wordOfTheDayLanding.ask,
    chooseMood: (moodId) => {
      void mood.choose(moodId);
    },
    skipMood: () => {
      void mood.skip();
    },
    openPreviousWord: (entryId) => {
      openScreen(`/search/${entryId}?back=${encodeURIComponent(previousWordsTitle)}`);
    },
    openCorrectionType: (type) => {
      openScreen(`/correction-type/${type}`);
    },
    openCuratedCollection: (collectionId) => {
      void curatedCollections.open(collectionId);
      openScreen(`/curated-collection/${collectionId}`);
    },
  };
}
