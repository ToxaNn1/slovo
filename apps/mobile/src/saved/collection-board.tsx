import { fill } from '@slovo/contracts';
import type { Collection } from '@slovo/core';
import {
  categoryTile,
  CollectionMenuSheet,
  CollectionNameField,
  DeleteCollectionDialog,
  knownShare,
  RailBoard,
  railScreen,
  RailScreenHero,
  shapeAt,
  UndoToastProvider,
  useEdition,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useKnownCards } from '@/knowledge/marks';
import { useCollectionChanges, useCollectionEntries } from '@/saved/collections';
import { useCollectionSharing } from '@/saved/collection-sharing';
import { createMenuFollowUp } from '@/saved/menu-follow-up';
import { useOpenScreen } from '@/use-open-screen';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;
const { known: knownText } = editionStrings.dashboard.category;
const [glyph] = shapeAt(categoryTile.shapes, 0);

/**
 * A Collection in the board style (board 05.1, ADR 0082): the red hero with
 * «КОЛЕКЦІЯ · N слів», the Collection's name, «ЗНАЮ x З n» of its Entries and
 * the Collection menu (rename, share, delete) in its right slot; its Entries
 * newest first as cards under it, a Word with its rarity bars. An empty
 * Collection shows the hero alone. A tap on a card opens the Entry screen,
 * where the Entry's Collections sheet takes it out of this one.
 */
export function CollectionBoardScreen({ collectionId }: { collectionId: string }) {
  return (
    <UndoToastProvider>
      <Board collectionId={collectionId} />
    </UndoToastProvider>
  );
}

function Board({ collectionId }: { collectionId: string }) {
  const { collection, entries } = useCollectionEntries(collectionId);
  const { rename, remove } = useCollectionChanges();
  const { available: sharingAvailable, share } = useCollectionSharing();
  const { count } = useEdition();
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

  const name = collection?.name ?? '';
  const cards = useKnownCards(collection === undefined ? undefined : entries) ?? [];
  // DESIGN-05: not on the board, owner decides — the swipe (and its VoiceOver action) that takes
  // the Entry out of this Collection, and the kind and the date added, «слово · 3 лист.». A card
  // would carry both, with `const { collection, entries, remove: removeEntry } =
  // useCollectionEntries(collectionId)` above, `import { addedOn } from '@/saved/added-on'`, and
  // RailBoard passing `added` and `onRemove` on to RailScreenCard, which gains the two props:
  // entries.map(({ entryId, row, addedAt }) => ({
  //   entryId, row, known: knowledge.isKnown(entryId),
  //   added: addedOn(addedAt), onRemove: () => { removeEntry(entryId); },
  // }))
  const { known, total, done } = knownShare(cards);
  const leave = () => {
    if (router.canDismiss()) router.back();
    else router.replace('/saved/collections');
  };
  const choose = (chosen: (collection: Collection) => void) => () => {
    if (collection !== undefined) chosen(collection);
    setMenuOpen(false);
  };

  return (
    <>
      <RailBoard
        testID="collection"
        cards={cards}
        onOpen={(entryId) => {
          openScreen(`/saved/collections/${collectionId}/${entryId}`);
        }}
        // DESIGN-05: not on the board, owner decides — the footer «Найновіші — першими. Тап
        // відкриває повну картку.», which RailBoard would take as a `footer` for its list:
        // footer={cards.length > 0 ? <Text>{collectionStrings.entries.footer}</Text> : null}
        hero={
          <>
            <RailScreenHero
              id="collection-hero"
              glyph={glyph}
              kicker={fill(strings.kicker, { count: count(strings.wordCount, total) })}
              title={name}
              progress={fill(knownText, { x: String(known), n: String(total) })}
              done={done}
              mascot="waits"
              back={{
                testID: 'collection-back',
                label: collectionStrings.title,
                onPress: leave,
              }}
              {...(collection !== undefined && {
                action: {
                  kind: 'menu',
                  testID: 'collection-menu-button',
                  label: fill(strings.moreLabel, { name }),
                  onPress: () => {
                    afterMenu.opened();
                    setMenuOpen(true);
                  },
                },
              })}
            />
            {renaming && collection !== undefined && (
              <View style={styles.field}>
                <CollectionNameField
                  testID="collection-rename"
                  overline={strings.renameOverline}
                  placeholder={collectionStrings.sheet.namePlaceholder}
                  initialName={name}
                  onSubmit={async (renamed) => {
                    const refusal = await rename(collectionId, renamed);
                    if (refusal === undefined) setRenaming(false);
                    return refusal;
                  }}
                  onCancel={() => {
                    setRenaming(false);
                  }}
                />
              </View>
            )}
          </>
        }
      />
      <CollectionMenuSheet
        testID="collection-menu"
        visible={menuOpen}
        copy={strings.menu}
        share={
          sharingAvailable
            ? {
                label: collectionStrings.link.share,
                disabled: total === 0,
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
      <DeleteCollectionDialog
        testID="collection-delete"
        name={deleting ? name : undefined}
        copy={strings.confirmDelete}
        onDelete={() => {
          setDeleting(false);
          remove(collectionId);
          leave();
        }}
        onCancel={() => {
          setDeleting(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: railScreen.list.top },
});
