import { fill, type Category } from '@slovo/contracts';
import type { CategoryKind } from '@slovo/core';
import {
  categoryGrid,
  correctionGrid,
  knownShare,
  QuietScreenHero,
  QuietScreenRow,
  RailBoard,
  railScreen,
  RailScreenHero,
  shapeAt,
  UndoToastProvider,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { useIsQuiet } from '@/categories/categories';
import { useCategoryScreen } from '@/categories/category-screen';
import { editionStrings } from '@/edition/edition';
import { ReadFailed } from '@/read-failed';

const { dashboard } = editionStrings;
/** The kicker and its count of Entries, «КАТЕГОРІЯ · N слів» or «… виправлень», by the list. */
const kickerOf: Record<CategoryKind, typeof dashboard.categories> = {
  word: dashboard.categories,
  correction: dashboard.correctionCategories,
};
/** The shape pairs of the Category's grid, k1 or k2, whose big shape at its place is the hero's glyph. */
const shapesOf = { word: categoryGrid.shapes, correction: correctionGrid.shapes } as const;
/** Where the way back leads: the grid the Category was opened from, k1 «Категорії» or k2 «Виправлення». */
const backOf: Record<CategoryKind, string> = {
  word: dashboard.categories.title,
  correction: dashboard.correctionCategories.title,
};

/**
 * A Category's screen (board 05.1), of the Words' or the Corrections' list:
 * the red hero with the Category's shape, «КАТЕГОРІЯ · N …», its name and
 * description, «ЗНАЮ x З n» and «ДОДАТИ» / «У МІКСІ», its live Entries as
 * cards under it in the Language Pack's order. `place` is the Category's
 * place in its list, which picks its shape. An empty Category shows the hero
 * alone, and the counts show once the Entries are read. A quiet Category of
 * Words draws its quiet screen instead (board 05.2 k3, ADR 0081): «Категорія»,
 * its name and description, no right button and no progress, its Entries as
 * plain rows. k2 draws no quiet tile, so a Category of Corrections is never
 * quiet.
 */
export function CategoryBoardScreen(props: {
  of: CategoryKind;
  category: Category;
  place: number;
}) {
  const isQuiet = useIsQuiet();
  const quiet = props.of === 'word' && isQuiet(props.category);
  return (
    <UndoToastProvider>
      {quiet ? <QuietBoard {...props} /> : <Board {...props} />}
    </UndoToastProvider>
  );
}

function Board({ of, category, place }: { of: CategoryKind; category: Category; place: number }) {
  const { cards, retry, inMix, toggleMix, openEntry } = useCategoryScreen(of, category);
  const { count } = useEdition();
  const router = useRouter();
  const [glyph] = shapeAt(shapesOf[of], place);
  const strings = dashboard.category;
  const { known, total, done } = knownShare(cards ?? []);
  const read = cards !== undefined;
  if (retry !== undefined)
    return (
      <ReadFailed
        back={{ testID: 'category-back', label: backOf[of] }}
        onRetry={retry}
        testID="category-error"
      />
    );
  return (
    <RailBoard
      testID="category"
      cards={cards ?? []}
      onOpen={openEntry}
      hero={
        <RailScreenHero
          id="category-hero"
          glyph={glyph}
          kicker={
            read ? fill(kickerOf[of].kicker, { count: count(kickerOf[of].count, total) }) : ''
          }
          title={category.displayName}
          description={category.description}
          progress={read ? fill(strings.known, { x: String(known), n: String(total) }) : ''}
          done={done}
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
    />
  );
}

function QuietBoard({ of, category }: { of: CategoryKind; category: Category }) {
  const { cards, retry, openEntry } = useCategoryScreen(of, category);
  const { colors } = useTokens();
  const router = useRouter();
  if (retry !== undefined)
    return (
      <ReadFailed
        back={{ testID: 'category-back', label: backOf[of] }}
        onRetry={retry}
        testID="category-error"
      />
    );
  return (
    <View testID="category" style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={cards ?? []}
        keyExtractor={({ entryId }) => entryId}
        renderItem={({ item: { entryId, row }, index }) => (
          <QuietScreenRow
            testID={`category-entry-${entryId}`}
            row={row}
            index={index}
            onPress={() => {
              openEntry(entryId);
            }}
          />
        )}
        ListHeaderComponent={
          <QuietScreenHero
            id="category-quiet"
            label={dashboard.category.quiet}
            title={category.displayName}
            description={category.description}
            back={{
              testID: 'category-back',
              label: backOf[of],
              onPress: () => {
                router.back();
              },
            }}
          />
        }
        ListHeaderComponentStyle={styles.hero}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { marginHorizontal: -railScreen.list.side, marginBottom: railScreen.list.top },
  content: { paddingHorizontal: railScreen.list.side, paddingBottom: railScreen.list.bottom },
});
