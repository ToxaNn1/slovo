import {
  buildShareCardContent,
  isTodaysWordOfTheDay,
  type AnyEntryCard,
  type Composition,
} from '@slovo/core';
import {
  ActionRow,
  CollectionButton,
  CollectionSheet,
  CommunityCountersLine,
  FavoriteButton,
  HideButton,
  HideChoiceSheet,
  KnowledgeButtons,
  MistakeReportButton,
  MistakeReportSheet,
  ShareButton,
  ShareSheet,
  useUndoToast,
} from '@slovo/ui';
import { useCallback, useState, type ReactNode } from 'react';

import { refusalText } from '../saved/collection-refusal';
import { deviceClock } from '../device/device-clock';
import { edition, editionStrings } from '../edition/edition';
import { useEntryCollections } from '../saved/collections';
import { useCompositionRead } from '../composition';
import { useCounterLine } from '../community-counters/counter-line';
import { useFavorite } from '../saved/favorites';
import { useKnowledgeMark } from '../knowledge/marks';
import { useHide } from '../mix/hiding';
import { logError } from '../diagnostics/log';
import { sessionShareFormat } from '../share/share-card';
import { useShell, type ShareCard } from '../shell-value';
import { useShown } from '../shown-in-effect';

/**
 * The action row of an Entry card of any kind, wherever the card appears: the
 * Feed (its Word of the Day too) and the Entry screen a list opens. Each action
 * fills its own slot. The «Знаю» and «Не знаю» buttons are there only when the
 * Knowledge switch is on in effect, and inactive while Self-check conceals the
 * card's meaning (the card tells them); the «Повідомити про помилку» flag only
 * while Mistake Reports are on in effect. Its screen gives it an
 * `UndoToastProvider` for the toasts after a hide and a Mistake Report.
 */
export function EntryActions({ card }: { card: AnyEntryCard }) {
  const { entryId } = card;
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const collection = useCollectionAction(entryId);
  const share = useShareAction(card);
  const marks = useKnowledgeButtons(card);
  const report = useMistakeReportAction(entryId);
  return (
    <>
      <ActionRow
        marks={marks}
        favorite={<FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />}
        share={share.button}
        collection={collection.button}
        hide={<HideButton onPress={hide.open} />}
        report={report.button}
      />
      <HideChoiceSheet {...hide.choice} />
      {collection.sheet}
      {share.sheet}
      {report.sheet}
    </>
  );
}

/**
 * The «Знаю» and «Не знаю» buttons of an Entry's card, wherever the card
 * appears, Yesterday's too, with the Community Counters line under them
 * (ADR 0060): there only when the Knowledge switch is on in effect.
 */
export function useKnowledgeButtons(card: Pick<AnyEntryCard, 'entryId' | 'kind'>): ReactNode {
  const shown = useShown().entryButtons.knowledge;
  const knowledge = useKnowledgeMark(card.entryId);
  const line = useCounterLine(card.entryId, shown);
  return shown ? (
    <>
      <KnowledgeButtons entryKind={card.kind} mark={knowledge.mark} onTap={knowledge.tap} />
      <CommunityCountersLine line={line} />
    </>
  ) : undefined;
}

/**
 * The share button of an Entry's action row, and the share sheet it opens:
 * there only when the binary can capture the Share Card and the Share Cards
 * switch is on in effect.
 */
function useShareAction(card: AnyEntryCard): { button: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const { shareCard } = useShell();
  const share = useShown().entryButtons.shareCard ? shareCard : undefined;
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
  share: ShareCard;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <ShareSheet
      visible={visible}
      content={buildShareCardContent(
        {
          card,
          todaysWordOfTheDay: card.kind === 'word' && isTodaysWordOfTheDay(card, deviceClock),
        },
        editionStrings,
        edition.locale,
      )}
      watermark={edition.displayName}
      initialFormat={sessionShareFormat.format}
      onFormatChange={(format) => {
        sessionShareFormat.choose(format);
      }}
      onShare={(view, format) => share(view, card.entryId, format)}
      onClose={onClose}
    />
  );
}

/**
 * The «Повідомити про помилку» flag of an Entry's action row, and the sheet
 * it opens: there only while Mistake Reports are on in effect (ADR 0056).
 * «Надіслати» closes the sheet, thanks the reader at once («Дякуємо! Ми
 * перевіримо.», offline too) and hands the report to the Core's queue, which
 * sends it now or later; if the Core then says the daily limit is spent, or
 * keeps no report, a toast in its place says so.
 */
function useMistakeReportAction(entryId: string): { button: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const showToast = useUndoToast();
  const { mistakeReports } = useShell();
  const shown = useShown().entryButtons.mistakeReport;
  if (!shown) return { button: undefined, sheet: undefined };
  const close = () => {
    setOpen(false);
  };
  return {
    button: (
      <MistakeReportButton
        onPress={() => {
          setOpen(true);
        }}
      />
    ),
    sheet: (
      <MistakeReportSheet
        visible={open}
        onClose={close}
        onSend={({ type, comment }) => {
          const toasts = editionStrings.mistakeReport;
          close();
          showToast({ message: toasts.sent });
          mistakeReports
            .opened()
            .then((reports) => reports.report({ entryId, type, comment }))
            .then((answer) => {
              if (answer === 'too-many-requests') showToast({ message: toasts.tooMany });
              else if (answer !== 'thanked') showToast({ message: toasts.failed });
            })
            .catch((error: unknown) => {
              logError('Could not report the mistake', error);
              showToast({ message: toasts.failed });
            });
        }}
      />
    ),
  };
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
