import type { EntryFeedCard, SynonymRowFeedCard, TipFeedCard } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CorrectionCardBody } from './CorrectionCard';
import { IdiomCardBody } from './IdiomCard';
import { KickerRow } from './KickerRow';
import { ConcealedProvider, useSelfCheck } from './self-check';
import { SynonymRowCardBody } from './SynonymRowCard';
import { TipCardBody } from './TipCard';
import { Button } from '../primitives/Button';
import { SwipeMarks, type EntrySwipe } from './SwipeMarks';
import { useEdition } from '../providers/EditionProvider';
import { ReviewLabel } from './ReviewLabel';
import { EntryReveal, RevealDetail, RevealFrame } from './reveal';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import {
  blockGap,
  compactCardPadding,
  correctionCardLayout,
  entryCardFrame,
  space,
  wordCardSide,
  wordHero,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { WordCardBody } from './WordCardBody';
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
  /** The action row or, while marks are swiped, the corner and the swipes; none on a bare card. */
  slots?: EntryCardSlots | undefined;
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
   * A Word's, a Correction's, a Tip's, a Synonym Row's or an Idiom's card in
   * a fixed-height frame, with tabs under its head, while the Edition's
   * `wordTabs` is on in effect (ADR 0091). The Word of the Day's card stays
   * the red card while Self-check keeps it closed, and opens into the tabbed
   * card with its kicker.
   */
  tabs?: boolean | undefined;
}

/**
 * What an Entry card carries beside its content. With the `swipeMarks`
 * Feature Switch off, the action row: under a Word's card, at the bottom
 * inside the card of every other kind. With it on (ADR 0077, XSwipe), the
 * actions in the card's top row, beside its kicker, and the side swipes that set the
 * Entry's Knowledge Mark, with its stamp and undo toast, while the Knowledge
 * switch is on. Self-check conceals either as it conceals the card.
 */
export type EntryCardSlots =
  | { slot: 'actions'; actions: ReactNode }
  | { slot: 'corner'; corner: ReactNode; swipe: EntrySwipe | undefined };

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
  slots,
  selfCheck = false,
  stressFalls = false,
  wordOfTheDayFont,
  tabs = false,
}: EntryCardProps) {
  const { concealed, reveal } = useSelfCheck(selfCheck);
  const face = (
    <EntryCardFace
      card={card}
      onOpenCorrection={onOpenCorrection}
      onOpenWord={onOpenWord}
      onOpenSynonymRow={onOpenSynonymRow}
      onWordHistoryShown={onWordHistoryShown}
      slots={slots}
      stressFalls={stressFalls}
      wordOfTheDayFont={wordOfTheDayFont}
      tabs={tabs}
      concealed={concealed}
      reveal={reveal}
    />
  );
  if (slots?.slot !== 'corner' || slots.swipe === undefined) return face;
  return (
    <SwipeMarks
      swipe={slots.swipe}
      concealed={concealed}
      correction={card.kind === 'correction'}
      fill={fixedFrame(card, tabs, concealed)}
    >
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
  slots,
  stressFalls = false,
  wordOfTheDayFont,
  tabs = false,
  concealed,
  reveal,
}: Omit<EntryCardProps, 'selfCheck'> & { concealed: boolean; reveal: () => void }) {
  const { strings } = useEdition();
  const { colors, radii } = useTokens();
  const lemmaSize = useLemmaSize();
  const compact = useCompactLayout();
  const padding = compact ? compactCardPadding : 1;
  const spacing = SPACING[card.kind];
  // A Word's raised tiles stand under its card; the icons of the other kinds sit in theirs (XActions a10).
  const actionsOf = (kind: typeof card.kind) =>
    slots?.slot === 'actions' && (
      <RevealDetail step={3} testID={`${kind}-actions`}>
        <ConcealedProvider value={concealed}>{slots.actions}</ConcealedProvider>
      </RevealDetail>
    );
  // The corner actions share the top row with the card's kicker (XSwipe bar 6), which its body draws.
  const corner =
    slots?.slot === 'corner' ? (
      <View testID={`${card.kind}-corner`}>
        <ConcealedProvider value={concealed}>{slots.corner}</ConcealedProvider>
      </View>
    ) : undefined;

  // A card brought back for Review sets its corner beside the Review label, on the card's top row.
  const bodyCorner = card.review === true ? undefined : corner;

  // The Word of the Day is the red shout card, which draws its own reveal button;
  // with tabs, only while it is closed, and once open it is the tabbed card (board p1).
  if (card.kind === 'word' && card.wordOfTheDay !== undefined && !fixedFrame(card, tabs, concealed))
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
            corner={corner}
          />
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
          { borderColor: colors.line },
          // The tabbed card takes the page's height, whatever its tab holds (ADR 0091),
          // outlined in ink over the red offset shadow of board p1.
          fixedFrame(card, tabs, concealed) && [
            styles.fixed,
            {
              borderColor: colors.ink,
              boxShadow: [
                {
                  offsetX: entryCardFrame.shadow,
                  offsetY: entryCardFrame.shadow,
                  blurRadius: 0,
                  color: colors.accent,
                },
              ],
            },
          ],
          {
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            paddingTop: spacing.top * padding,
            paddingHorizontal: spacing.side * padding,
            paddingBottom: spacing.bottom * padding,
            gap: spacing.gap * padding,
          },
        ]}
      >
        {card.review === true && (
          <KickerRow testID={`${card.kind}-review-row`} corner={corner}>
            <ReviewLabel />
          </KickerRow>
        )}
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
            corner={bodyCorner}
            tabs={tabs}
          />
        ) : card.kind === 'correction' ? (
          <CorrectionCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            corner={bodyCorner}
            tabs={tabs}
          />
        ) : card.kind === 'idiom' ? (
          <IdiomCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            corner={bodyCorner}
            tabs={tabs}
          />
        ) : card.kind === 'synonymRow' ? (
          <SynonymRowCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            onOpenWord={onOpenWord}
            corner={bodyCorner}
            tabs={tabs}
          />
        ) : (
          <TipCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            corner={bodyCorner}
            tabs={tabs}
          />
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
      </RevealFrame>
      {card.kind === 'word' && actionsOf(card.kind)}
    </EntryReveal>
  );
}

/**
 * Whether the card is a fixed frame the page's height while `wordTabs` is on
 * (ADR 0091): every card but the Word of the Day's while Self-check keeps it
 * closed, which is the red card until the reader reveals it.
 */
function fixedFrame(card: EntryCardProps['card'], tabs: boolean, concealed: boolean): boolean {
  return tabs && !(card.kind === 'word' && card.wordOfTheDay !== undefined && concealed);
}

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1 },
  // The tabbed card keeps room on the right and below for its offset shadow.
  fixed: {
    flexGrow: 1,
    borderWidth: entryCardFrame.outline,
    marginRight: entryCardFrame.shadow,
    marginBottom: entryCardFrame.shadow,
  },
  hero: { borderRadius: wordHero.radius, overflow: 'hidden' },
});
