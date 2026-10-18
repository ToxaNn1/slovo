import { entryIdOf, isTodaysWordOfTheDay, type Composition, type EntryFeedCard } from '@slovo/core';
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

import { refusalText } from '../saved/collection-refusal';
import { deviceClock } from '../device/device-clock';
import { shareCardOnDevice } from '../share/device-share';
import { edition, editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { entryButtonsOf } from './entry-buttons';
import { useEntryCollections } from '../saved/collections';
import { useCompositionRead } from '../composition';
import { useFavorite } from '../saved/favorites';
import { useHide } from '../mix/hiding';
import { createShareFormatMemory } from '../share/share-card';

/** The Share Card format of this session: every share sheet opens in the one chosen last. */
const shareFormat = createShareFormatMemory();

/**
 * The action row of an Entry card, wherever the card appears: the Feed and the
 * Entry screen a list opens. Each action fills its own slot. Share is there
 * only when the binary can capture the Share Card and the Share Cards switch
 * is on in effect. Its screen gives it an
 * `UndoToastProvider` for the toast after a hide.
 */
export function EntryActions({ card }: { card: EntryFeedCard }) {
  const entryId = entryIdOf(card);
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const share = entryButtonsOf(useEditionInEffect()).shareCard ? shareCardOnDevice : undefined;
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
      {share !== undefined && (
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

/**
 * The share sheet of an Entry's card, over its Share Card, in the format
 * chosen last this session. Sharing writes no user state.
 */
function EntryShareSheet({
  card,
  share,
  visible,
  onClose,
}: {
  card: EntryFeedCard;
  share: NonNullable<typeof shareCardOnDevice>;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <ShareSheet
      visible={visible}
      card={card.kind === 'word' ? card.wordCard : card.correctionCard}
      wordOfTheDay={card.kind === 'word' && isTodaysWordOfTheDay(card, deviceClock)}
      watermark={edition.displayName}
      initialFormat={shareFormat.format}
      onFormatChange={(format) => {
        shareFormat.choose(format);
      }}
      onShare={(view, format) => share(view, entryIdOf(card), format)}
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
  return useCompositionRead(read, 'Could not read the Entry', enabled)?.title ?? '';
}
