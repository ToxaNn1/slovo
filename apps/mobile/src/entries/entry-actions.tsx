import {
  buildShareCardContent,
  entryCardTitle,
  type AnyEntryCard,
  type CounterLine,
  type WordCardModel,
} from '@slovo/core';
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
import { useState, type ReactNode } from 'react';

import { refusalText } from '../saved/collection-refusal';
import { deviceClock } from '../device/device-clock';
import { edition, editionStrings } from '../edition/edition';
import { useEntryCollections } from '../saved/collections';
import { keptHint } from '../saved/kept-hint';
import { useComposition } from '../composition';
import { useCounterLine } from '../community-counters/counter-line';
import { useFavorite } from '../saved/favorites';
import { useKnowledgeMark } from '../knowledge/marks';
import { useHide } from '../mix/hiding';
import { logError } from '../diagnostics/log';
import { sessionShareFormat } from '../share/share-card';
import { useShell, type ShareCard } from '../shell-value';
import { useShown } from '../shown-in-effect';

/** The Knowledge Mark of an Entry's card, as state plus callbacks. */
type Knowledge = ReturnType<typeof useKnowledgeMark>;

/**
 * The marks of an Entry's card: its Knowledge Mark while the Knowledge
 * switch is on in effect, and whether marks are swiped, the Swipe Marks
 * switch on in effect (ADR 0077).
 */
export interface EntryMarks {
  knowledge: Knowledge | undefined;
  swiped: boolean;
}

/** The marks of the card of an Entry: its Knowledge Mark read once. */
export function useEntryMarks(entryId: string): EntryMarks {
  const shown = useShown();
  const knowledge = useKnowledgeMark(entryId);
  return {
    knowledge: shown.entryButtons.knowledge ? knowledge : undefined,
    swiped: shown.swipeMarks,
  };
}

/**
 * The side swipes of an Entry's card that set its Knowledge Mark, with the
 * stamp and the undo toast: there only when the Knowledge and Swipe Marks
 * switches are both on in effect (ADR 0077). Feed Notices take none.
 */
export function entrySwipe({ knowledge, swiped }: EntryMarks): EntrySwipe | undefined {
  return knowledge !== undefined && swiped
    ? { mark: knowledge.mark, onMark: knowledge.set, onUndo: knowledge.undo }
    : undefined;
}

/**
 * Everything an Entry's card can do, each action read once: Favorite, its
 * Collections, share, hide, the Mistake Report and the marks, as state plus
 * callbacks, the line that says where the Entry is kept, the Community
 * Counters line (read only while the action row shows it, ADR 0060) and the
 * sheets the actions open. The action row and the corner lay them out.
 */
interface EntryCardActions {
  card: AnyEntryCard;
  title: string;
  marks: EntryMarks;
  favorite: ReactNode;
  collection: ReactNode;
  hint: string | undefined;
  line: CounterLine | undefined;
  share: OpenedAction;
  report: OpenedAction;
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
  const line = useCounterLine(entryId, marks.knowledge !== undefined && !marks.swiped, {
    mark: marks.knowledge?.mark,
    inFavorites: favorite.inFavorites,
  });
  const { count } = useEdition();
  return {
    card,
    title,
    marks,
    favorite: <FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />,
    collection: collection.button,
    hint: keptHint({
      collectionNames: collection.filedNames,
      inFavorites: favorite.inFavorites,
      strings: editionStrings,
      count,
    }),
    line,
    share,
    report,
    onHide: hide.open,
    sheets: (
      <>
        <HideChoiceSheet {...hide.choice} />
        {collection.sheet}
        {share.sheet}
        {report.sheet}
      </>
    ),
  };
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
  const actions = useEntryCardActions(card);
  return actions.marks.swiped
    ? {
        slot: 'corner',
        corner: <EntryCorner actions={actions} />,
        swipe: entrySwipe(actions.marks),
      }
    : { slot: 'actions', actions: <EntryActions actions={actions} place={place} /> };
}

/**
 * The «Знаю» and «Не знаю» buttons of Yesterday's Word, or while marks are
 * swiped its corner: the «⋯» button alone, whose sheet has the mark items.
 */
export function useYesterdaySlots(word: WordCardModel): YesterdaySlots | undefined {
  const marks = useEntryMarks(word.wordId);
  const { inFavorites } = useFavorite(word.wordId);
  const line = useCounterLine(word.wordId, marks.knowledge !== undefined && !marks.swiped, {
    mark: marks.knowledge?.mark,
    inFavorites,
  });
  if (marks.swiped)
    return {
      slot: 'corner',
      corner: <MenuCorner title={word.lemma} entryKind="word" knowledge={marks.knowledge} />,
    };
  return marks.knowledge === undefined
    ? undefined
    : {
        slot: 'marks',
        marks: <MarkButtons entryKind="word" knowledge={marks.knowledge} line={line} />,
      };
}

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
function EntryActions({
  actions,
  place,
}: {
  actions: EntryCardActions;
  place: 'feed' | 'details';
}) {
  const { card, marks } = actions;
  return (
    <>
      <ActionRow
        look={card.kind === 'word' ? 'tiles' : 'icons'}
        marks={
          marks.knowledge && (
            <MarkButtons entryKind={card.kind} knowledge={marks.knowledge} line={actions.line} />
          )
        }
        marksAt={place === 'details' ? 'below' : 'above'}
        hint={actions.hint}
        favorite={actions.favorite}
        share={actions.share.button}
        collection={actions.collection}
        hide={<HideButton onPress={actions.onHide} />}
        report={actions.report.button}
      />
      {actions.sheets}
    </>
  );
}

/**
 * The corner of an Entry card while marks are swiped (XSwipe): the heart, the
 * «До колекції» bookmark and the «⋯» button, whose sheet also shares, hides
 * and reports the Entry as the action row did, each while it is on.
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
        onShare={actions.share.open}
        onHide={actions.onHide}
        onReport={actions.report.open}
      />
      {actions.sheets}
    </>
  );
}

/**
 * The «Знаю» and «Не знаю» buttons of an Entry's card, wherever the card
 * appears, Yesterday's too, with the Community Counters line under them
 * (ADR 0060).
 */
function MarkButtons({
  entryKind,
  knowledge,
  line,
}: {
  entryKind: AnyEntryCard['kind'];
  knowledge: Knowledge;
  line: CounterLine | undefined;
}) {
  return (
    <>
      <KnowledgeButtons entryKind={entryKind} mark={knowledge.mark} onTap={knowledge.tap} />
      <CommunityCountersLine line={line} />
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

/** An action that opens a sheet, from its button or from the «⋯» sheet: all undefined while it is off. */
interface OpenedAction {
  open: (() => void) | undefined;
  button: ReactNode;
  sheet: ReactNode;
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
 * in a Collection, the sheet it opens, titled with the Entry, and the names
 * of the Collections the Entry is in.
 */
function useCollectionAction(
  entryId: string,
  title: string,
): {
  button: ReactNode;
  sheet: ReactNode;
  filedNames: readonly string[];
} {
  const [open, setOpen] = useState(false);
  const filing = useEntryCollections(entryId);
  const filedNames = filing.collections
    .filter(({ id }) => filing.isFiled(id))
    .map(({ name }) => name);
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
