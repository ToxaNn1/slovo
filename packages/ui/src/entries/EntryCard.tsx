import type { EntryFeedCard } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PagerScrollView } from '../primitives/VerticalPager';
import { CorrectionCardBody } from './CorrectionCard';
import { CardCorners } from '../decor/DecorSlots';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import { blockGap, space, wordCardSide } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { WordCardBody } from './WordCard';

export interface EntryCardProps {
  /** The card of a Word or a Correction, as the Core built it. */
  card: EntryFeedCard;
  /** Opens a linked Correction when the reader taps its form in a Word's «often said» line. */
  onOpenCorrection?: (correctionId: string) => void;
  /** The action row under the card: in 0.3 the heart, Collections, share and hide. */
  actions?: ReactNode;
  /**
   * In the Feed: the card fits the space it is given and sits in the middle of
   * it, or fills it from the top when it is taller; its text scrolls inside the
   * frame (a swipe on the text swipes on to the next card at the end of the
   * text, a swipe beside it at once), and the action row stays under the frame.
   * Only inside a `VerticalPager`.
   */
  scrollable?: boolean;
}

/** On the SE the padding shrinks by 25% (the Lemma's size is in `useLemmaSize`). */
const COMPACT_PADDING = 0.75;

/** The padding and the space between blocks from the design, for each kind of card. */
const SPACING = {
  word: { top: space[8], side: wordCardSide, bottom: wordCardSide, gap: blockGap },
  correction: { top: 28, side: wordCardSide, bottom: 24, gap: space[4] },
} as const;

/**
 * The Entry card: a Word's or a Correction's card in the one card frame, at
 * the user's font size, with the compact layout on narrow screens, the Decor
 * slots and the action row under it. The Edition's strings and language come
 * from the `EditionProvider`.
 */
export function EntryCard({ card, onOpenCorrection, actions, scrollable }: EntryCardProps) {
  const { colors, radii } = useTokens();
  const lemmaSize = useLemmaSize();
  const compact = useCompactLayout();
  const padding = compact ? COMPACT_PADDING : 1;
  const spacing = SPACING[card.kind];

  const blocks =
    card.kind === 'word' ? (
      <WordCardBody
        card={card.wordCard}
        wordOfTheDay={card.wordOfTheDay}
        compact={compact}
        lemmaSize={lemmaSize}
        onOpenCorrection={onOpenCorrection}
      />
    ) : (
      <CorrectionCardBody card={card.correctionCard} lemmaSize={lemmaSize} />
    );
  // The blocks sit in the frame's padding, which scrolls with them in the Feed.
  const inset = {
    paddingTop: spacing.top * padding,
    paddingHorizontal: spacing.side * padding,
    paddingBottom: spacing.bottom * padding,
    gap: spacing.gap * padding,
  };

  const frame = (
    <View
      testID={`${card.kind}-card`}
      style={[
        styles.card,
        scrollable && styles.fitting,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      {scrollable ? (
        <PagerScrollView
          testID="entry-card-scroll"
          style={styles.fitting}
          contentContainerStyle={inset}
        >
          {blocks}
        </PagerScrollView>
      ) : (
        <View style={inset}>{blocks}</View>
      )}
      {/* Corner ornaments over the edges (Decor slot 3), on both kinds of card. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <CardCorners />
      </View>
    </View>
  );

  return scrollable ? (
    <View testID="entry-card-page" style={styles.page}>
      {frame}
      {actions}
    </View>
  ) : (
    <>
      {frame}
      {actions}
    </>
  );
}

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1, overflow: 'hidden' },
  // The card and its actions take the height they need and sit in the middle of
  // the space they are given.
  page: { flexGrow: 1, flexShrink: 1, justifyContent: 'center' },
  // Takes the height its content needs, and no more than the space left.
  fitting: { flexGrow: 0, flexShrink: 1 },
});
