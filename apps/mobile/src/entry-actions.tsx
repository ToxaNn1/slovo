import {
  ActionRow,
  CollectionButton,
  CollectionSheet,
  FavoriteButton,
  HideButton,
} from '@slovo/ui';
import { useEffect, useState } from 'react';

import { refusalText } from './collection-refusal';
import { editionStrings } from './edition';
import { useEntryCollections } from './collections';
import { useComposition } from './composition';
import { useFavorite } from './favorites';
import { useHideEntry } from './hiding';

/**
 * The action row of an Entry card, wherever the card appears: the Feed and
 * the Entry screen a list opens. Each 0.3 action fills its own slot. Its
 * screen gives it an `UndoToastProvider` for the toast after a hide.
 */
export function EntryActions({ entryId }: { entryId: string }) {
  const favorite = useFavorite(entryId);
  const hide = useHideEntry(entryId);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <ActionRow
        favorite={<FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />}
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
    </>
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
  const composition = useComposition();
  const [title, setTitle] = useState('');
  const open = composition.status === 'ready' ? composition.composition : undefined;
  useEffect(() => {
    if (!enabled || open === undefined) return;
    let active = true;
    open.entryRow(entryId).then(
      (row) => {
        if (active) setTitle(row?.title ?? '');
      },
      (error: unknown) => {
        console.error('Could not read the Entry', error);
      },
    );
    return () => {
      active = false;
    };
  }, [open, entryId, enabled]);
  return title;
}
