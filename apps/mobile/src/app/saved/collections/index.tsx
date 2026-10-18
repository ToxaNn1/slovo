import type { CollectionResult } from '@slovo/core';
import {
  BackLink,
  CollectionMenuSheet,
  CollectionNameField,
  CollectionRow,
  DeleteCollectionDialog,
  EmptyState,
  NewCollectionButton,
  ScreenTitle,
  space,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { memo, useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../../edition/edition';
import { useOpenScreen } from '../../../entries/use-open-screen';
import { refusalText } from '../../../saved/collection-refusal';
import { useCollectionChanges, useCollectionRows } from '../../../saved/collections';
import type { CollectionRowModel } from '../../../saved/collections-screen';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;

/** The name field that is open: for a new Collection, or in place of the row being renamed. */
type Editing = { readonly kind: 'new' } | { readonly kind: 'rename'; readonly id: string };

/**
 * Collections: the reader's lists, newest first, each with how many Entries it
 * holds and its newest Lemmas; a tap opens the Collection. «+» makes a new one
 * from here; a swipe or the row's «…» offers rename (in place) and delete (after a
 * SLOVO confirmation dialog that says the Entries stay), and the same actions go to
 * VoiceOver.
 */
export default function CollectionsScreen() {
  const rows = useCollectionRows();
  const { create, rename, remove } = useCollectionChanges();
  const { colors } = useTokens();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const [editing, setEditing] = useState<Editing>();
  const [menu, setMenu] = useState<CollectionRowModel>();
  const [deleting, setDeleting] = useState<CollectionRowModel>();
  /** The Collection the menu chose to delete: its dialog opens once the menu has slid away, as two modals do not show together. */
  const deleteAfterMenu = useRef<CollectionRowModel>(undefined);

  // Kept from render to render, so the rows re-render only when the list or the row being renamed changes.
  const openCollection = useCallback(
    (id: string) => {
      openScreen(`/saved/collections/${id}`);
    },
    [openScreen],
  );
  const startRename = useCallback((id: string) => {
    setEditing({ kind: 'rename', id });
  }, []);
  const stopEditing = useCallback(() => {
    setEditing(undefined);
  }, []);
  const openMenu = useCallback((collection: CollectionRowModel) => {
    deleteAfterMenu.current = undefined;
    setMenu(collection);
  }, []);
  const confirmDelete = useCallback((collection: CollectionRowModel) => {
    setDeleting(collection);
  }, []);
  /** Keeps the name the field gives; closes the field, or says why the name is refused. */
  const keepName = useCallback(
    async (keep: () => Promise<CollectionResult | undefined>): Promise<string | undefined> => {
      const result = await keep();
      if (result === undefined || result.ok) {
        setEditing(undefined);
        return undefined;
      }
      return refusalText(collectionStrings.sheet.refusal, result.reason);
    },
    [],
  );
  const keepRename = useCallback(
    (id: string, name: string) => keepName(() => rename(id, name)),
    [keepName, rename],
  );

  return (
    <SafeAreaView
      testID="collections"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={rows}
        keyExtractor={(collection) => collection.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <EditableCollectionRow
              collection={item}
              renaming={editing?.kind === 'rename' && editing.id === item.id}
              onOpen={openCollection}
              onRename={startRename}
              onDelete={confirmDelete}
              onMore={openMenu}
              onKeepRename={keepRename}
              onCancelRename={stopEditing}
            />
          </View>
        )}
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
              <NewCollectionButton
                testID="collections-add"
                accessibilityLabel={strings.add}
                onPress={() => {
                  setEditing({ kind: 'new' });
                }}
              />
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
                  onCancel={stopEditing}
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          editing?.kind !== 'new' ? (
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
      <CollectionMenuSheet
        testID="collections-menu"
        visible={menu !== undefined}
        copy={strings.menu}
        onRename={() => {
          if (menu !== undefined) startRename(menu.id);
          setMenu(undefined);
        }}
        onDelete={() => {
          deleteAfterMenu.current = menu;
          setMenu(undefined);
        }}
        onCancel={() => {
          setMenu(undefined);
        }}
        onDismissed={() => {
          if (deleteAfterMenu.current !== undefined) confirmDelete(deleteAfterMenu.current);
          deleteAfterMenu.current = undefined;
        }}
      />
      <DeleteCollectionDialog
        testID="collections-delete"
        name={deleting?.name}
        copy={strings.confirmDelete}
        onDelete={() => {
          if (deleting !== undefined) remove(deleting.id);
          setDeleting(undefined);
        }}
        onCancel={() => {
          setDeleting(undefined);
        }}
      />
    </SafeAreaView>
  );
}

/** A Collection's row, or the field that renames it in place. */
const EditableCollectionRow = memo(function EditableCollectionRow({
  collection,
  renaming,
  onOpen,
  onRename,
  onDelete,
  onMore,
  onKeepRename,
  onCancelRename,
}: {
  collection: CollectionRowModel;
  renaming: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (collection: CollectionRowModel) => void;
  onMore: (collection: CollectionRowModel) => void;
  /** Resolves to the reason the name is refused, or to nothing once it is kept. */
  onKeepRename: (id: string, name: string) => Promise<string | undefined>;
  onCancelRename: () => void;
}) {
  if (renaming) {
    return (
      <CollectionNameField
        testID="collections-rename"
        overline={strings.renameOverline}
        placeholder={collectionStrings.sheet.namePlaceholder}
        initialName={collection.name}
        onSubmit={(name) => onKeepRename(collection.id, name)}
        onCancel={onCancelRename}
      />
    );
  }
  return (
    <CollectionRow
      testID={`collection-${collection.id}`}
      name={collection.name}
      count={collection.count}
      lemmas={collection.lemmas}
      accessibilityLabel={collection.accessibilityLabel}
      onPress={() => {
        onOpen(collection.id);
      }}
      more={{
        label: collection.moreLabel,
        onPress: () => {
          onMore(collection);
        },
      }}
      actions={[
        {
          name: 'rename',
          label: strings.rename,
          accessibilityLabel: collection.renameLabel,
          tone: 'muted',
          onPress: () => {
            onRename(collection.id);
          },
        },
        {
          name: 'delete',
          label: strings.delete,
          accessibilityLabel: collection.deleteLabel,
          tone: 'destructive',
          onPress: () => {
            onDelete(collection);
          },
        },
      ]}
    />
  );
});

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
