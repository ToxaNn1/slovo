import { MascotIn } from '@/mascot/mascot';
import type { CollectionEntry } from '@slovo/core';
import {
  BackLink,
  CollectionEntryRow,
  EmptyState,
  rowPadding,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useListScroll,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { addedOn } from '@/saved/added-on';
import { CollectionBoardScreen } from '@/saved/collection-board';
import { useCollectionEntries } from '@/saved/collections';
import { useOpenScreen } from '@/use-open-screen';
import { useSegmentParam } from '@/route-params';
import { ListTopButton } from '@/shell/list-top';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.entries;

/**
 * A Collection: in the board style while `collectionBoardStyle` is on
 * (ADR 0082), today's screen while it is off.
 */
export default function CollectionScreen() {
  const collectionId = useSegmentParam('collectionId');
  return useEditionInEffect().isFeatureEnabled('collectionBoardStyle') ? (
    <CollectionBoardScreen collectionId={collectionId} />
  ) : (
    <CollectionListScreen collectionId={collectionId} />
  );
}

/**
 * A Collection: its Entries newest first, each row with its kind and when it
 * was added. A tap opens the Entry screen; a swipe (or the VoiceOver action)
 * takes the Entry out of this Collection only. An empty Collection says so,
 * with a hint. «Колекції» goes back to Collections, or opens them when the
 * Collection came first in the Saved tab, as a Collection Link's copy or a
 * Spotlight result does.
 */
function CollectionListScreen({ collectionId }: { collectionId: string }) {
  const { collection, entries, remove } = useCollectionEntries(collectionId);
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  const router = useRouter();
  const openScreen = useOpenScreen();

  const name = collection?.name ?? '';
  const scroll = useListScroll<FlatList<CollectionEntry>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  function renderEntry(entry: CollectionEntry) {
    return (
      <CollectionEntryRow
        entry={entry}
        added={addedOn(entry.addedAt)}
        collectionName={name}
        onPress={() => {
          openScreen(`/saved/collections/${collectionId}/${entry.entryId}`);
        }}
        onRemove={() => {
          remove(entry.entryId);
        }}
      />
    );
  }

  return (
    <SafeAreaView
      testID="collection"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList
        ref={listRef}
        onScroll={onListScroll}
        data={collection === undefined ? [] : entries}
        keyExtractor={(entry) => entry.entryId}
        renderItem={({ item }) => renderEntry(item)}
        ListHeaderComponent={
          <>
            <View style={styles.back}>
              <BackLink
                testID="collection-back"
                label={collectionStrings.title}
                onPress={() => {
                  if (router.canDismiss()) router.dismiss();
                  else router.replace('/saved/collections');
                }}
              />
            </View>
            {collection !== undefined && (
              <View
                style={[
                  styles.header,
                  entries.length > 0 && { borderBottomWidth: 1, borderColor: colors.line },
                ]}
              >
                <View style={styles.title}>
                  <ScreenTitle>{name}</ScreenTitle>
                </View>
                <Text
                  testID="collection-count"
                  accessibilityLabel={count(collectionStrings.count, entries.length)}
                  {...voice}
                  style={[typeStyle('collectionCount', tokens), { color: colors.accentText }]}
                >
                  {String(entries.length)}
                </Text>
              </View>
            )}
          </>
        }
        ListFooterComponent={
          entries.length > 0 ? (
            <Text
              {...voice}
              style={[typeStyle('meta', tokens), styles.footer, { color: colors.muted }]}
            >
              {strings.footer}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          collection === undefined ? undefined : (
            <EmptyState
              mascot={<MascotIn state="empty" />}
              testID="collection-empty"
              title={strings.empty.title}
              message={strings.empty.message}
            />
          )
        }
        contentContainerStyle={styles.content}
      />
      <ListTopButton scroll={scroll} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingTop: space[2],
    paddingBottom: rowPadding,
  },
  title: { flexGrow: 1, flexShrink: 1 },
  footer: {
    marginHorizontal: space[6],
    marginTop: space[4],
  },
});
