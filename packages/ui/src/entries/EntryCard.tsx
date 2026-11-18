import type { EntryFeedCard, SynonymRowFeedCard, TipFeedCard } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CorrectionCardBody } from './CorrectionCard';
import { IdiomCardBody } from './IdiomCard';
import { CardKicker } from './EntryKicker';
import { KickerRow } from './KickerRow';
import { ConcealedProvider, useSelfCheck } from './self-check';
import { SynonymRowCardBody } from './SynonymRowCard';
import { TipCardBody } from './TipCard';
import { Button } from '../primitives/Button';
import { SwipeMarks, type EntrySwipe } from './SwipeMarks';
import { useEdition } from '../providers/EditionProvider';
import { ReviewLabel } from './ReviewLabel';
import { EntryReveal, RevealFrame } from './reveal';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import { compactCardPadding, entryCardFrame, wordHero } from '../tokens';
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
  /** The corner and the side swipes; none on a bare card. */
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
  /**
   * The tabbed card's last tab «Джерело» names the Entry's sources, which
   * leave its other tabs, while the Edition's `sourceTab` is on in effect
   * (ADR 0116). Only a tabbed card has it.
   */
  sourceTab?: boolean | undefined;
  /**
   * A tabbed Tip card with exceptions gets the tab «Винятки», while the
   * Edition's `tipExceptions` is on in effect (ADR 0120).
   */
  tipExceptions?: boolean | undefined;
  /** The card's place in a Category's or a Curated Collection's Feed (ADR 0110, 0178); none in the Feed. */
  kicker?: string | undefined;
  /**
   * Lays the card out on its page, told whether it is a fixed frame the
   * page's height (ADR 0091) or the red card of the Word of the Day that
   * Self-check keeps closed. None: the
   * card alone.
   */
  page?: ((card: ReactNode, framed: boolean) => ReactNode) | undefined;
}

/**
 * What an Entry card carries beside its content (ADR 0077, XSwipe): the
 * actions in the card's top row, beside its kicker, and the side swipes that
 * set the Entry's Knowledge Mark, with its stamp and undo toast, while the
 * Knowledge switch is on. Self-check conceals them as it conceals the card.
 */
export interface EntryCardSlots {
  corner: ReactNode;
  swipe: EntrySwipe | undefined;
}

