import { buildShareCardContent, entryCardTitle, type AnyEntryCard } from '@slovo/core';
import {
  CollectionButton,
  CollectionSheet,
  CornerActions,
  EntryMenuSheet,
  FavoriteButton,
  HideChoiceSheet,
  MistakeReportSheet,
  ShareSheet,
  type EntryCardSlots,
  type EntrySwipe,
  useUndoToast,
} from '@slovo/ui';
import { useState, type ReactNode } from 'react';

import { refusalText } from '../saved/collection-refusal';
import { deviceClock } from '../device/device-clock';
import { edition, editionStrings } from '../edition/edition';
import { useEntryCollections } from '../saved/collections';
import { useComposition } from '../composition';
import { useFavorite } from '../saved/favorites';
import { useKnowledgeMark } from '../knowledge/marks';
import { useHide } from '../mix/hiding';
import { keep } from '../keep';
import { sessionShareFormat } from '../share/share-card';
import { useShell, type ShareCard } from '../shell-value';
import { useShown } from '../shown-in-effect';

/** The Knowledge Mark of an Entry's card, as state plus callbacks. */
type Knowledge = ReturnType<typeof useKnowledgeMark>;

/**
 * The marks of an Entry's card: its Knowledge Mark while the Knowledge
 * switch is on in effect, set by its side swipes (ADR 0077).
 */
export interface EntryMarks {
  knowledge: Knowledge | undefined;
}

/** The marks of the card of an Entry: its Knowledge Mark read once. */
export function useEntryMarks(entryId: string): EntryMarks {
  const shown = useShown();
  const knowledge = useKnowledgeMark(entryId);
  return {
    knowledge: shown.entryButtons.knowledge ? knowledge : undefined,
  };
}

/**
 * The side swipes of an Entry's card that set its Knowledge Mark, with the
 * stamp and the undo toast: there only when the Knowledge switch is on in
 * effect (ADR 0077). Feed Notices take none.
 */
export function entrySwipe({ knowledge }: EntryMarks): EntrySwipe | undefined {
  return knowledge !== undefined
    ? { mark: knowledge.mark, onMark: knowledge.set, onUndo: knowledge.undo }
    : undefined;
}

/**
 * Everything an Entry's card can do, each action read once: Favorite, its
 * Collections, share, hide, the Mistake Report and the marks, as state plus
 * callbacks, and the sheets the actions open. The corner lays them out.
 */
interface EntryCardActions {
  card: AnyEntryCard;
  title: string;
  marks: EntryMarks;
  favorite: ReactNode;
  collection: ReactNode;
  share: OpenedAction | undefined;
  report: OpenedAction | undefined;
  onHide: () => void;
  sheets: ReactNode;
}

/** The actions of the card of an Entry, wherever the card appears. */
function useEntryCardActions(card: AnyEntryCard): EntryCardActions {
  const { entryId } = card;
  const title = entryCardTitle(card);
  const marks = useEntryMarks(entryId);
  const favorite = useFavorite(entryId);
  const hide = useHide(card);
  const collection = useCollectionAction(entryId, title);
  const share = useShareAction(card);
  const report = useMistakeReportAction(entryId);
  return {
    card,
    title,
    marks,
    favorite: <FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />,
    collection: collection.button,
    share,
    report,
    onHide: hide.open,
    sheets: (
      <>
        <HideChoiceSheet {...hide.choice} />
        {collection.sheet}
        {share?.sheet}
        {report?.sheet}
      </>
    ),
  };
}

/**
 * The slots of an Entry card, wherever the card appears: its corner
 * (`EntryCorner`) and its side swipes (ADR 0077).
 */
export function useEntrySlots(card: AnyEntryCard): EntryCardSlots {
  const actions = useEntryCardActions(card);
  return {
    corner: <EntryCorner actions={actions} />,
    swipe: entrySwipe(actions.marks),
  };
}

/**
 * The corner of an Entry card (XSwipe): the heart, the «До колекції»
 * bookmark and the «⋯» button, whose sheet also shares, hides and reports
 * the Entry, each while it is on.
 */
function EntryCorner({ actions }: { actions: EntryCardActions }) {
  return (
    <>
      <MenuCorner
        title={actions.title}
        entryKind={actions.card.kind}
        knowledge={actions.marks.knowledge}
        favorite={actions.favorite}
        collection={actions.collection}
        onShare={actions.share?.open}
        onHide={actions.onHide}
        onReport={actions.report?.open}
      />
      {actions.sheets}
    </>
  );
}

