import type { LocalDate, WordCardModel } from '@slovo/core';
import type { ReactNode } from 'react';

import type { TextSize } from '../providers/FontSizeProvider';
import { useCardFeatures } from './card-features';
import { CardKicker } from './EntryKicker';
import { KickerRow } from './KickerRow';
import { WordHeadline } from './WordCard';
import { WordOfTheDayKicker } from './WordOfTheDayBadge';
import { WordTabs } from './WordTabs';

/**
 * The Word card's blocks inside the Entry card's frame: the Lemma with Stress,
 * part of speech, register chips and the Category chip, and the Word's tabs
 * under them (ADR 0091). It draws only the sections the Core put in the card,
 * at the user's font size. Under Self-check it keeps the Lemma,
 * part of speech and Category; the Entry card draws the button that reveals
 * the rest under them. While the card's sources tab is on, the sources leave
 * the other tabs for «Джерело» (ADR 0116). Where the Stress falls, the Lemma's Stress mark falls
 * onto its vowel each time the card comes on screen, unless the reader turned
 * on Reduce Motion (ADR 0055).
 */
export function WordCardBody({
  card,
  wordOfTheDay,
  lemmaSize,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
  concealed,
  corner,
  kicker,
}: {
  card: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of, in its kicker. */
  wordOfTheDay: LocalDate | undefined;
  /** The Lemma's size at the user's font size, smaller in the compact layout. */
  lemmaSize: TextSize;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  /** Called once the Word History is drawn, as the Entry screen tells Analytics (ADR 0068). */
  onHistoryShown: (() => void) | undefined;
  /** Self-check: only the Lemma, part of speech and Category. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The card's kicker beside its corner, such as its place in a Category's Feed (ADR 0110). */
  kicker?: string | undefined;
}) {
  const { sourceTab } = useCardFeatures();
  return (
    <>
      <KickerRow testID="word-kicker-row" corner={corner}>
        {wordOfTheDay === undefined ? (
          kicker === undefined ? null : (
            <CardKicker testID="word-card-kicker" text={kicker} />
          )
        ) : (
          <WordOfTheDayKicker day={wordOfTheDay} />
        )}
      </KickerRow>
      <WordHeadline
        card={card}
        lemmaSize={lemmaSize}
        concealed={concealed}
        wordOfTheDay={wordOfTheDay !== undefined}
        tabbed
      />
      <WordTabs
        card={card}
        onOpenCorrection={onOpenCorrection}
        onOpenSynonymRow={onOpenSynonymRow}
        onHistoryShown={onHistoryShown}
        sources={sourceTab ? card.sourceNames : undefined}
        disabled={concealed}
      />
    </>
  );
}
