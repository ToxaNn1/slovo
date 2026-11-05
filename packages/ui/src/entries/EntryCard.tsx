import type { EntryFeedCard, SynonymRowFeedCard, TipFeedCard } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CorrectionCardBody } from './CorrectionCard';
import { IdiomCardBody } from './IdiomCard';
import { ConcealedProvider, useSelfCheck } from './self-check';
import { SynonymRowCardBody } from './SynonymRowCard';
import { TipCardBody } from './TipCard';
import { Button } from '../primitives/Button';
import { SwipeMarks, type EntrySwipe } from './SwipeMarks';
import { useEdition } from '../providers/EditionProvider';
import { ReviewLabel } from './ReviewLabel';
import { EntryReveal, RevealDetail, RevealFrame } from './reveal';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import { blockGap, correctionCardLayout, space, wordCardSide, wordHero } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { WordCardBody } from './WordCard';
import { WordHero } from './WordHero';

export interface EntryCardProps {
  /** The card of a Word, a Correction, an Idiom, a Synonym Row or a Tip, as the Core built it. */
  card: EntryFeedCard | SynonymRowFeedCard | TipFeedCard;
  /** Opens a linked Correction when the reader taps its form in a Word's «often said» line. */
  onOpenCorrection?: ((correctionId: string) => void) | undefined;
  /** Opens a Word when the reader taps a linked member of a Synonym Row. */
  onOpenWord?: ((wordId: string) => void) | undefined;
  /** Opens the Synonym Row a Word card names as the row the Word is a member of. */
  onOpenSynonymRow?: ((synonymRowId: string) => void) | undefined;
  /**
   * Called once a Word card's Word History is drawn, which the reader reaches
   * by scrolling; the Entry screen counts it for Analytics (ADR 0068). Keep it
   * stable across renders, as it is called again when it changes.
   */
  onWordHistoryShown?: (() => void) | undefined;
  /** The action row: under a Word's card, at the bottom inside the card of every other kind. */
  actions?: ReactNode;
  /**
   * The actions in the frame's top-right corner, while marks are swiped
   * (XSwipe): concealed by Self-check as `actions` are.
   */
  corner?: ReactNode;
  /**
   * Self-check applies to the card: until the reader reveals it, a Word card
   * shows only its Lemma, part of speech and Category, a Correction card only
   * its non-standard form, an Idiom card only its expression and its chip, a
   * Synonym Row card only its dominant and its chip, a Tip card only its
   * title, its chip and its non-standard form, and the Knowledge Mark buttons in `actions` are
   * inactive. The reveal resets once the card leaves the screen.
   */
  selfCheck?: boolean;
  /**
   * The falling Stress of a Word card (ADR 0055): only in the Feed and on the
   * Entry screen, while the Edition's `stressAnimation` is on in effect.
   */
  stressFalls?: boolean | undefined;
  /**
   * The Edition's calligraphic font family, which the Lemma on the card of
   * the Word of the Day is set in: only in the Feed, while the Edition's
   * `calligraphy` is on in effect. Any other card keeps the Word font.
   */
  wordOfTheDayFont?: string | undefined;
  /**
   * The side swipes that set the Entry's Knowledge Mark, with its stamp and
   * undo toast: only under the `swipeMarks` Feature Switch (ADR 0077).
   */
  swipe?: EntrySwipe | undefined;
}

/** On the SE the padding shrinks by 25% (the Lemma's size is in `useLemmaSize`). */
const COMPACT_PADDING = 0.75;

/** The padding and the space between blocks from the design, for each kind of card. */
const SPACING = {
  word: { top: space[8], side: wordCardSide, bottom: wordCardSide, gap: blockGap },
  correction: {
    top: correctionCardLayout.paddingTop,
    side: wordCardSide,
    bottom: space[6],
    gap: space[4],
  },
  idiom: { top: space[8], side: wordCardSide, bottom: wordCardSide, gap: blockGap },
  synonymRow: { top: space[8], side: wordCardSide, bottom: wordCardSide, gap: blockGap },
  tip: { top: space[8], side: wordCardSide, bottom: wordCardSide, gap: blockGap },
} as const;

/**
 * The Entry card: a Word's, a Correction's, an Idiom's, a Synonym Row's or a Tip's card in the one card frame, at
 * the user's font size, with the compact layout on narrow screens, the Decor
 * slots and the action row under it. A card brought back for Review carries
 * the Review label on top. Under Self-check the card conceals its meaning
 * until the reader reveals it. Each time the card comes on screen its
 * headline's letters fly in and its details rise after them (the design's
 * reveal); under Reduce Motion it fades in once. The Edition's strings and language come
 * from the `EditionProvider`.
 */
