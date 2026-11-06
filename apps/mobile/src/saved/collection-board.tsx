import { fill } from '@slovo/contracts';
import type { Collection } from '@slovo/core';
import {
  categoryTile,
  CollectionMenuSheet,
  CollectionNameField,
  DeleteCollectionDialog,
  railScreen,
  RailScreenCard,
  RailScreenHero,
  UndoToastProvider,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useComposition } from '@/composition';
import { editionStrings } from '@/edition/edition';
import { useSubscribed } from '@/opening';
import { useCollectionChanges, useCollectionEntries } from '@/saved/collections';
import { useCollectionSharing } from '@/saved/collection-sharing';
import { createMenuFollowUp } from '@/saved/menu-follow-up';
import { useOpenScreen } from '@/use-open-screen';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.screen;
const { known: knownText } = editionStrings.dashboard.category;
const [glyph] = categoryTile.shapes[0];

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
  const { knowledge } = useComposition();
  // Read again on every Knowledge Mark, so «ЗНАЮ» and the stamps follow at once.
  useSubscribed(knowledge, (open) => open.state);
  const { colors } = useTokens();
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
  const total = entries.length;
  const known = knowledge.knownAmong(entries.map(({ entryId }) => entryId));
  const leave = () => {
    if (router.canDismiss()) router.back();
    else router.replace('/saved/collections');
  };
  const choose = (chosen: (collection: Collection) => void) => () => {
    if (collection !== undefined) chosen(collection);
    setMenuOpen(false);
  };

  return (
    <View testID="collection" style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={collection === undefined ? [] : entries}
        keyExtractor={({ entryId }) => entryId}
        renderItem={({ item: { entryId, row }, index }) => (
          // DESIGN-05: not on the board, owner decides — the swipe (and its VoiceOver action) that takes the Entry out of this Collection:
          // onRemove={() => { remove(entryId); }}
          // DESIGN-05: not on the board, owner decides — the kind and the date added, «слово · 3 лист.»:
          // added={addedOn(addedAt)}
          <RailScreenCard
            testID={`collection-entry-${entryId}`}
            row={row}
            known={knowledge.knownAmong([entryId]) === 1}
            index={index}
            onPress={() => {
              openScreen(`/saved/collections/${collectionId}/${entryId}`);
            }}
          />
        )}
        ListHeaderComponent={
          <>
            <RailScreenHero
              id="collection-hero"
              glyph={glyph}
              kicker={fill(strings.kicker, { count: count(strings.wordCount, total) })}
              title={name}
              progress={fill(knownText, { x: String(known), n: String(total) })}
              done={total === 0 ? 0 : known / total}
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
        // DESIGN-05: not on the board, owner decides — the footer «Найновіші — першими. Тап відкриває повну картку.»:
        // ListFooterComponent={entries.length > 0 ? <Text>{collectionStrings.entries.footer}</Text> : null}
        ListHeaderComponentStyle={styles.hero}
        ItemSeparatorComponent={Gap}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
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
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { marginHorizontal: -railScreen.list.side, marginBottom: railScreen.list.top },
  content: { paddingHorizontal: railScreen.list.side, paddingBottom: railScreen.list.bottom },
  field: { marginBottom: railScreen.list.top },
  gap: { height: railScreen.list.wordGap },
});
