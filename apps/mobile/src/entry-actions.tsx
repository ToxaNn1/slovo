import {
  entryIdOf,
  isTodaysWordOfTheDay,
  type Composition,
  type EntryFeedCard,
  type WordFeedCard,
} from '@slovo/core';
import {
  ActionRow,
  CollectionButton,
  CollectionSheet,
  FavoriteButton,
  HideButton,
  ShareButton,
  ShareSheet,
} from '@slovo/ui';
import { useCallback, useState } from 'react';

import { refusalText } from './collection-refusal';
import { deviceClock } from './device-clock';
import { shareCardOnDevice } from './device-share';
import { edition, editionStrings } from './edition';
import { useEntryCollections } from './collections';
import { useOpenedRead } from './composition';
import { useFavorite } from './favorites';
import { useHide } from './hiding';

/**
 * The action row of an Entry card, wherever the card appears: the Feed and
 * the Entry screen a list opens. Each action fills its own slot. Share is on a
 * Word's card only, and only when the binary can capture the Share Card. Its
 * screen gives it an `UndoToastProvider` for the toast after a hide.
 */
export function EntryActions({ card }: { card: EntryFeedCard }) {
  const entryId = entryIdOf(card);
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const share = card.kind === 'word' ? shareCardOnDevice : undefined;
  return (
    <>
      <ActionRow
        favorite={<FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />}
        share={
          share !== undefined ? (
            <ShareButton
              onPress={() => {
                setShareOpen(true);
              }}
            />
          ) : undefined
        }
        collection={
          <CollectionButton
            onPress={() => {
              setSheetOpen(true);
            }}
          />
        }
        hide={<HideButton onPress={hide} />}
      />
      <EntryCollectionSheet
        entryId={entryId}
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
        }}
      />
      {card.kind === 'word' && share !== undefined && (
        <EntryShareSheet
          card={card}
          share={share}
          visible={shareOpen}
          onClose={() => {
            setShareOpen(false);
          }}
        />
      )}
    </>
  );
}

/** The share sheet of a Word's card, over the Story Share Card. Sharing writes no user state. */
function EntryShareSheet({
  card,
  share,
  visible,
  onClose,
}: {
  card: WordFeedCard;
  share: NonNullable<typeof shareCardOnDevice>;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <ShareSheet
      visible={visible}
      card={card.wordCard}
      wordOfTheDay={isTodaysWordOfTheDay(card, deviceClock)}
      watermark={edition.displayName}
      onShare={(view) => share(view, card.wordCard.wordId)}
      onClose={onClose}
    />
  );
}

/** The «До колекції» sheet of one Entry, over the Core's Collections. */
function EntryCollectionSheet({
  entryId,
  visible,
  onClose,
}: {
  entryId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const filing = useEntryCollections(entryId);
  const title = useEntryTitle(entryId, visible);
  return (
    <CollectionSheet
      visible={visible}
      entryTitle={title}
      collections={filing.collections}
      isFiled={filing.isFiled}
      onToggle={filing.setFiled}
      onClose={onClose}
      onCreate={async (name) => {
        const result = await filing.create(name);
        return result.ok
          ? undefined
          : refusalText(editionStrings.collections.sheet.refusal, result.reason);
      }}
    />
  );
}

/** What the Entry's row leads with, once it is known; read when `enabled`. */
function useEntryTitle(entryId: string, enabled: boolean): string {
  const read = useCallback((composition: Composition) => composition.entryRow(entryId), [entryId]);
  return useOpenedRead(read, 'Could not read the Entry', enabled)?.title ?? '';
}
