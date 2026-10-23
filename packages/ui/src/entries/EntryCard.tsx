import type { EntryFeedCard } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CorrectionCardBody } from './CorrectionCard';
import { IdiomCardBody } from './IdiomCard';
import { ConcealedProvider, useSelfCheck } from './self-check';
import { CardCorners } from '../decor/DecorSlots';
import { OutlineButton } from '../primitives/OutlineButton';
import { useEdition } from '../providers/EditionProvider';
import { ReviewLabel } from './ReviewLabel';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import { blockGap, correctionCardLayout, space, wordCardSide } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { WordCardBody } from './WordCard';

export interface EntryCardProps {
  /** The card of a Word, a Correction or an Idiom, as the Core built it. */
  card: EntryFeedCard;
  /** Opens a linked Correction when the reader taps its form in a Word's «often said» line. */
  onOpenCorrection?: (correctionId: string) => void;
  /** The action row under the card: in 0.3 the heart, Collections, share and hide. */
  actions?: ReactNode;
  /**
   * Self-check applies to the card: until the reader reveals it, a Word card
   * shows only its Lemma, part of speech and Category, a Correction card only
   * its non-standard form, and the Knowledge Mark buttons in `actions` are
   * inactive. The reveal resets once the card leaves the screen.
   */
  selfCheck?: boolean;
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
} as const;

/**
 * The Entry card: a Word's, a Correction's or an Idiom's card in the one card frame, at
 * the user's font size, with the compact layout on narrow screens, the Decor
 * slots and the action row under it. A card brought back for Review carries
 * the Review label on top. Under Self-check the card conceals its meaning
 * until the reader reveals it. The Edition's strings and language come
 * from the `EditionProvider`.
 */
export function EntryCard({ card, onOpenCorrection, actions, selfCheck = false }: EntryCardProps) {
  const { concealed, reveal } = useSelfCheck(selfCheck);
  const { strings } = useEdition();
  const { colors, radii } = useTokens();
  const lemmaSize = useLemmaSize();
  const compact = useCompactLayout();
  const padding = compact ? COMPACT_PADDING : 1;
  const spacing = SPACING[card.kind];

  return (
    <>
      <View
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
            card={card.wordCard}
            wordOfTheDay={card.wordOfTheDay}
            compact={compact}
            lemmaSize={lemmaSize}
            onOpenCorrection={onOpenCorrection}
            concealed={concealed}
          />
        ) : card.kind === 'correction' ? (
          <CorrectionCardBody
            card={card.correctionCard}
            lemmaSize={lemmaSize}
            concealed={concealed}
          />
        ) : (
          <IdiomCardBody card={card.idiomCard} lemmaSize={lemmaSize} concealed={concealed} />
        )}
        {concealed && (
          <OutlineButton
            testID={`${card.kind}-reveal`}
            // The Edition names the reveal for each kind: a Word's or an Idiom's meaning, a Correction's right form.
            label={(card.kind === 'correction' ? strings.correctionCard : strings.wordCard).reveal}
            onPress={reveal}
          />
        )}
        {/* Corner ornaments over the edges (Decor slot 3), on every kind of card. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <CardCorners />
        </View>
      </View>
      <ConcealedProvider value={concealed}>{actions}</ConcealedProvider>
    </>
  );
}

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1 },
});
