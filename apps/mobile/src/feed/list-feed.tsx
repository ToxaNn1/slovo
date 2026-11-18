import { fill } from '@slovo/contracts';
import type { AnyEntryCard, CategoryFeedPage, Composition } from '@slovo/core';
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

/** What a list's Feed reads once: its name, its pages and the cards they open. */
export interface ListFeedRead {
  /** The list's name, on the back tile and in each kicker. */
  readonly name: string;
  /** The page at a position from the tapped Entry; `undefined` for a list with no Entries. */
  readonly pageAt: (position: number) => CategoryFeedPage | undefined;
  readonly cards: ReadonlyMap<string, AnyEntryCard>;
}

/**
 * The cards of `entryIds`, read with `entryCard`, which writes nothing, so a
 * list's Feed makes nothing Seen and leaves History as it was (ADR 0110).
 */
export async function readCards(
  composition: Composition,
  entryIds: readonly string[],
): Promise<ReadonlyMap<string, AnyEntryCard>> {
  const cards = await Promise.all(entryIds.map((id) => composition.entryCard(id)));
  return new Map(cards.flatMap((card) => (card === undefined ? [] : [[card.entryId, card]])));
}

interface ListFeedProps {
  /** Reads the list; `undefined` for a list there is none of. */
  readonly read: (composition: Composition) => Promise<ListFeedRead | undefined>;
  /** What a failed read logs. */
  readonly failure: string;
  /** The kicker of each card; takes `{name}`, `{place}` and `{of}`. */
  readonly kicker: string;
  /** The screen's test id; the pager, its cards and the back tile hang off it. */
  readonly testID: string;
}

/**
 * A list's Feed (ADR 0110, 0178): the list's Entries alone, one card a page,
 * from the tapped one on in the list's order and round again after the last,
 * endlessly, each card's kicker naming its place, «Категорія · Емоції · 2 з 4».
 * Its marks are any card's; it makes nothing Seen and keeps the Feed's place.
 * Its back tile, named for the list, returns to the list's screen.
 */
export function ListFeedScreen(props: ListFeedProps) {
  return (
    <UndoToastProvider>
      <ListFeed {...props} />
    </UndoToastProvider>
  );
}

function ListFeed({ read, failure, kicker, testID }: ListFeedProps) {
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const closeUndoToast = useCloseUndoToast();
  const reading = useCompositionRead(read, failure);
  const list = reading.status === 'ready' ? reading.value : undefined;
  const [drawn, setDrawn] = useState(1 + AHEAD);
  const pages = useMemo(
    () =>
      list === undefined
        ? []
        : Array.from({ length: drawn }, (_, position) => list.pageAt(position)).filter(
            (page) => page !== undefined,
          ),
    [list, drawn],
  );
  const renderPage = useCallback(
    (page: CategoryFeedPage, position: number) => {
      const card = list?.cards.get(page.entryId);
      return card === undefined || list === undefined ? null : (
        <ListFeedPageView
          card={card}
          testID={`${testID}-card-${String(position)}`}
          kicker={fill(kicker, {
            name: list.name,
            place: String(page.place),
            of: String(page.of),
          })}
        />
      );
    },
    [list, kicker, testID],
  );
  const onIndexChange = useCallback(
    (position: number) => {
      setDrawn((now) => Math.max(now, position + 1 + AHEAD));
      closeUndoToast();
    },
    [closeUndoToast],
  );

  if (reading.status === 'ready' && pages.length === 0)
    return <Placeholder message={editionStrings.noWords} />;
  return (
    <View testID={`${testID}-screen`} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: top + space[2] }]}>
        <BackLink
          testID={`${testID}-back`}
          label={list?.name ?? ''}
          onPress={() => {
            router.back();
          }}
        />
      </View>
      {/* Under the back tile's row, so a scrolled card passes under nothing. */}
      <View style={styles.pager}>
        <VerticalPager
          testID={testID}
          items={pages}
          renderPage={renderPage}
          onIndexChange={onIndexChange}
          turnActionLabels={turnActionLabels}
        />
      </View>
    </View>
  );
}

/** A page of a list's Feed: its Entry's own card, with its place in the kicker. */
function ListFeedPageView({
  card,
  testID,
  kicker,
}: {
  card: AnyEntryCard;
  testID: string;
  kicker: string;
}) {
  const { selfCheck, stressFall, wordTabs, sourceTab, tipExceptions } = useShown();
  const slots = useEntrySlots(card);
  return (
    <View testID={testID} style={styles.page}>
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