/**
 * The Entry card: a Word's, a Correction's, an Idiom's, a Synonym Row's or a Tip's card in the one card frame, at
 * the user's font size, with the compact layout on narrow screens, the Decor
 * slots and the corner in its top row. A card brought back for Review carries
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
  sourceTab = false,
  tipExceptions = false,
  kicker,
  page = (entry) => entry,
}: EntryCardProps) {
  const { concealed, reveal } = useSelfCheck(selfCheck);
  const framed = fixedFrame(card, concealed);
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
      sourceTab={sourceTab}
      tipExceptions={tipExceptions}
      kicker={kicker}
      concealed={concealed}
      reveal={reveal}
    />
  );
  if (slots?.swipe === undefined) return page(face, framed);
  return page(
    <SwipeMarks
      swipe={slots.swipe}
      concealed={concealed}
      correction={card.kind === 'correction'}
      fill={framed}
    >
      {face}
    </SwipeMarks>,
    framed,
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
  sourceTab = false,
  tipExceptions = false,
  kicker,
  concealed,
  reveal,
}: Omit<EntryCardProps, 'selfCheck'> & { concealed: boolean; reveal: () => void }) {
  const { strings } = useEdition();
  const { colors } = useTokens();
  const lemmaSize = useLemmaSize();
  const compact = useCompactLayout();
  const padding = compact ? compactCardPadding : 1;
  // The tabbed card takes the board's frame for every kind (XEntry2).
  const framed = fixedFrame(card, concealed);
  // The corner actions share the top row with the card's kicker (XSwipe bar 6), which its body draws.
  const corner =
    slots !== undefined ? (
      <View testID={`${card.kind}-corner`}>
        <ConcealedProvider value={concealed}>{slots.corner}</ConcealedProvider>
      </View>
    ) : undefined;

  // A card brought back for Review sets its corner beside the Review label, on the card's top row.
  const bodyCorner = card.review === true ? undefined : corner;

  // The Word of the Day is the red shout card, which draws its own reveal button;
  // only while it is closed, and once open it is the tabbed card (board p1).
  if (card.kind === 'word' && card.wordOfTheDay !== undefined && !framed)
    return (
      <EntryReveal>
        <RevealFrame testID="word-card" style={styles.hero}>
          {card.review === true && <ReviewLabel />}
          <WordHero
            card={card.model}
            day={card.wordOfTheDay}
            lemmaSize={lemmaSize}
            onReveal={reveal}
            stressFalls={stressFalls}
            lemmaFont={wordOfTheDayFont}
            corner={corner}
          />
        </RevealFrame>
      </EntryReveal>
    );

  return (
    <EntryReveal>
      <RevealFrame
        testID={`${card.kind}-card`}
        style={[
          // The tabbed card takes the page's height, whatever its tab holds (ADR 0091),
          // outlined in ink over the red offset shadow of board p1.
          styles.card,
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
            backgroundColor: colors.surface,
            borderRadius: entryCardFrame.radius,
            paddingTop: entryCardFrame.padding.top * padding,
            paddingHorizontal: entryCardFrame.padding.side * padding,
            paddingBottom: entryCardFrame.padding.bottom * padding,
            gap: entryCardFrame.gap * padding,
          },
        ]}
      >
        {card.review === true && (
          <KickerRow testID={`${card.kind}-review-row`} corner={corner}>
            <ReviewLabel />
          </KickerRow>
        )}
        {/* A Word draws its kicker beside its corner; the other kinds over their own kicker. */}
        {card.kind !== 'word' && kicker !== undefined && (
          <CardKicker testID={`${card.kind}-card-kicker`} text={kicker} />
        )}
        {card.kind === 'word' ? (
          <WordCardBody
            card={card.model}
            wordOfTheDay={card.wordOfTheDay}
            lemmaSize={lemmaSize}
            onOpenCorrection={onOpenCorrection}
            onOpenSynonymRow={onOpenSynonymRow}
            onHistoryShown={onWordHistoryShown}
            concealed={concealed}
            stressFalls={stressFalls}
            wordOfTheDayFont={wordOfTheDayFont}
            corner={bodyCorner}
            sourceTab={sourceTab}
            kicker={kicker}
          />
        ) : card.kind === 'correction' ? (
          <CorrectionCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            corner={bodyCorner}
            sourceTab={sourceTab}
          />
        ) : card.kind === 'idiom' ? (
          <IdiomCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            corner={bodyCorner}
            sourceTab={sourceTab}
          />
        ) : card.kind === 'synonymRow' ? (
          <SynonymRowCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            onOpenWord={onOpenWord}
            corner={bodyCorner}
            sourceTab={sourceTab}
          />
        ) : (
          <TipCardBody
            card={card.model}
            lemmaSize={lemmaSize}
            concealed={concealed}
            corner={bodyCorner}
            sourceTab={sourceTab}
            exceptionsTab={tipExceptions}
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
      </RevealFrame>
    </EntryReveal>
  );
}

/**
 * Whether the card is a fixed frame the page's height with tabs
 * (ADR 0091): every card but the Word of the Day's while Self-check keeps it
 * closed, which is the red card until the reader reveals it.
 */
function fixedFrame(card: EntryCardProps['card'], concealed: boolean): boolean {
  return !(card.kind === 'word' && card.wordOfTheDay !== undefined && concealed);
}

const styles = StyleSheet.create({
  // The tabbed card keeps room on the right and below for its offset shadow.
  card: {
    flexGrow: 1,
    borderWidth: entryCardFrame.outline,
    marginRight: entryCardFrame.shadow,
    marginBottom: entryCardFrame.shadow,
  },
  hero: { borderRadius: wordHero.radius, overflow: 'hidden' },
});