/**
 * The corner's buttons and the «⋯» sheet they open, titled with the Entry.
 * The sheet's mark items set or clear the Knowledge Mark, only while the
 * Knowledge switch is on in effect, and say so in a 2.2 s toast with no undo.
 * «Поділитися», «Сховати» and «Повідомити про помилку» open their own sheet
 * once the «⋯» sheet has slid away, as one modal at a time is presented.
 */
function MenuCorner({
  title,
  entryKind,
  knowledge,
  favorite,
  collection,
  onShare,
  onHide,
  onReport,
}: {
  title: string;
  entryKind: AnyEntryCard['kind'];
  knowledge: Knowledge | undefined;
  favorite?: ReactNode;
  collection?: ReactNode;
  onShare?: (() => void) | undefined;
  onHide?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [followUp, setFollowUp] = useState<{ open: () => void }>();
  const showToast = useUndoToast();
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
          knowledge && {
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

/** An action that opens a sheet from the «⋯» sheet; none while it is off. */
interface OpenedAction {
  open: () => void;
  sheet: ReactNode;
}

/**
 * The share item of an Entry's «⋯» sheet, and the share sheet it opens:
 * there only when the binary can capture the Share Card and the Share Cards
 * switch is on in effect.
 */
function useShareAction(card: AnyEntryCard): OpenedAction | undefined {
  const [open, setOpen] = useState(false);
  const { shareCard } = useShell();
  const share = useShown().entryButtons.shareCard ? shareCard : undefined;
  if (share === undefined) return undefined;
  return {
    open: () => {
      setOpen(true);
    },
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
 * The «Повідомити про помилку» item of an Entry's «⋯» sheet, and the sheet
 * it opens: there only while Mistake Reports are on in effect (ADR 0056).
 * «Надіслати» closes the sheet, thanks the reader at once («Дякуємо! Ми
 * перевіримо.», offline too) and hands the report to the Core's queue, which
 * sends it now or later; if the Core then says the daily limit is spent, or
 * keeps no report, a toast in its place says so.
 */
function useMistakeReportAction(entryId: string): OpenedAction | undefined {
  const [open, setOpen] = useState(false);
  const showToast = useUndoToast();
  const { mistakeReports } = useShell();
  const shown = useShown().entryButtons.mistakeReport;
  if (!shown) return undefined;
  const close = () => {
    setOpen(false);
  };
  return {
    open: () => {
      setOpen(true);
    },
    sheet: (
      <MistakeReportSheet
        visible={open}
        onClose={close}
        onSend={({ type, comment }) => {
          const toasts = editionStrings.mistakeReport;
          close();
          showToast({ message: toasts.sent });
          // One that could not be kept answers nothing, and the toast says it failed.
          void keep(
            'the Mistake Report',
            mistakeReports.opened().then((reports) => reports.report({ entryId, type, comment })),
          ).then((answer) => {
            if (answer === 'too-many-requests') showToast({ message: toasts.tooMany });
            else if (answer !== 'thanked') showToast({ message: toasts.failed });
          });
        }}
      />
    ),
  };
}

/**
 * The «До колекції» button of an Entry's corner, filled once the Entry is
 * in a Collection, and the sheet it opens, titled with the Entry.
 */
function useCollectionAction(
  entryId: string,
  title: string,
): {
  button: ReactNode;
  sheet: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const filing = useEntryCollections(entryId);
  const filedNames = filing.collections
    .filter(({ id }) => filing.isFiled(id))
    .map(({ name }) => name);
  return {
    button: (
      <CollectionButton
        filed={filedNames.length > 0}
        onPress={() => {
          setOpen(true);
        }}
      />
    ),
    sheet: (
      <CollectionSheet
        visible={open}
        entryTitle={title}
        collections={filing.collections}
        isFiled={filing.isFiled}
        onToggle={filing.setFiled}
        onClose={() => {
          setOpen(false);
        }}
        onCreate={async (name) => {
          const result = await filing.create(name);
          return result.ok
            ? undefined
            : refusalText(editionStrings.collections.sheet.refusal, result.reason);
        }}
      />
    ),
  };
}
