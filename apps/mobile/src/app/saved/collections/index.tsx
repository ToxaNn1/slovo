import { MascotIn } from '@/mascot/mascot';
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
  UndoToastProvider,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useCollectionSharing } from '@/saved/collection-sharing';
import { useCollectionChanges, useCollectionRows } from '@/saved/collections';
import type { CollectionRowModel } from '@/saved/collections-screen';
import { createMenuFollowUp } from '@/saved/menu-follow-up';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;

/** The name field that is open: for a new Collection, or in place of the row being renamed. */
type Editing = { readonly kind: 'new' } | { readonly kind: 'rename'; readonly id: string };

/**
 * Collections: the reader's lists, newest first, each with how many Entries it
 * holds and its newest Lemmas; a tap opens the Collection. «+» makes a new one
 * from here; a swipe or the row's «…» offers rename (in place) and delete (after a
 * SLOVO confirmation dialog that says the Entries stay), and the same actions go to
 * VoiceOver. The «…» menu also offers «Поділитися посиланням» while Collection Links
 * are on, disabled for an empty Collection; a share that fails says why in a toast.
 */
export default function CollectionsScreen() {
  return (
    <UndoToastProvider>
      <Collections />
    </UndoToastProvider>
  );
}

function Collections() {
  const rows = useCollectionRows();
  const { create, rename, remove } = useCollectionChanges();
  const { available: sharingAvailable, share } = useCollectionSharing();
  const { colors } = useTokens();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const [editing, setEditing] = useState<Editing>();
  const [menu, setMenu] = useState<CollectionRowModel>();
  const [deleting, setDeleting] = useState<CollectionRowModel>();

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
  const confirmDelete = useCallback((collection: CollectionRowModel) => {
    setDeleting(collection);
  }, []);
  /** What the menu chose runs once the menu has slid away: two modals do not show together, and the name field would lose the focus to the leaving one. */
  const [afterMenu] = useState(() =>
    createMenuFollowUp<CollectionRowModel>({
      rename: (collection) => {
        startRename(collection.id);
      },
      remove: confirmDelete,
      share: (collection) => {
        share(collection.id);
      },
    }),
  );
  const openMenu = useCallback(
    (collection: CollectionRowModel) => {
      afterMenu.opened();
      setMenu(collection);
    },
    [afterMenu],
  );
  /** Closes the field once its name is kept; a refused name stays in it, with why. */
  const keepName = useCallback(async (kept: Promise<string | undefined>) => {
    const refusal = await kept;
    if (refusal === undefined) setEditing(undefined);
    return refusal;
  }, []);
  const keepRename = useCallback(
    (id: string, name: string) => keepName(rename(id, name)),
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
                  onSubmit={(name) => keepName(create(name))}
                  onCancel={stopEditing}
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          editing?.kind !== 'new' ? (
            <EmptyState
              mascot={<MascotIn state="empty" />}
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
        share={
          sharingAvailable
            ? {
                label: collectionStrings.link.share,
                disabled: menu?.empty ?? true,
                disabledHint: collectionStrings.entries.empty.title,
                onPress: () => {
                  if (menu !== undefined) afterMenu.chooseShare(menu);
                  setMenu(undefined);
                },
              }
            : undefined
        }
        onRename={() => {
          if (menu !== undefined) afterMenu.chooseRename(menu);
          setMenu(undefined);
        }}
        onDelete={() => {
          if (menu !== undefined) afterMenu.chooseDelete(menu);
          setMenu(undefined);
        }}
        onCancel={() => {
          setMenu(undefined);
        }}
        onDismissed={afterMenu.dismissed}
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
