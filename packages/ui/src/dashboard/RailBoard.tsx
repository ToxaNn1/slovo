import type { EntryRowModel } from '@slovo/core';
import type { ReactElement, ReactNode } from 'react';
import type { ListRenderItem } from 'react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import type { ListScroll } from '../primitives/ScrollToTop';
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
  scroll,
  corner,
}: {
  /** The screen's; a card's is `${testID}-entry-${entryId}`. */
  testID: string;
  hero: ReactElement;
  cards: readonly RailBoardCard[];
  onOpen: (entryId: string) => void;
  /** The list's scroll, for its «Нагору» button. */
  scroll?: ListScroll<FlatList<RailBoardCard>> | undefined;
  /** What lies over the list in the screen's corner, such as its «Нагору» button. */
  corner?: ReactNode;
}) {
  return (
    <RailList
      testID={testID}
      hero={hero}
      items={cards}
      keyOf={({ entryId }) => entryId}
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
      gap={place.list.wordGap}
      scroll={scroll}
      corner={corner}
    />
  );
}

/**
 * The frame of a board-style screen with rows of its own, such as a
 * Correction Type's Corrections: the `hero` across the top, then one row per
 * item, `gap` apart.
 */
export function RailList<Item>({
  testID,
  hero,
  items,
  keyOf,
  renderItem,
  gap,
  scroll,
  corner,
}: {
  testID: string;
  hero: ReactElement;
  items: readonly Item[];
  keyOf: (item: Item) => string;
  renderItem: ListRenderItem<Item>;
  gap: number;
  /** The list's scroll, for its «Нагору» button. */
  scroll?: ListScroll<FlatList<Item>> | undefined;
  /** What lies over the list in the screen's corner, such as its «Нагору» button. */
  corner?: ReactNode;
}) {
  const { colors } = useTokens();
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        ref={scroll?.list}
        onScroll={scroll?.onScroll}
        data={items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={hero}
        ListHeaderComponentStyle={styles.hero}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
      />
      {corner}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { marginHorizontal: -place.list.side, marginBottom: place.list.top },
  content: { paddingHorizontal: place.list.side, paddingBottom: place.list.bottom },
});
