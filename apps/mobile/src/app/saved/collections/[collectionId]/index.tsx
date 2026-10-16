import type { CollectionEntry } from '@slovo/core';
import {
  BackLink,
  EmptyState,
  EntryRow,
  fill,
  rowPadding,
  ScreenTitle,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addedOn } from '../../../../saved/added-on';
import { useCollectionEntries } from '../../../../saved/collections';
import { useComposition } from '../../../../composition';
import { editionStrings } from '../../../../edition/edition';
import { LoadFailed } from '../../../../edition/language-pack';
import { useOpenScreen } from '../../../../entries/use-open-screen';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.entries;

/**
 * A Collection: its Entries newest first, each row with when it was added. A
 * tap opens the Entry screen; a swipe (or the VoiceOver action) takes the Entry
 * out of this Collection only. An empty Collection says so, with a hint.
 */
export default function CollectionScreen() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const composition = useComposition();
  const { collection, entries, remove } = useCollectionEntries(collectionId);
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  const router = useRouter();
  const openScreen = useOpenScreen();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const name = collection?.name ?? '';

  function renderEntry({ entryId, row, addedAt }: CollectionEntry) {
    return (
      <EntryRow
        row={row}
        trailing={addedOn(addedAt)}
        onPress={() => {
          openScreen(`/saved/collections/${collectionId}/${entryId}`);
        }}
        actions={[
          {
            name: 'remove',
            label: strings.remove,
            accessibilityLabel: fill(strings.removeLabel, { title: row.title, name }),
            tone: 'destructive',
            onPress: () => {
              remove(entryId);
            },
          },
        ]}
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
                  router.back();
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
                  style={[styles.count, { color: colors.accent, fontFamily: fontFamilies.word }]}
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
              style={[styles.footer, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {strings.footer}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          collection === undefined ? null : (
            <EmptyState
              testID="collection-empty"
              title={strings.empty.title}
              message={strings.empty.message}
            />
          )
        }
        contentContainerStyle={styles.content}
      />
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
  count: { fontSize: typeSize.subhead, fontWeight: '500' },
  footer: {
    marginHorizontal: space[6],
    marginTop: space[4],
    fontSize: typeSize.chip,
    lineHeight: typeSize.chip * 1.5,
    fontWeight: '500',
  },
});
