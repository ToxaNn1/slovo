import type { LocalDate, WordCardModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { TextSize } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { typeStyle } from '../tokens';
import { CategoryChip } from './CategoryChip';
import { KickerRow } from './KickerRow';
import { WordHeadline, WordSections } from './WordCard';
import { WordOfTheDayBadge, WordOfTheDayKicker } from './WordOfTheDayBadge';
import { WordTabs } from './WordTabs';

/**
 * The Word card's blocks inside the Entry card's frame: the Lemma with Stress,
 * part of speech and register chips, the dialectal one with the region, the primary Definition, the first
 * Example, the Illustration above the Definition, the Word History under its heading, Synonyms and antonyms, the Category chip, the details behind
 * "more", the Synonym Row the Word is a member of and the linked Corrections. It draws only the sections the Core put
 * in the card, at the user's font size. Under Self-check it keeps the Lemma,
 * part of speech and Category; the Entry card draws the button that reveals
 * the rest under them. Where the Stress falls, the Lemma's Stress mark falls
 * onto its vowel each time the card comes on screen, unless the reader turned
 * on Reduce Motion (ADR 0055).
 */
export function WordCardBody({
  card,
  wordOfTheDay,
  compact,
  lemmaSize,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
  concealed,
  stressFalls,
  wordOfTheDayFont,
  corner,
  tabs,
  kicker,
}: {
  card: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of, its kicker with tabs and its badge without. */
  wordOfTheDay: LocalDate | undefined;
  /** The design's compact iPhone SE layout. */
  compact: boolean;
  /** The Lemma's size at the user's font size, smaller in the compact layout. */
  lemmaSize: TextSize;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  /** Called once the Word History is drawn, as the Entry screen tells Analytics (ADR 0068). */
  onHistoryShown: (() => void) | undefined;
  /** Self-check: only the Lemma, part of speech and Category. */
  concealed: boolean;
  /** The falling Stress: on a Word card in the Feed and on the Entry screen, while its Feature Switch is on. */
  stressFalls: boolean;
  /** The calligraphic font family the Lemma is set in on the card of the Word of the Day. */
  wordOfTheDayFont: string | undefined;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The tabs under the Lemma in place of the one column, while `wordTabs` is on (ADR 0091). */
  tabs: boolean;
  /** The card's kicker beside its corner, such as its place in a Category's Feed (ADR 0110). */
  kicker?: string | undefined;
}) {
  return (
    <>
      <KickerRow testID="word-kicker-row" corner={corner}>
        {wordOfTheDay === undefined ? (
          kicker === undefined ? null : (
            <CardKicker text={kicker} />
          )
        ) : tabs ? (
          <WordOfTheDayKicker day={wordOfTheDay} />
        ) : (
          <WordOfTheDayBadge day={wordOfTheDay} />
        )}
      </KickerRow>
      <WordHeadline
        card={card}
        lemmaSize={lemmaSize}
        concealed={concealed}
        stressFalls={stressFalls}
        lemmaFont={wordOfTheDay === undefined ? undefined : wordOfTheDayFont}
        tabbed={tabs}
      />
      {!tabs && concealed && card.categoryName !== undefined && (
        <CategoryChip testID="word-category" name={card.categoryName} />
      )}
      {tabs ? (
        <WordTabs
          card={card}
          onOpenCorrection={onOpenCorrection}
          onOpenSynonymRow={onOpenSynonymRow}
          onHistoryShown={onHistoryShown}
          disabled={concealed}
        />
      ) : concealed ? null : (
        <WordSections
          card={card}
          compact={compact}
          onOpenCorrection={onOpenCorrection}
          onOpenSynonymRow={onOpenSynonymRow}
          onHistoryShown={onHistoryShown}
        />
      )}
    </>
  );
}

/** A kicker in ink capitals over the Word, as XSwipeV's «КАТЕГОРІЯ · … · 2 З 4»; it wraps rather than shrinks. */
function CardKicker({ text }: { text: string }) {
  const tokens = useTokens();
  return (
    <Text
      testID="word-card-kicker"
      style={[typeStyle('cardKicker', tokens), styles.kicker, { color: tokens.colors.ink }]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  kicker: { flexShrink: 1 },
});
