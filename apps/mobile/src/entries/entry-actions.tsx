import { buildShareCardContent, type AnyEntryCard, type Composition } from '@slovo/core';
import {
  ActionRow,
  CollectionButton,
  CollectionSheet,
  CommunityCountersLine,
  CornerActions,
  EntryMenuSheet,
  FavoriteButton,
  HideButton,
  HideChoiceSheet,
  KnowledgeButtons,
  MistakeReportButton,
  MistakeReportSheet,
  ShareButton,
  ShareSheet,
  type EntryCardSlots,
  type EntrySwipe,
  type YesterdaySlots,
  useEdition,
  useUndoToast,
} from '@slovo/ui';
import { useCallback, useState, type ReactNode } from 'react';

import { refusalText } from '../saved/collection-refusal';
import { deviceClock } from '../device/device-clock';
import { edition, editionStrings } from '../edition/edition';
import { useEntryCollections } from '../saved/collections';
import { keptHint } from '../saved/kept-hint';
import { useComposition, useCompositionRead } from '../composition';
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
 * Feed (its Word of the Day too) and Entry details, the screen a list opens.
 * Each action fills its own slot: raised tiles with labels under a Word, with
 * the line that says where the Entry is kept under them, and bare icons
 * under the other kinds (XActions). The «Знаю» and «Не знаю» buttons are there only when the
 * Knowledge switch is on in effect, and inactive while Self-check conceals the
 * card's meaning (the card tells them); the «Повідомити про помилку» flag only
 * while Mistake Reports are on in effect, disabled while the meaning is concealed.
 * The «Знаю» and «Не знаю» buttons go above the actions in the Feed and below
 * them on Entry details (`place`). Its screen gives it an
 * `UndoToastProvider` for the toasts after a hide and a Mistake Report.
 */
