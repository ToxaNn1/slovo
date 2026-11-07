import { MascotIn } from '@/mascot/mascot';
import {
  CategoryGrid,
  categoryGrid,
  categoryGridBox,
  CollectionCard,
  collectionCard,
  CollectionMenuSheet,
  CollectionNameField,
  DeleteCollectionDialog,
  EmptyState,
  NewCollectionButton,
  space,
  UndoToastProvider,
} from '@slovo/ui';
import { memo, useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { useOpenScreen } from '@/use-open-screen';
import { useCollectionSharing } from '@/saved/collection-sharing';
import { useCollectionChanges, useCollectionRows } from '@/saved/collections';
import type { CollectionRowModel } from '@/saved/collections-screen';
import type { ListHeader } from '@/saved/list-header';
import { createMenuFollowUp } from '@/saved/menu-follow-up';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;

/** The name field that is open over the cards: for a new Collection, or for the one being renamed. */
type Editing = { readonly kind: 'new' } | { readonly kind: 'rename'; readonly id: string };

/**
 * Collections: the reader's lists, newest first, as cards two to a row, each
 * with its name and how many Entries it holds; a tap opens the Collection. «+»
 * makes a new one from here; a long press on a card opens its menu of rename
 * (in the name field over the cards) and delete (after a SLOVO confirmation
 * dialog that says the Entries stay), and the same actions go to VoiceOver. The
 * list's tool is «+». The menu also offers «Поділитися посиланням» while Collection Links
 * are on, disabled for an empty Collection; a share that fails says why in a toast.
 * With `collectionBoardStyle` on (ADR 0082) the Collections are the k1 grid of
 * the Categories instead: «Колекції» with their number, three columns of tiles
 * in the tones by position, a tile opening its Collection; «+» stays.
 */
export function CollectionsList({ header }: { header: ListHeader }) {
  return (
    <UndoToastProvider>
      <Collections header={header} />
    </UndoToastProvider>
  );
}

function Collections({ header }: { header: ListHeader }) {
  const rows = useCollectionRows();
  const boardStyle = useEditionInEffect().isFeatureEnabled('collectionBoardStyle');
  const { create, rename, remove } = useCollectionChanges();
  const { available: sharingAvailable, share } = useCollectionSharing();
  const openScreen = useOpenScreen();
  const [editing, setEditing] = useState<Editing>();
  const [menu, setMenu] = useState<CollectionRowModel>();
  const [deleting, setDeleting] = useState<CollectionRowModel>();

  // Kept from render to render, so the cards re-render only when the list changes.
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
  /** The Collection being renamed, while it is still there. */
  const renaming =
    editing?.kind === 'rename'
      ? rows.find((collection) => collection.id === editing.id)
      : undefined;

  const listHeader = (
    <>
      {header(
        <NewCollectionButton
          testID="collections-add"
          accessibilityLabel={strings.add}
          onPress={() => {
            setEditing({ kind: 'new' });
          }}
        />,
      )}
      {renaming !== undefined && (
        <View style={[styles.item, styles.newField]}>
          <CollectionNameField
            key={renaming.id}
            testID="collections-rename"
            overline={strings.renameOverline}
            placeholder={collectionStrings.sheet.namePlaceholder}
            initialName={renaming.name}
            onSubmit={(name) => keepName(rename(renaming.id, name))}
            onCancel={stopEditing}
          />
        </View>
      )}
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
  );
  const listEmpty =
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
    ) : undefined;

  return (
    <>
      {boardStyle ? (
        // DESIGN-05: not on the board, owner decides — a Collection's card in the old list
        // carries its count of Entries, its first Lemmas and its actions (the «⋯» menu,
        // rename and delete through `onMenu`, `onRename`, `onDelete`); the board's tile
        // shows the name alone, so the grid leaves them out. The Collection's screen keeps
        // the menu with rename, share and delete.
        <CategoryGrid
          testID="collections"
          title={collectionStrings.title}
          count={String(rows.length)}
          tiles={rows.map(({ id, name, accessibilityLabel }) => ({ id, name, accessibilityLabel }))}
          columns={3}
          box={categoryGridBox}
          shapes={categoryGrid.shapes}
          header={listHeader}
          empty={listEmpty}
          onOpen={openCollection}
        />
      ) : (
        <FlatList
          testID="collections"
          data={rows}
          keyExtractor={(collection) => collection.id}
          numColumns={2}
          columnWrapperStyle={styles.cardsRow}
          renderItem={({ item, index }) => (
            <View style={[styles.cell, index % 2 === 0 ? styles.leftCell : styles.rightCell]}>
              <Card
                index={index}
                collection={item}
                onOpen={openCollection}
                onRename={startRename}
                onDelete={confirmDelete}
                onMenu={openMenu}
              />
            </View>
          )}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.content}
        />
      )}
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
    </>
  );
}

/** A Collection's card, its menu on a long press and its actions for VoiceOver. */
const Card = memo(function Card({
  index,
  collection,
  onOpen,
  onRename,
  onDelete,
  onMenu,
}: {
  /** The card's place among the cards, which picks its fill and its mark. */
  index: number;
  collection: CollectionRowModel;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (collection: CollectionRowModel) => void;
  onMenu: (collection: CollectionRowModel) => void;
}) {
  return (
    <CollectionCard
      index={index}
      testID={`collection-card-${collection.id}`}
      name={collection.name}
      count={collection.count}
      accessibilityLabel={collection.accessibilityLabel}
      onPress={() => {
        onOpen(collection.id);
      }}
      onLongPress={() => {
        onMenu(collection);
      }}
      actions={[
        {
          name: 'rename',
          accessibilityLabel: collection.renameLabel,
          onPress: () => {
            onRename(collection.id);
          },
        },
        {
          name: 'delete',
          accessibilityLabel: collection.deleteLabel,
          onPress: () => {
            onDelete(collection);
          },
        },
        {
          name: 'menu',
          accessibilityLabel: collection.moreLabel,
          onPress: () => {
            onMenu(collection);
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
  content: { paddingBottom: space[8] },
  // The design's side padding for Collections is 20.
  item: { marginHorizontal: space[5] },
  newField: { marginBottom: space[3] },
  cardsRow: { marginHorizontal: space[5] },
  // Each card takes half the row, so a last card alone keeps its width.
  cell: { width: '50%', flexDirection: 'row' },
  leftCell: { paddingRight: collectionCard.gap / 2 },
  rightCell: { paddingLeft: collectionCard.gap / 2 },
  separator: { height: collectionCard.gap },
});
