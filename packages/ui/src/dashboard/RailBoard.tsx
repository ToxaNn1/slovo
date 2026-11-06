import type { EntryRowModel } from '@slovo/core';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useTokens } from '../providers/TokensProvider';
import { railScreen as place } from '../tokens';
import { RailScreenCard } from './RailScreenCard';

/** One card of a board-style screen: an Entry and whether it is Known. */
export interface RailBoardCard {
  readonly entryId: string;
  readonly row: EntryRowModel;
  readonly known: boolean;
}

/**
 * How many of the cards are Known, of how many, and the share of the hero's
 * bar that fills, for «ЗНАЮ x З n»; none of none while there are no cards.
 */
export function knownShare(cards: readonly RailBoardCard[]): {
  known: number;
  total: number;
  done: number;
} {
  const known = cards.filter((card) => card.known).length;
  const total = cards.length;
  return { known, total, done: total === 0 ? 0 : known / total };
}

/**
 * A board-style screen (board 05.1, ADR 0082), as a Category, a Collection
 * and a Curated Collection draw it: the `hero` across the top, then the
 * cards, one per Entry, rising in one after another. A tap on a card opens
 * its Entry. What the hero holds, such as a field to rename the Collection,
 * stays usable over the keyboard.
 */
export function RailBoard({
  testID,
  hero,
  cards,
  onOpen,
}: {
  /** The screen's; a card's is `${testID}-entry-${entryId}`. */
  testID: string;
  hero: ReactElement;
  cards: readonly RailBoardCard[];
  onOpen: (entryId: string) => void;
}) {
  const { colors } = useTokens();
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={cards}
        keyExtractor={({ entryId }) => entryId}
        renderItem={({ item: { entryId, row, known }, index }) => (
          <RailScreenCard
            testID={`${testID}-entry-${entryId}`}
            row={row}
            known={known}
            index={index}
            onPress={() => {
              onOpen(entryId);
            }}
          />
        )}
        ListHeaderComponent={hero}
        ListHeaderComponentStyle={styles.hero}
        ItemSeparatorComponent={Gap}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { marginHorizontal: -place.list.side, marginBottom: place.list.top },
  content: { paddingHorizontal: place.list.side, paddingBottom: place.list.bottom },
  gap: { height: place.list.wordGap },
});
