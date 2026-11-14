import { MascotAs } from '@/mascot/mascot';
import { fill } from '@slovo/contracts';
import type { Collection, CollectionEntry } from '@slovo/core';
import {
  CollectionHeader,
  CollectionMenuSheet,
  CollectionNameSheet,
  CollectionShareButton,
  CollectionWordRow,
  CollectionShareSheet,
  DeleteCollectionSheet,
  EmptyState,
  space,
  UndoToastProvider,
  useEdition,
  useListScroll,
  useTokens,
  useUndoToast,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useCollectionChanges, useCollectionEntries } from '@/saved/collections';
import { useCollectionShareSheet } from '@/saved/collection-sharing';
import { handDeleteUndo } from '@/saved/collection-undo';
import { createMenuFollowUp } from '@/saved/menu-follow-up';
import { ListTopButton } from '@/shell/list-top';
import { useOpenScreen } from '@/use-open-screen';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;
const { toasts } = collectionStrings;

/**
 * A Collection in the board style (board 09, ADR 0132): the back tile and
 * «⋯» over the Collection's name and «N слів», its Entries newest first as
 * rows with a chevron, and «Поділитися посиланням» at the foot while
 * Collection Links are on and the Collection holds an Entry. «⋯» opens the
 * Collection menu (share in the share sheet, rename in the name sheet,
 * delete after the delete sheet, which goes back to Collections, where the
 * toast offers the undo); a rename says so in a toast, and so does the Collection just
 * made (`created`). A tap on a row opens the Entry screen; a swipe takes the
 * Entry out of this Collection only. An empty Collection says so.
 */
export function CollectionBoardScreen({
  collectionId,
  created,
}: {
  collectionId: string;
  /** The Collection was just made: the screen says so in a toast. */
  created: boolean;
}) {
  return (
    <UndoToastProvider>
      <Board collectionId={collectionId} created={created} />
    </UndoToastProvider>
  );
}

function Board({ collectionId, created }: { collectionId: string; created: boolean }) {
  const { collection, entries, remove: removeEntry } = useCollectionEntries(collectionId);
  const { rename, remove } = useCollectionChanges();
  const { available: sharingAvailable, share, sheet: shareSheet } = useCollectionShareSheet();
  const { colors } = useTokens();
  const { count } = useEdition();
  const showToast = useUndoToast();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** What the menu chose runs once the menu has slid away: two modals do not show together. */
  const [afterMenu] = useState(() =>
    createMenuFollowUp<Collection>({
      rename: () => {
        setRenaming(true);
      },
      remove: () => {
        setDeleting(true);
      },
      share: ({ id }) => {
        share(id);
      },
    }),
  );
  /** Whether the toast of the Collection just made is still to show. */
  const toAnnounce = useRef(created);
  useEffect(() => {
    if (!toAnnounce.current || collection === undefined) return;
    toAnnounce.current = false;
    showToast({ look: 'plate', message: fill(toasts.created, { name: collection.name }) });
  }, [collection, showToast]);

  const name = collection?.name ?? '';
  const shown = collection === undefined ? [] : entries;
  const scroll = useListScroll<FlatList<CollectionEntry>>();
  const { list: listRef, onScroll } = scroll;
  const leave = () => {
    if (router.canDismiss()) router.back();
    else router.replace('/saved/collections');
  };
  const choose = (chosen: (collection: Collection) => void) => () => {
    if (collection !== undefined) chosen(collection);
    setMenuOpen(false);
  };

  return (
    <SafeAreaView
      testID="collection"
      edges={['top', 'bottom']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList
        ref={listRef}
        onScroll={onScroll}
        data={shown}
        keyExtractor={(entry) => entry.entryId}
        renderItem={({ item }) => (
          <CollectionWordRow
            entry={item}
            collectionName={name}
            onPress={() => {
              openScreen(`/saved/collections/${collectionId}/${item.entryId}`);
            }}
            onRemove={() => {
              removeEntry(item.entryId);
            }}
          />
        )}
        ListHeaderComponent={
          <CollectionHeader
            name={name}
            count={count(strings.wordCount, shown.length)}
            back={{ testID: 'collection-back', label: collectionStrings.title, onPress: leave }}
            menu={
              collection === undefined
                ? undefined
                : {
                    testID: 'collection-menu-button',
                    label: fill(strings.moreLabel, { name }),
                    open: menuOpen,
                    onPress: () => {
                      afterMenu.opened();
                      setMenuOpen(true);
                    },
                  }
            }
          />
        }
        ListEmptyComponent={
          collection === undefined ? undefined : (
            <EmptyState
              mascot={(width) => <MascotAs state="waits" width={width} />}
              testID="collection-empty"
              title={collectionStrings.entries.empty.title}
              message={collectionStrings.entries.empty.message}
            />
          )
        }
        contentContainerStyle={styles.content}
      />
      <ListTopButton scroll={scroll} />
      {sharingAvailable && shown.length > 0 && collection !== undefined && (
        <CollectionShareButton
          testID="collection-share"
          label={collectionStrings.link.share}
          onPress={() => {
            share(collection.id);
          }}
        />
      )}
      <CollectionMenuSheet
        testID="collection-menu"
        visible={menuOpen}
        title={name}
        copy={strings.menu}
        share={
          sharingAvailable
            ? {
                label: collectionStrings.link.share,
                disabled: shown.length === 0,
                disabledHint: collectionStrings.entries.empty.title,
                onPress: choose(afterMenu.chooseShare),
              }
            : undefined
        }
        onRename={choose(afterMenu.chooseRename)}
        onDelete={choose(afterMenu.chooseDelete)}
        onCancel={() => {
          setMenuOpen(false);
        }}
        onDismissed={afterMenu.dismissed}
      />
      <CollectionNameSheet
        testID="collection-rename"
        visible={renaming && collection !== undefined}
        kind="rename"
        initialName={name}
        onSubmit={async (renamed) => {
          const refusal = await rename(collectionId, renamed);
          if (refusal === undefined) {
            setRenaming(false);
            showToast({ look: 'plate', message: toasts.renamed });
          }
          return refusal;
        }}
        onClose={() => {
          setRenaming(false);
        }}
      />
      <DeleteCollectionSheet
        testID="collection-delete"
        name={deleting ? name : undefined}
        copy={strings.confirmDelete}
        onDelete={() => {
          setDeleting(false);
          void remove(collectionId).then((deleted) => {
            if (deleted !== undefined) handDeleteUndo(deleted);
          });
          leave();
        }}
        onCancel={() => {
          setDeleting(false);
        }}
      />
      <CollectionShareSheet testID="collection-share-sheet" {...shareSheet} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: space[8] },
});