export function EntryActions({
  card,
  place = 'feed',
}: {
  card: AnyEntryCard;
  place?: 'feed' | 'details';
}) {
  const { entryId } = card;
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const collection = useCollectionAction(entryId);
  const share = useShareAction(card);
  const marks = useKnowledgeButtons(card);
  const report = useMistakeReportAction(entryId);
  const { count } = useEdition();
  return (
    <>
      <ActionRow
        look={card.kind === 'word' ? 'tiles' : 'icons'}
        marks={marks}
        marksAt={place === 'details' ? 'below' : 'above'}
        hint={keptHint({
          collectionNames: collection.filedNames,
          inFavorites: favorite.inFavorites,
          strings: editionStrings,
          count,
        })}
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
 * The slots of an Entry card, wherever the card appears: its action row
 * (`EntryActions`) while the Swipe Marks switch is off in effect, and its
 * corner (`EntryCorner`) with no action row while it is on (ADR 0077), the
 * Community Counters line and the line that says where the Entry is kept
 * gone with the row, and its side swipes with the corner.
 */
export function useEntrySlots(
  card: AnyEntryCard,
  place: 'feed' | 'details' = 'feed',
): EntryCardSlots {
  const swipe = useEntrySwipe(card.entryId);
  return useShown().swipeMarks
    ? { slot: 'corner', corner: <EntryCorner card={card} />, swipe }
    : { slot: 'actions', actions: <EntryActions card={card} place={place} /> };
}

/**
 * The «Знаю» and «Не знаю» buttons of Yesterday's Word, or while marks are
 * swiped its corner: the «⋯» button alone, whose sheet has the mark items.
 */
export function useYesterdaySlots(wordId: string): YesterdaySlots | undefined {
  const marks = useKnowledgeButtons({ kind: 'word', entryId: wordId });
  if (useShown().swipeMarks)
    return { slot: 'corner', corner: <MenuCorner entryId={wordId} entryKind="word" /> };
  return marks === undefined ? undefined : { slot: 'marks', marks };
}

/**
 * The corner of an Entry card while marks are swiped (XSwipe): the heart, the
 * «До колекції» bookmark and the «⋯» button, whose sheet also shares, hides
 * and reports the Entry as the action row did, each while it is on.
 */
function EntryCorner({ card }: { card: AnyEntryCard }) {
  const { entryId } = card;
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const collection = useCollectionAction(entryId);
  const share = useShareAction(card);
  const report = useMistakeReportAction(entryId);
  return (
    <>
      <MenuCorner
        entryId={entryId}
        entryKind={card.kind}
        favorite={<FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />}
        collection={collection.button}
        onShare={share.open}
        onHide={hide.open}
        onReport={report.open}
      />
      <HideChoiceSheet {...hide.choice} />
      {collection.sheet}
      {share.sheet}
      {report.sheet}
    </>
  );
}

/**
 * The corner's buttons and the «⋯» sheet they open. The sheet's mark items
 * set or clear the Knowledge Mark, only while the Knowledge switch is on in
 * effect, and say so in a 2.2 s toast with no undo. «Поділитися», «Сховати»
 * and «Повідомити про помилку» open their own sheet once the «⋯» sheet has
 * slid away, as one modal at a time is presented.
 */
function MenuCorner({
  entryId,
  entryKind,
  favorite,
  collection,
  onShare,
  onHide,
  onReport,
}: {
  entryId: string;
  entryKind: AnyEntryCard['kind'];
  favorite?: ReactNode;
  collection?: ReactNode;
  onShare?: (() => void) | undefined;
  onHide?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [followUp, setFollowUp] = useState<{ open: () => void }>();
  const knowledge = useKnowledgeMark(entryId);
  const marksShown = useShown().entryButtons.knowledge;
  const showToast = useUndoToast();
  const title = useEntryTitle(entryId, open);
  const toasts = editionStrings.knowledge.swipe.menu.toasts;
  const close = () => {
    setOpen(false);
  };
  const after = (next: (() => void) | undefined) =>
    next === undefined
      ? undefined
      : () => {
          setFollowUp({ open: next });
          close();
        };
  return (
    <>
      <CornerActions
        favorite={favorite}
        collection={collection}
        onMore={() => {
          setOpen(true);
        }}
      />
      <EntryMenuSheet
        visible={open}
        entryTitle={title}
        entryKind={entryKind}
        marks={
          marksShown
            ? {
                mark: knowledge.mark,
                onSet: (mark) => {
                  close();
                  knowledge.set(mark);
                  showToast({ message: toasts[mark], brief: true });
                },
                onClear: () => {
                  close();
                  knowledge.clear();
                  showToast({ message: toasts.cleared, brief: true });
                },
              }
            : undefined
        }
        onShare={after(onShare)}
        onHide={after(onHide)}
        onReport={after(onReport)}
        onClose={close}
        onDismissed={() => {
          followUp?.open();
          setFollowUp(undefined);
        }}
      />
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

/** An action that opens a sheet, from its button or from the «⋯» sheet: all undefined while it is off. */
interface OpenedAction {
  open: (() => void) | undefined;
  button: ReactNode;
  sheet: ReactNode;
}

/**
 * The side swipes of an Entry's card that set its Knowledge Mark, with the
 * stamp and the undo toast: there only when the Knowledge and Swipe Marks
 * switches are both on in effect (ADR 0077). Feed Notices take none.
 */
export function useEntrySwipe(entryId: string): EntrySwipe | undefined {
  const shown = useShown();
  const knowledge = useKnowledgeMark(entryId);
  return shown.entryButtons.knowledge && shown.swipeMarks
    ? { mark: knowledge.mark, onMark: knowledge.set, onUndo: knowledge.undo }
    : undefined;
}

/**
 * The share button of an Entry's action row, and the share sheet it opens:
 * there only when the binary can capture the Share Card and the Share Cards
 * switch is on in effect.
 */
function useShareAction(card: AnyEntryCard): OpenedAction {
  const [open, setOpen] = useState(false);
  const { shareCard } = useShell();
  const share = useShown().entryButtons.shareCard ? shareCard : undefined;
  if (share === undefined) return { open: undefined, button: undefined, sheet: undefined };
  return {
    open: () => {
      setOpen(true);
    },
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
  const composition = useComposition();
  return (
    <ShareSheet
      visible={visible}
      content={buildShareCardContent({ card }, editionStrings, edition.locale, deviceClock)}
      watermark={edition.displayName}
      initialFormat={sessionShareFormat.format}
      onFormatChange={(format) => {
        sessionShareFormat.choose(format);
      }}
      onShare={(view, format) =>
        share(view, card.entryId, format, () => {
          void composition.analytics.shareCardShared('entry');
        })
      }
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
function useMistakeReportAction(entryId: string): OpenedAction {
  const [open, setOpen] = useState(false);
  const showToast = useUndoToast();
  const { mistakeReports } = useShell();
  const shown = useShown().entryButtons.mistakeReport;
  if (!shown) return { open: undefined, button: undefined, sheet: undefined };
  const close = () => {
    setOpen(false);
  };
  return {
    open: () => {
      setOpen(true);
    },
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

/**
 * The «До колекції» button of an Entry's action row, filled once the Entry is
 * in a Collection, the sheet it opens, and the names of the Collections the
 * Entry is in.
 */
function useCollectionAction(entryId: string): {
  button: ReactNode;
  sheet: ReactNode;
  filedNames: readonly string[];
} {
  const [open, setOpen] = useState(false);
  const { collections, isFiled } = useEntryCollections(entryId);
  const filedNames = collections.filter(({ id }) => isFiled(id)).map(({ name }) => name);
  return {
    filedNames,
    button: (
      <CollectionButton
        filed={filedNames.length > 0}
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
  const row = useCompositionRead(read, 'Could not read the Entry', enabled);
  return row.status === 'ready' ? (row.value?.title ?? '') : '';
}
