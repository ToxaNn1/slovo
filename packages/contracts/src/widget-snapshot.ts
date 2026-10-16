import { z } from 'zod';

import { CorrectionIdSchema } from './correction';
import { hasNoRepeats, TextSchema } from './shared';
import { WordIdSchema } from './word';

/** The format of the Widget Snapshot; a change the widget can't read takes the next number. */
export const WIDGET_SNAPSHOT_FORMAT = 1;

/** The text an Entry shows on the widget, decided by the Core so the widget only lays it out. */
const WidgetEntryText = {
  /**
   * What the widget leads with: a Word's Lemma with each valid Stress as the
   * combining acute mark, or a Correction's main standard equivalent.
   */
  headline: TextSchema,
  /** The line under it: a Word's primary Definition, or the non-standard form a Correction replaces. */
  secondLine: TextSchema,
  /**
   * The headline, then the second line, as VoiceOver reads them: whole words,
   * with no Stress mark. The widget puts the Widget Mode's name before it.
   */
  voiceOver: TextSchema,
};

/** An Entry any Widget Mode may show, ready to draw. */
const WidgetEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('word'), id: WordIdSchema, ...WidgetEntryText }),
  z.strictObject({ kind: z.literal('correction'), id: CorrectionIdSchema, ...WidgetEntryText }),
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
