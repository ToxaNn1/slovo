import { fill, type Category } from '@slovo/contracts';
import {
  categoryFeedPage,
  type AnyEntryCard,
  type CategoryFeedPage,
  type Composition,
} from '@slovo/core';
import {
  BackLink,
  EntryCard,
  PagerScrollView,
  Placeholder,
  space,
  UndoToastProvider,
  useCloseUndoToast,
  useTokens,
  VerticalPager,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompositionRead } from '../composition';
import { editionStrings } from '../edition/edition';
import { useEntrySlots } from '../entries/entry-actions';
import { useShown } from '../shown-in-effect';

const { feed: feedStrings } = editionStrings;
const turnActionLabels = { next: feedStrings.nextEntry, previous: feedStrings.previousEntry };
/** The pages drawn past the one on screen, so the next swipe always has a card to turn to. */
const AHEAD = 2;

/** The cards of a Category's live Words, in the Language Pack's order. */
interface CategoryWords {
  readonly entryIds: readonly string[];
  readonly cards: ReadonlyMap<string, AnyEntryCard>;
}

async function readWords(composition: Composition, categoryId: string): Promise<CategoryWords> {
  const entries = await composition.categoryEntries('word', categoryId);
  const entryIds = entries.map(({ id }) => id);
  // `entryCard` writes nothing, so the Category's Feed makes nothing Seen (ADR 0110).
  const cards = await Promise.all(entryIds.map((id) => composition.entryCard(id)));
  return {
    entryIds,
    cards: new Map(cards.flatMap((card) => (card === undefined ? [] : [[card.entryId, card]]))),
  };
}

/**
 * A Category's Feed (ADR 0110): the Category's live Words alone, one card a
 * page, from the Word tapped on its screen on in the Language Pack's order
 * and round again after the last, endlessly, each card's kicker naming its
 * place, «Категорія · Емоції · 2 з 4». Its marks are any card's; it makes
 * nothing Seen and keeps the Feed's place. Its back tile, named for the
 * Category, returns to the Category's screen.
 */
export function CategoryFeedScreen({ category, from }: { category: Category; from: string }) {
  return (
    <UndoToastProvider>
      <CategoryFeed category={category} from={from} />
    </UndoToastProvider>
  );
}

function CategoryFeed({ category, from }: { category: Category; from: string }) {
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const closeUndoToast = useCloseUndoToast();
  const read = useCallback((open: Composition) => readWords(open, category.id), [category.id]);
  const reading = useCompositionRead(read, 'Could not read the Words of a Category');
  const words = reading.status === 'ready' ? reading.value : undefined;
  const [drawn, setDrawn] = useState(1 + AHEAD);
  const pages = useMemo(
    () =>
      words === undefined
        ? []
        : Array.from({ length: drawn }, (_, position) =>
            categoryFeedPage(words.entryIds, from, position),
          ).filter((page) => page !== undefined),
    [words, from, drawn],
  );
  const renderPage = useCallback(
    (page: CategoryFeedPage, position: number) => {
      const card = words?.cards.get(page.entryId);
      return card === undefined ? null : (
        <CategoryFeedPageView
          card={card}
          page={page}
          position={position}
          name={category.displayName}
        />
      );
    },
    [words, category.displayName],
  );
  const onIndexChange = useCallback(
    (position: number) => {
      setDrawn((now) => Math.max(now, position + 1 + AHEAD));
      closeUndoToast();
    },
    [closeUndoToast],
  );

  if (words !== undefined && pages.length === 0)
    return <Placeholder message={editionStrings.noWords} />;
  return (
    <View
      testID="category-feed-screen"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: top + space[2] }]}>
        <BackLink
          testID="category-feed-back"
          label={category.displayName}
          onPress={() => {
            router.back();
          }}
        />
      </View>
      {/* Under the back tile's row, so a scrolled card passes under nothing. */}
      <View style={styles.pager}>
        <VerticalPager
          testID="category-feed"
          items={pages}
          renderPage={renderPage}
          onIndexChange={onIndexChange}
          turnActionLabels={turnActionLabels}
        />
      </View>
    </View>
  );
}

/** A page of the Category's Feed: its Word's card, with its place in the kicker. */
function CategoryFeedPageView({
  card,
  page,
  position,
  name,
}: {
  card: AnyEntryCard;
  page: CategoryFeedPage;
  position: number;
  name: string;
}) {
  const { selfCheck, stressFall, wordTabs, sourceTab, tipExceptions } = useShown();
  const slots = useEntrySlots(card);
  const kicker = fill(editionStrings.dashboard.category.feedKicker, {
    name,
    place: String(page.place),
    of: String(page.of),
  });
  return (
    <View testID={`category-feed-card-${String(position)}`} style={styles.page}>
      <EntryCard
        card={card}
        slots={slots}
        kicker={kicker}
        selfCheck={selfCheck}
        stressFalls={stressFall}
        tabs={wordTabs}
        sourceTab={sourceTab}
        tipExceptions={tipExceptions}
        // A tabbed card is a fixed frame the page's height, as in the Feed: only
        // an opened tab inside it scrolls (ADR 0091, ADR 0113). Any other card scrolls.
        page={(entry, framed) =>
          framed ? (
            <View style={[styles.page, styles.content]}>{entry}</View>
          ) : (
            <PagerScrollView contentContainerStyle={styles.content}>{entry}</PagerScrollView>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingLeft: space[3], paddingBottom: space[2] },
  pager: { flex: 1, overflow: 'hidden' },
  page: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space[3], paddingBottom: space[6] },
});
