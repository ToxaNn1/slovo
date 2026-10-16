import type { EntryFeedCard } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CorrectionCardBody } from './CorrectionCard';
import { CardCorners } from '../decor/DecorSlots';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import { space } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { WordCardBody } from './WordCard';

export interface EntryCardProps {
  /** The card of a Word or a Correction, as the Core built it. */
  card: EntryFeedCard;
  /** Opens a linked Correction when the reader taps its form in a Word's «often said» line. */
  onOpenCorrection?: (correctionId: string) => void;
  /** The action row under the card: in 0.3 the heart, Collections, share and hide. */
  actions?: ReactNode;
}

/** On the SE the padding shrinks by 25% (the Lemma's size is in `useLemmaSize`). */
const COMPACT_PADDING = 0.75;

/** The padding and the space between blocks from the design, for each kind of card. */
const SPACING = {
  word: { top: space[8], side: 26, bottom: 26, gap: 18 },
  correction: { top: 28, side: 26, bottom: 24, gap: 16 },
} as const;

/**
 * The Entry card: a Word's or a Correction's card in the one card frame, at
 * the user's font size, with the compact layout on narrow screens, the Decor
 * slots of its kind and the action row under it. The Edition's strings and
 * language come from the `EditionProvider`.
 */
export function EntryCard({ card, onOpenCorrection, actions }: EntryCardProps) {
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
        {card.kind === 'word' ? (
          <>
            <WordCardBody
              card={card.wordCard}
              wordOfTheDay={card.wordOfTheDay}
              compact={compact}
              lemmaSize={lemmaSize}
              onOpenCorrection={onOpenCorrection}
            />
            {/* Corner ornaments over the edges (Decor slot 3); the Correction card has none. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <CardCorners />
            </View>
          </>
        ) : (
          <CorrectionCardBody card={card.correctionCard} lemmaSize={lemmaSize} />
        )}
      </View>
      {actions}
    </>
  );
}

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1 },
});
