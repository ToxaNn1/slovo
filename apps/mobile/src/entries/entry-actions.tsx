import { isTodaysWordOfTheDay, type AnyEntryCard, type Composition } from '@slovo/core';
import {
  ActionRow,
  CollectionButton,
  CollectionSheet,
  FavoriteButton,
  HideButton,
  HideChoiceSheet,
  KnowledgeButtons,
  ShareButton,
  ShareSheet,
} from '@slovo/ui';
import { useCallback, useState, type ReactNode } from 'react';

import { refusalText } from '../saved/collection-refusal';
import { deviceClock } from '../device/device-clock';
import { shareCardOnDevice } from '../share/device-share';
import { edition, editionStrings } from '../edition/edition';
import { useEntryCollections } from '../saved/collections';
import { useCompositionRead } from '../composition';
import { useFavorite } from '../saved/favorites';
import { useKnowledgeMark } from '../knowledge/marks';
import { useHide } from '../mix/hiding';
import { createShareFormatMemory } from '../share/share-card';
import { useShown } from '../shown-in-effect';

/** The Share Card format of this session: every share sheet opens in the one chosen last. */
const shareFormat = createShareFormatMemory();

/**
 * The action row of an Entry card of any kind, wherever the card appears: the
 * Feed (its Word of the Day too) and the Entry screen a list opens. Each action
 * fills its own slot. The «Знаю» and «Не знаю» buttons are there only when the
 * Knowledge switch is on in effect, and inactive while Self-check conceals the
 * card's meaning (the card tells them). Its screen gives it an
 * `UndoToastProvider` for the toast after a hide.
 */
export function EntryActions({ card }: { card: AnyEntryCard }) {
  const { entryId } = card;
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const collection = useCollectionAction(entryId);
  const share = useShareAction(card);
  const buttons = useShown().entryButtons;
  const knowledge = useKnowledgeMark(entryId);
  return (
    <>
      <ActionRow
        marks={
          buttons.knowledge ? (
            <KnowledgeButtons entryKind={card.kind} mark={knowledge.mark} onTap={knowledge.tap} />
          ) : undefined
        }
        favorite={<FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />}
        share={share.button}
        collection={collection.button}
        hide={<HideButton onPress={hide.open} />}
      />
      <HideChoiceSheet {...hide.choice} />
      {collection.sheet}
      {share.sheet}
    </>
  );
}

/**
 * The share button of an Entry's action row, and the share sheet it opens:
 * there only when the binary can capture the Share Card and the Share Cards
 * switch is on in effect.
 */
function useShareAction(card: AnyEntryCard): { button: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const share = useShown().entryButtons.shareCard ? shareCardOnDevice : undefined;
  if (share === undefined) return { button: undefined, sheet: undefined };
  return {
    button: (
      <ShareButton
        onPress={() => {
          setOpen(true);
        }}
      />
    ),
    sheet: (
      <EntryShareSheet
        card={card}
        share={share}
        visible={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    ),
  };
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
  card: AnyEntryCard;
  share: NonNullable<typeof shareCardOnDevice>;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <ShareSheet
      visible={visible}
      card={card}
      todaysWordOfTheDay={card.kind === 'word' && isTodaysWordOfTheDay(card, deviceClock)}
      watermark={edition.displayName}
      initialFormat={shareFormat.format}
      onFormatChange={(format) => {
        shareFormat.choose(format);
      }}
      onShare={(view, format) => share(view, card.entryId, format)}
      onClose={onClose}
    />
  );
}

/** The «До колекції» button of an Entry's action row, and the sheet it opens. */
function useCollectionAction(entryId: string): { button: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  return {
    button: (
      <CollectionButton
        onPress={() => {
          setOpen(true);
        }}
      />
    ),
    sheet: (
      <EntryCollectionSheet
        entryId={entryId}
        visible={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    ),
  };
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
