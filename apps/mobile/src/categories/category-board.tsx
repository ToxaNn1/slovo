import { fill, type Category } from '@slovo/contracts';
import type { CategoryKind } from '@slovo/core';
import {
  categoryGrid,
  correctionGrid,
  railScreen,
  RailScreenCard,
  RailScreenHero,
  UndoToastProvider,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useCategoryScreen } from '@/categories/category-screen';
import { editionStrings } from '@/edition/edition';

const { dashboard } = editionStrings;
/** The kicker and its count of Entries, «КАТЕГОРІЯ · N слів» or «… виправлень», by the list. */
const kickerOf: Record<CategoryKind, typeof dashboard.categories> = {
  word: dashboard.categories,
  correction: dashboard.correctionCategories,
};
/** The hero's glyph: the big shape of the Category's tile in k1 or k2, by its place there. */
function glyphOf(of: CategoryKind, place: number): ComponentProps<typeof RailScreenHero>['glyph'] {
  const { shapes } = of === 'word' ? categoryGrid : correctionGrid;
  const [glyph] = shapes[place % shapes.length] ?? shapes[0];
  return glyph;
}
/** Where the way back leads: home, or k2 «Виправлення». */
const backOf: Record<CategoryKind, string> = {
  word: editionStrings.tabs.home,
  correction: dashboard.correctionTypes.title,
};

/**
 * A Category's screen (board 05.1), of the Words' or the Corrections' list:
 * the red hero with the Category's shape, «КАТЕГОРІЯ · N …», its name and
 * description, «ЗНАЮ x З n» and «ДОДАТИ» / «У МІКСІ», its live Entries as
 * cards under it in the Language Pack's order. `place` is the Category's
 * place in its list, which picks its shape. An empty Category shows the hero
 * alone.
 */
export function CategoryBoardScreen(props: {
  of: CategoryKind;
  category: Category;
  place: number;
}) {
  return (
    <UndoToastProvider>
      <Board {...props} />
    </UndoToastProvider>
  );
}

function Board({ of, category, place }: { of: CategoryKind; category: Category; place: number }) {
  const { cards, known, inMix, toggleMix, openEntry } = useCategoryScreen(of, category);
  const { colors } = useTokens();
  const { count } = useEdition();
  const router = useRouter();
  const glyph = glyphOf(of, place);
  const strings = dashboard.category;
  const total = cards.length;
  return (
    <View testID="category" style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={cards}
        keyExtractor={({ entryId }) => entryId}
        renderItem={({ item: { entryId, row, known: isKnown }, index }) => (
          <RailScreenCard
            testID={`category-entry-${entryId}`}
            row={row}
            known={isKnown}
            index={index}
            onPress={() => {
              openEntry(entryId);
            }}
          />
        )}
        ListHeaderComponent={
          <RailScreenHero
            id="category-hero"
            glyph={glyph}
            kicker={fill(kickerOf[of].kicker, { count: count(kickerOf[of].count, total) })}
            title={category.displayName}
            description={category.description}
            progress={fill(strings.known, { x: String(known), n: String(total) })}
            done={total === 0 ? 0 : known / total}
            mascot="waits"
            back={{
              testID: 'category-back',
              label: backOf[of],
              onPress: () => {
                router.back();
              },
            }}
            action={{
              kind: 'toggle',
              testID: 'category-mix',
              label: inMix ? strings.inMix : strings.add,
              on: inMix,
              onPress: toggleMix,
            }}
          />
        }
        ListHeaderComponentStyle={styles.hero}
        ItemSeparatorComponent={Gap}
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
  hero: { marginHorizontal: -railScreen.list.side, marginBottom: railScreen.list.top },
  content: { paddingHorizontal: railScreen.list.side, paddingBottom: railScreen.list.bottom },
  gap: { height: railScreen.list.wordGap },
});
