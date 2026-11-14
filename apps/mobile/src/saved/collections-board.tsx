import { MascotAs } from '@/mascot/mascot';
import {
  CollectionCard,
  collectionCard,
  CollectionMenuSheet,
  CollectionNameSheet,
  CollectionShareSheet,
  DeleteCollectionSheet,
  EmptyState,
  NewCollectionCard,
  space,
  useListScroll,
  useUndoToast,
} from '@slovo/ui';
import { memo, useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { useCollectionShareSheet } from '@/saved/collection-sharing';
import { useDeleteUndoToast, useHandedDeleteUndo } from '@/saved/collection-undo';
import { useCollectionChanges, useCollectionRows } from '@/saved/collections';
import type { CollectionRowModel } from '@/saved/collections-screen';
import type { ListHeader } from '@/saved/list-header';
import { createMenuFollowUp } from '@/saved/menu-follow-up';
import { ListTopButton } from '@/shell/list-top';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;

/** What the name sheet names: a new Collection, or the one being renamed. */
type Naming = { readonly kind: 'new' } | { readonly kind: 'rename'; readonly id: string };

/** A cell of the grid: the dashed «Нова колекція» card first, then a Collection's card. */
type Cell =
  | { readonly kind: 'new' }
  | { readonly kind: 'collection'; readonly index: number; readonly row: CollectionRowModel };

/**
 * Collections in the board style (board 09, ADR 0132): two columns of cards,
 * the dashed «Нова колекція» first, then the Collections newest first in the
 * tones by position. A tap opens a Collection; a long press (or VoiceOver's
 * action) opens its menu: share while Collection Links are on, rename in the
 * name sheet (with a toast), delete after the delete sheet, with the undo
 * toast, also of a Collection deleted on its own screen. «Нова колекція»
 * opens the name sheet; the Collection it makes opens, empty, with a toast. No
 * Collections: the empty state, whose button opens the name sheet too. Needs
 * an `UndoToastProvider` above it.
 */
export function CollectionsBoard({ header }: { header: ListHeader }) {
  const rows = useCollectionRows();
  const scroll = useListScroll<FlatList<Cell>>();
  const { list: listRef, onScroll } = scroll;
  const { create, rename, remove } = useCollectionChanges();
  const { available: sharingAvailable, share, sheet: shareSheet } = useCollectionShareSheet();
  const showToast = useUndoToast();
  const showUndo = useDeleteUndoToast();
  useHandedDeleteUndo();
  const openScreen = useOpenScreen();
  const [naming, setNaming] = useState<Naming>();
  const [menu, setMenu] = useState<CollectionRowModel>();
  const [deleting, setDeleting] = useState<CollectionRowModel>();

  // Kept from render to render, so the cards re-render only when the list changes.
  const openCollection = useCallback(
    (id: string) => {
      openScreen(`/saved/collections/${id}`);
    },
    [openScreen],
  );
  const startNew = useCallback(() => {
    setNaming({ kind: 'new' });
  }, []);
  /** What the menu chose runs once the menu has slid away: two modals do not show together. */
  const [afterMenu] = useState(() =>
    createMenuFollowUp<CollectionRowModel>({
      rename: ({ id }) => {
        setNaming({ kind: 'rename', id });
      },
      remove: setDeleting,
      share: ({ id }) => {
        share(id);
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
  const choose = (chosen: (collection: CollectionRowModel) => void) => () => {
    if (menu !== undefined) chosen(menu);
    setMenu(undefined);
  };
  /** The Collection being renamed, while it is still there. */
  const renaming =
    naming?.kind === 'rename' ? rows.find((collection) => collection.id === naming.id) : undefined;

  /** Keeps the name; resolves to why it is refused, and the sheet then stays open. */
  const keepName = async (name: string): Promise<string | undefined> => {
    if (renaming !== undefined) {
      const refusal = await rename(renaming.id, name);
      if (refusal === undefined) {
        setNaming(undefined);
        showToast({ look: 'plate', message: collectionStrings.toasts.renamed });
      }
      return refusal;
    }
    const created = await create(name);
    if (!created.ok) return created.refusal;
    setNaming(undefined);
    openScreen(`/saved/collections/${created.collection.id}?created=1`);
    return undefined;
  };

  const cells: readonly Cell[] =
    rows.length === 0
      ? []
      : [
          { kind: 'new' },
          ...rows.map((row, index) => ({ kind: 'collection' as const, index, row })),
        ];

  return (
    <>
      <FlatList
        ref={listRef}
        onScroll={onScroll}
        testID="collections"
        data={cells}
        keyExtractor={(cell) => (cell.kind === 'new' ? 'new' : cell.row.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item, index }) => (
          <View style={[styles.cell, index % 2 === 0 ? styles.leftCell : styles.rightCell]}>
            {item.kind === 'new' ? (
              <NewCollectionCard testID="collections-add" label={strings.add} onPress={startNew} />
            ) : (
              <Card
                index={item.index}
                collection={item.row}
                onOpen={openCollection}
                onMenu={openMenu}
              />
            )}
          </View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header(null)}
        ListEmptyComponent={
          <EmptyState
            mascot={(width) => <MascotAs state="waits" width={width} />}
            testID="collections-empty"
            title={strings.empty.title}
            message={strings.empty.message}
            action={{
              label: strings.empty.create,
              testID: 'collections-empty-create',
              onPress: startNew,
            }}
          />
        }
        contentContainerStyle={styles.content}
      />
      <ListTopButton scroll={scroll} overTabBar />
      <CollectionMenuSheet
        testID="collections-menu"
        visible={menu !== undefined}
        title={menu?.name ?? ''}
        copy={strings.menu}
        share={
          sharingAvailable
            ? {
                label: collectionStrings.link.share,
                disabled: menu?.empty ?? true,
                disabledHint: collectionStrings.entries.empty.title,
                onPress: choose(afterMenu.chooseShare),
              }
            : undefined
        }
        onRename={choose(afterMenu.chooseRename)}
        onDelete={choose(afterMenu.chooseDelete)}
        onCancel={() => {
          setMenu(undefined);
        }}
        onDismissed={afterMenu.dismissed}
      />
      <CollectionNameSheet
        testID="collections-name"
        visible={naming?.kind === 'new' || renaming !== undefined}
        kind={renaming === undefined ? 'new' : 'rename'}
        initialName={renaming?.name}
        onSubmit={keepName}
        onClose={() => {
          setNaming(undefined);
        }}
      />
      <DeleteCollectionSheet
        testID="collections-delete"
        name={deleting?.name}
        copy={strings.confirmDelete}
        onDelete={() => {
          if (deleting !== undefined) {
            void remove(deleting.id).then((deleted) => {
              if (deleted !== undefined) showUndo(deleted);
            });
          }
          setDeleting(undefined);
        }}
        onCancel={() => {
          setDeleting(undefined);
        }}
      />
      <CollectionShareSheet testID="collections-share-sheet" {...shareSheet} />
    </>
  );
}

/** A Collection's card: a tap opens it, a long press its menu, which VoiceOver also offers. */
const Card = memo(function Card({
  index,
  collection,
  onOpen,
  onMenu,
}: {
  /** The card's place among the Collections, which picks its tone and its mark. */
  index: number;
  collection: CollectionRowModel;
  onOpen: (id: string) => void;
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
  row: { marginHorizontal: space[5] },
  // Each card takes half the row, so a last card alone keeps its width.
  cell: { width: '50%', flexDirection: 'row' },
  leftCell: { paddingRight: collectionCard.gap / 2 },
  rightCell: { paddingLeft: collectionCard.gap / 2 },
  separator: { height: collectionCard.gap },
});
