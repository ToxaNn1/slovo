import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, templateOf } from './shared';

/** A text for each Knowledge Mark a swipe or the «⋯» sheet sets: Known, Unknown, and Known on a Correction. */
const ByMarkSchema = z.strictObject({
  known: TextSchema,
  unknown: TextSchema,
  /** Known on a Correction, which means the reader already says it right. */
  correctionKnown: TextSchema,
});

/** One row of the swipe hint sheet: what a gesture does, and what follows. */
const HintRowSchema = z.strictObject({ title: TextSchema, body: TextSchema });

/**
 * The texts of the Entry card's side swipes and its «⋯» sheet, exactly as on board 04 (ADR 0077).
 * The hint sheet keeps the board's «ви» forms (ADR 0075).
 */
const SwipeStringsSchema = z.strictObject({
  /** The labels at the card's edges while it is dragged, e.g. «ЗНАЮ», «НЕ ЗНАЮ». */
  edges: z.strictObject({ known: TextSchema, unknown: TextSchema }),
  /** The stamp that lands on a marked card, e.g. «✓ ЗНАЮ». */
  stamps: ByMarkSchema,
  /** The undo toast after a swipe, e.g. «Позначено: знаю». */
  toasts: ByMarkSchema,
  /** The toast's undo button. */
  undo: TextSchema,
  /** The «⋯» sheet of an Entry card. */
  menu: z.strictObject({
    /** The accessibility label of the card's «⋯» button that opens the sheet. */
    open: TextSchema,
    /** The mark items of an Entry with no mark. */
    marks: ByMarkSchema,
    /** Turns a Known mark into Unknown. */
    changeToUnknown: TextSchema,
    /** Turns an Unknown mark into Known. */
    changeToKnown: TextSchema,
    /** Removes the mark: the only way to clear one. */
    clear: TextSchema,
    share: TextSchema,
    hide: TextSchema,
    report: TextSchema,
    close: TextSchema,
    /** The short toasts after a menu item, with no undo. */
    toasts: z.strictObject({ known: TextSchema, unknown: TextSchema, cleared: TextSchema }),
  }),
  /** The sheet shown once that teaches the swipes. */
  hint: z.strictObject({
    title: TextSchema,
    /** Right, left and up, in this order. */
    rows: z.strictObject({ known: HintRowSchema, unknown: HintRowSchema, next: HintRowSchema }),
    dismiss: TextSchema,
  }),
});

/** The texts of Knowledge Marks: the action row's buttons, the swipes and «⋯» sheet, and the Review label. */
export const KnowledgeStringsSchema = z.strictObject({
  /** The button that marks the Entry Known. */
  known: TextSchema,
  /** What the Known button means on a Correction, for a screen reader. */
  correctionKnownHint: TextSchema,
  /** The button that marks the Entry Unknown. */
  unknown: TextSchema,
  /** The side swipes on the Entry card and its «⋯» sheet, under the `swipeMarks` Feature Switch. */
  swipe: SwipeStringsSchema,
  /** The label on a card the Feed brought back for Review. */
  review: TextSchema,
  /** The Community Counters line under the mark buttons, e.g. «Знають 3 з 5 читачів · зберегли 0». */
  communityCounters: z.strictObject({
    /** Who know the Entry, by the readers who marked it, `{count}`; takes `{known}`. */
    known: pluralOf('known'),
    /** Who saved the Entry. Takes `{saved}`. */
    saved: templateOf('saved'),
    /** How the two join, e.g. "{known} · {saved}". */
    line: templateOf('known', 'saved'),
    /** How VoiceOver reads the two as one sentence, e.g. "{known}, {saved}". */
    spokenLine: templateOf('known', 'saved'),
  }),
});
