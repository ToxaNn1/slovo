import { z } from 'zod';

import { CorrectionIdSchema } from './correction';
import { DailyGoalSchema } from './edition';
import { IdiomIdSchema } from './idiom';
import { hasNoRepeats, TextSchema } from './shared';
import { SynonymRowIdSchema } from './synonym-row';
import { TipIdSchema } from './tip';
import { WordIdSchema } from './word';

/** The format of the Widget Snapshot; a change the widget can't read takes the next number. */
export const WIDGET_SNAPSHOT_FORMAT = 1;

/** The text an Entry shows on the widget, decided by the Core so the widget only lays it out. */
const WidgetEntryText = {
  /**
   * What the widget leads with: a Word's Lemma with each valid Stress as the
   * combining acute mark, a Correction's main standard equivalent, an
   * Idiom's expression, a Synonym Row's dominant with its Stress, or a Tip's
   * title.
   */
  headline: TextSchema,
  /**
   * The line under it: a Word's or an Idiom's primary Definition, the
   * non-standard form a Correction replaces, a Synonym Row's first 3 members
   * with their Stress and the ellipsis, or a Tip's standard form in the
   * Edition's words («Так: …»).
   */
  secondLine: TextSchema,
  /**
   * The headline, then the second line, as VoiceOver reads them: whole words,
   * with no Stress mark. The widget puts the Widget Mode's name before it.
   */
  voiceOver: TextSchema,
};

/**
 * An Entry any Widget Mode may show, ready to draw. The widget never reads
 * `kind`, so a new kind keeps the format (ADR 0026).
 */
export const WidgetEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('word'), id: WordIdSchema, ...WidgetEntryText }),
  z.strictObject({ kind: z.literal('correction'), id: CorrectionIdSchema, ...WidgetEntryText }),
  z.strictObject({ kind: z.literal('idiom'), id: IdiomIdSchema, ...WidgetEntryText }),
  z.strictObject({ kind: z.literal('synonymRow'), id: SynonymRowIdSchema, ...WidgetEntryText }),
  z.strictObject({ kind: z.literal('tip'), id: TipIdSchema, ...WidgetEntryText }),
]);

const EntryIdsSchema = z
  .array(z.string().min(1))
  .refine(hasNoRepeats, 'Expected each Entry id at most once');

/** A Collection as its Widget Mode shows it. */
const WidgetCollectionSchema = z.strictObject({
  id: z.string().min(1),
  /** The name the user gave it, so the widget labels it and its picker lists it. */
  name: TextSchema,
  /** Its Eligible Entries, newest first, as the Collection's screen lists them; may be empty. */
  entryIds: EntryIdsSchema,
});

/**
 * The Widget Snapshot (ADR 0026): everything each Widget Mode may show,
 * already decided by the Core, which the app writes into the App Group and
 * the widget only reads. Every id in a mode is one of `entries`.
 */
export const WidgetSnapshotSchema = z
  .strictObject({
    format: z.literal(WIDGET_SNAPSHOT_FORMAT),
    editionId: z.string().min(1),
    /** The instant it was written, from the Core's clock, in ISO 8601. */
    writtenAt: z.iso.datetime(),
    /** Whether the reader finished the onboarding; until then the widget invites them to open the app. */
    onboardingFinished: z.boolean(),
    /** Each Entry any mode shows, once. */
    entries: z.array(WidgetEntrySchema),
    /** Усі слова: every Eligible Entry. */
    allEntries: EntryIdsSchema,
    /** Улюблене: the Favorites that are Eligible Entries, newest first. */
    favorites: EntryIdsSchema,
    /** The Collections, newest first, empty ones included. */
    collections: z.array(WidgetCollectionSchema),
    /**
     * The key the widget's links to an Entry carry as `key=`, so the app
     * opens only those as the widget's: a link another app or a web page
     * opens can't know it. The app adds it to the Core's snapshot and keeps
     * it from one snapshot to the next; the Edition's example has none.
     */
    linkKey: z.string().min(1).optional(),
    /**
     * The local date, in ISO 8601, on which the reader last Saw a Word of
     * the Day, so the widget marks it ✓ while that date is today; none
     * before the first, and none while the Edition has no Word of the Day.
     * Optional, so a snapshot without it keeps the format.
     */
    wordOfTheDaySeenOn: z.iso.date().optional(),
    /**
     * The goal ring: the local date it was written on, the XP earned that day,
     * its Daily Goal and whether the day met it, and the Streak while it is
     * shown. The widget draws it while `on` is today and an empty ring after.
     * None while the widget goal ring, the XP log or the Daily Goal is off, or
     * «Без лічильників» hides the counters. Optional, so the format stays.
     */
    goalRing: z
      .strictObject({
        on: z.iso.date(),
        xp: z.int().nonnegative(),
        goal: DailyGoalSchema,
        met: z.boolean(),
        streak: z.int().nonnegative().optional(),
      })
      .optional(),
    /** Present while the lock-screen widget is on; without it the lock-screen widget invites the reader to open the app. */
    lockScreenWidget: z.literal(true).optional(),
  })
  .superRefine((snapshot, context) => {
    const ids = snapshot.entries.map(({ id }) => id);
    if (!hasNoRepeats(ids)) {
      context.addIssue({ code: 'custom', path: ['entries'], message: 'Expected each Entry once' });
    }
    const known = new Set(ids);
    const modes: [path: (string | number)[], ids: readonly string[]][] = [
      [['allEntries'], snapshot.allEntries],
      [['favorites'], snapshot.favorites],
      ...snapshot.collections.map(
        ({ entryIds }, index): [(string | number)[], readonly string[]] => [
          ['collections', index, 'entryIds'],
          entryIds,
        ],
      ),
    ];
    for (const [path, modeIds] of modes) {
      modeIds.forEach((id, index) => {
        if (!known.has(id)) {
          context.addIssue({
            code: 'custom',
            path: [...path, index],
            message: `Expected ${id} among the entries`,
          });
        }
      });
    }
  });

export type WidgetSnapshot = z.output<typeof WidgetSnapshotSchema>;

export type WidgetEntry = WidgetSnapshot['entries'][number];

/**
 * The Widget Snapshot as the file the app writes: checked against the
 * contract first, so the widget never reads a snapshot it can't decode.
 */
export function serializeWidgetSnapshot(snapshot: WidgetSnapshot): string {
  return JSON.stringify(WidgetSnapshotSchema.parse(snapshot));
}
