import { fill } from '@slovo/contracts';
import type { AnyEntryCard, CategoryFeedPage, Composition } from '@slovo/core';
import {
  BackLink,
  EntryCard,
  FeedError,
  Placeholder,
  space,
  UndoToastProvider,
  useCloseUndoToast,
  useTokens,
  VerticalPager,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompositionRead } from '../composition';
import { editionStrings } from '../edition/edition';
import { ShownCardFeatures } from '../entries/card-features';
import { useEntrySlots } from '../entries/entry-actions';
import { ReadFailed } from '../read-failed';

const { feed: feedStrings } = editionStrings;
const turnActionLabels = { next: feedStrings.nextEntry, previous: feedStrings.previousEntry };
/** The pages drawn past the one on screen, so the next swipe always has a card to turn to. */
const AHEAD = 2;

/** What a list's Feed reads once: its name and its pages. Each page reads its own card as it is drawn. */
export interface ListFeedRead {
  /** The list's name, on the back tile and in each kicker. */
  readonly name: string;
  /** The page at a position from the tapped Entry; `undefined` for a list with no Entries. */
  readonly pageAt: (position: number) => CategoryFeedPage | undefined;
}

interface ListFeedProps {
  /** Reads the list; `undefined` for a list there is none of, which returns home. */
  readonly read: (composition: Composition) => Promise<ListFeedRead | undefined>;
  /** What a failed read logs. */
  readonly failure: string;
  /** The kicker of each card; takes `{name}`, `{place}` and `{of}`. */
  readonly kicker: string;
  /** The screen's test id; the pager, its cards and the back tile hang off it. */
  readonly testID: string;
}

/**
 * A list's Feed: the list's Entries alone, one card a page,
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
    (page: CategoryFeedPage, position: number) =>
      list === undefined ? null : (
        <ListFeedPageView
          entryId={page.entryId}
          testID={`${testID}-card-${String(position)}`}
          kicker={fill(kicker, {
            name: list.name,
            place: String(page.place),
            of: String(page.of),
          })}
        />
      ),
    [list, kicker, testID],
  );
  const onIndexChange = useCallback(
    (position: number) => {
      setDrawn((now) => Math.max(now, position + 1 + AHEAD));
      closeUndoToast();
    },
    [closeUndoToast],
  );

  if (reading.status === 'failed')
    return (
      <ReadFailed
        back={{ testID: `${testID}-back`, label: editionStrings.back }}
        onRetry={reading.retry}
        testID={`${testID}-error`}
      />
    );
  // A list there is none of returns home, as its screen does.
  if (reading.status === 'ready' && reading.value === undefined) return <Redirect href="/" />;
  if (reading.status === 'ready' && pages.length === 0)
    return <Placeholder message={editionStrings.noWords} />;
  return (
    <View
      testID={`${testID}-screen`}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
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
        <ShownCardFeatures place="listFeed">
          <VerticalPager
            testID={testID}
            items={pages}
            renderPage={renderPage}
            onIndexChange={onIndexChange}
            turnActionLabels={turnActionLabels}
          />
        </ShownCardFeatures>
      </View>
    </View>
  );
}

/**
 * A page of a list's Feed: its Entry's own card, with its place in the
 * kicker, read with `entryCard` once the page is drawn. `entryCard` writes
 * nothing, so a list's Feed makes nothing Seen and leaves History as it was.
 */
function ListFeedPageView({
  entryId,
  testID,
  kicker,
}: {
  entryId: string;
  testID: string;
  kicker: string;
}) {
  const read = useCallback((open: Composition) => open.entryCard(entryId), [entryId]);
  const reading = useCompositionRead(read, 'Could not read a card of a list Feed');
  const { title, message, retry } = editionStrings.loadFailed;
  return (
    <View testID={testID} style={styles.page}>
      {reading.status === 'failed' && (
        <FeedError
          title={title}
          message={message}
          retry={retry}
          onRetry={reading.retry}
          testID={`${testID}-error`}
        />
      )}
      {reading.status === 'ready' && reading.value !== undefined && (
        <ListFeedCard card={reading.value} testID={testID} kicker={kicker} />
      )}
    </View>
  );
}

/** A read card of a list's Feed, with its Entry's slots. */
function ListFeedCard({
  card,
  testID,
  kicker,
}: {
  card: AnyEntryCard;
  testID: string;
  kicker: string;
}) {
  const slots = useEntrySlots(card);
  return (
    <EntryCard
      card={card}
      slots={slots}
      kicker={kicker}
      // Right under the back tile's row, on the same page as in the Feed.
      page={{ testID, clearance: { framed: 0, scrolled: 0 } }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingLeft: space[3], paddingBottom: space[2] },
  pager: { flex: 1, overflow: 'hidden' },
  page: { flex: 1 },
});