export function EntryCard({
  card,
  onOpenCorrection,
  onOpenWord,
  onOpenSynonymRow,
  onWordHistoryShown,
  actions,
  corner,
  selfCheck = false,
  stressFalls = false,
  wordOfTheDayFont,
  swipe,
}: EntryCardProps) {
  const { concealed, reveal } = useSelfCheck(selfCheck);
  const face = (
    <EntryCardFace
      card={card}
      onOpenCorrection={onOpenCorrection}
      onOpenWord={onOpenWord}
      onOpenSynonymRow={onOpenSynonymRow}
      onWordHistoryShown={onWordHistoryShown}
      actions={actions}
      corner={corner}
      stressFalls={stressFalls}
      wordOfTheDayFont={wordOfTheDayFont}
      concealed={concealed}
      reveal={reveal}
    />
  );
  if (swipe === undefined) return face;
  return (
    <SwipeMarks swipe={swipe} concealed={concealed} correction={card.kind === 'correction'}>
      {face}
    </SwipeMarks>
  );
}

/** The card itself, with its Self-check state from `EntryCard`. */
function EntryCardFace({
  card,
  onOpenCorrection,
  onOpenWord,
  onOpenSynonymRow,
  onWordHistoryShown,
  actions,
  corner,
  stressFalls = false,
  wordOfTheDayFont,
  concealed,
  reveal,
}: Omit<EntryCardProps, 'selfCheck' | 'swipe'> & { concealed: boolean; reveal: () => void }) {
  const { strings } = useEdition();
  const { colors, radii } = useTokens();
  const lemmaSize = useLemmaSize();
  const compact = useCompactLayout();
  const padding = compact ? COMPACT_PADDING : 1;
  const spacing = SPACING[card.kind];
  // A Word's raised tiles stand under its card; the icons of the other kinds sit in theirs (XActions a10).
  const actionsOf = (kind: typeof card.kind) =>
    actions !== undefined && (
      <RevealDetail step={3} testID={`${kind}-actions`}>
        <ConcealedProvider value={concealed}>{actions}</ConcealedProvider>
      </RevealDetail>
    );
  const cornerOf = (kind: typeof card.kind) =>
    corner !== undefined && (
      <View style={styles.corner} testID={`${kind}-corner`}>
        <ConcealedProvider value={concealed}>{corner}</ConcealedProvider>
      </View>
    );

  // The Word of the Day is the red shout card, which draws its own reveal button.
  if (card.kind === 'word' && card.wordOfTheDay !== undefined)
    return (
      <EntryReveal>
        <RevealFrame testID="word-card" style={styles.hero}>
          {card.review === true && <ReviewLabel />}
          <WordHero
            card={card.model}
            day={card.wordOfTheDay}
            compact={compact}
            lemmaSize={lemmaSize}
            concealed={concealed}
            onReveal={reveal}
            stressFalls={stressFalls}
            lemmaFont={wordOfTheDayFont}
            onOpenCorrection={onOpenCorrection}
            onOpenSynonymRow={onOpenSynonymRow}
            onHistoryShown={onWordHistoryShown}
          />
          {cornerOf(card.kind)}
        </RevealFrame>
        {actionsOf(card.kind)}
      </EntryReveal>
    );

  return (
    <EntryReveal>
      <RevealFrame
        testID={`${card.kind}-card`}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderRadius: radii.card,
            paddingTop: spacing.top * padding,
            paddingHorizontal: spacing.side * padding,
            paddingBottom: spacing.bottom * padding,
            gap: spacing.gap * padding,
          },
        ]}
      >
        {card.review === true && <ReviewLabel />}
        {card.kind === 'word' ? (
          <WordCardBody
            card={card.model}
            wordOfTheDay={card.wordOfTheDay}
            compact={compact}
            lemmaSize={lemmaSize}
            onOpenCorrection={onOpenCorrection}
            onOpenSynonymRow={onOpenSynonymRow}
            onHistoryShown={onWordHistoryShown}
            concealed={concealed}
            stressFalls={stressFalls}
            wordOfTheDayFont={wordOfTheDayFont}
          />
        ) : card.kind === 'correction' ? (
          <CorrectionCardBody card={card.model} lemmaSize={lemmaSize} concealed={concealed} />
        ) : card.kind === 'idiom' ? (
          <IdiomCardBody card={card.model} lemmaSize={lemmaSize} concealed={concealed} />
        ) : card.kind === 'synonymRow' ? (
          <SynonymRowCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            onOpenWord={onOpenWord}
          />
        ) : (
          <TipCardBody card={card.model} lemmaSize={lemmaSize} concealed={concealed} />
        )}
        {concealed && (
          <Button
            size="small"
            variant="neutral"
            testID={`${card.kind}-reveal`}
            // The Edition names the reveal for each kind: a Word's, an Idiom's or a row's meaning, a Correction's or a Tip's right form.
            label={
              (card.kind === 'correction' || card.kind === 'tip'
                ? strings.correctionCard
                : strings.wordCard
              ).reveal
            }
            onPress={reveal}
          />
        )}
        {card.kind !== 'word' && actionsOf(card.kind)}
        {cornerOf(card.kind)}
      </RevealFrame>
      {card.kind === 'word' && actionsOf(card.kind)}
    </EntryReveal>
  );
}

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1 },
  hero: { borderRadius: wordHero.radius, overflow: 'hidden' },
  // Drawn last so it stays over the card's headline and takes its taps.
  corner: { position: 'absolute', top: space[2], right: space[2] },
});
