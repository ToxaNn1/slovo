import type { Collection, CollectionResult } from '@slovo/core';
import {
  BackLink,
  CollectionNameField,
  CollectionRow,
  EmptyState,
  fill,
  NewCollectionButton,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, FlatList, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { refusalText } from '../../../collection-refusal';
import { useCollectionChanges, useCollectionList } from '../../../collections';
import { useComposition } from '../../../composition';
import { editionStrings } from '../../../edition';
import { LoadFailed } from '../../../language-pack';
import { useOpenScreen } from '../../../use-open-screen';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;

/** The name field that is open: for a new Collection, or in place of the row being renamed. */
type Editing = { readonly kind: 'new' } | { readonly kind: 'rename'; readonly id: string };

/**
 * Collections: the reader's lists, newest first, each with how many Entries it
 * holds and its newest Lemmas; a tap opens the Collection. «+» makes a new one
 * from here; a swipe offers «Назва» (rename in place) and «Видалити» (after a
 * system action sheet that says the Entries stay), and the same actions go to
 * VoiceOver.
 */
export default function CollectionsScreen() {
  const composition = useComposition();
  const list = useCollectionList();
  const { create, rename, remove } = useCollectionChanges();
  const { colors } = useTokens();
  const { count } = useEdition();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const [editing, setEditing] = useState<Editing>();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const ready = composition.status === 'ready';

  function confirmDelete({ id, name }: Collection) {
    const { confirmDelete: texts } = strings;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: fill(texts.title, { name }),
        message: texts.message,
        options: [texts.confirm, texts.cancel],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) remove(id);
      },
    );
  }

  /** Keeps the name the field gives; closes the field, or says why the name is refused. */
  async function keepName(
    keep: () => Promise<CollectionResult | undefined>,
  ): Promise<string | undefined> {
    const result = await keep();
    if (result === undefined || result.ok) {
      setEditing(undefined);
      return undefined;
    }
    return refusalText(collectionStrings.sheet.refusal, result.reason);
  }

  function renderCollection(collection: Collection) {
    if (editing?.kind === 'rename' && editing.id === collection.id) {
      return (
        <CollectionNameField
          testID="collections-rename"
          overline={strings.renameOverline}
          placeholder={collectionStrings.sheet.namePlaceholder}
          initialName={collection.name}
          onSubmit={(name) => keepName(() => rename(collection.id, name))}
          onCancel={() => {
            setEditing(undefined);
          }}
        />
      );
    }
    const entries = count(collectionStrings.count, collection.count);
    return (
      <CollectionRow
        testID={`collection-${collection.id}`}
        name={collection.name}
        count={entries}
        lemmas={collection.newestLemmas}
        accessibilityLabel={
          collection.newestLemmas.length === 0
            ? fill(collectionStrings.collectionLabel, { name: collection.name, count: entries })
            : fill(strings.rowLabel, {
                name: collection.name,
                count: entries,
                lemmas: collection.newestLemmas.join(', '),
              })
        }
        onPress={() => {
          openScreen(`/saved/collections/${collection.id}`);
        }}
        actions={[
          {
            name: 'rename',
            label: strings.rename,
            accessibilityLabel: fill(strings.renameLabel, { name: collection.name }),
            tone: 'muted',
            onPress: () => {
              setEditing({ kind: 'rename', id: collection.id });
            },
          },
          {
            name: 'delete',
            label: strings.delete,
            accessibilityLabel: fill(strings.deleteLabel, { name: collection.name }),
            tone: 'destructive',
            onPress: () => {
              confirmDelete(collection);
            },
          },
        ]}
      />
    );
  }

  return (
    <SafeAreaView
      testID="collections"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <GestureHandlerRootView style={styles.screen}>
        <FlatList
          data={ready ? list : []}
          keyExtractor={(collection) => collection.id}
          renderItem={({ item }) => <View style={styles.item}>{renderCollection(item)}</View>}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={
            <>
              <View style={styles.bar}>
                <BackLink
                  testID="collections-back"
                  label={editionStrings.tabs.saved}
                  onPress={() => {
                    router.back();
                  }}
                />
                {ready && (
                  <NewCollectionButton
                    testID="collections-add"
                    accessibilityLabel={strings.add}
                    onPress={() => {
                      setEditing({ kind: 'new' });
                    }}
                  />
                )}
              </View>
              <View style={styles.header}>
                <ScreenTitle>{collectionStrings.title}</ScreenTitle>
              </View>
              {editing?.kind === 'new' && (
                <View style={[styles.item, styles.newField]}>
                  <CollectionNameField
                    testID="collections-new"
                    overline={strings.newOverline}
                    placeholder={collectionStrings.sheet.namePlaceholder}
                    onSubmit={(name) => keepName(() => create(name))}
                    onCancel={() => {
                      setEditing(undefined);
                    }}
                  />
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            ready && editing?.kind !== 'new' ? (
              <EmptyState
                testID="collections-empty"
                title={strings.empty.title}
                message={strings.empty.message}
                action={{
                  label: strings.empty.create,
                  testID: 'collections-empty-create',
                  onPress: () => {
                    setEditing({ kind: 'new' });
                  },
                }}
              />
            ) : null
          }
          contentContainerStyle={styles.content}
        />
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    paddingTop: space[2],
  },
  header: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[4] },
  // The design's side padding for Collections is 20.
  item: { marginHorizontal: space[5] },
  newField: { marginBottom: space[3] },
  separator: { height: space[3] },
});
