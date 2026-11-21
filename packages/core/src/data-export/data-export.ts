import { z } from 'zod';

import type { EntryRows } from '../entries/entry-row';
import { withoutStress } from '../entries/stress';
import type { Edition } from '../edition/edition';
import type { Clock } from '../ports';
import type { XpRecord } from '../progress/records';
import { readXpLog } from '../progress/xp-days';
import { settingsRecords } from '../settings/records';
import type { UserState } from '../user-state/user-state';
import { declareRecords } from '../user-state/user-state-record';
import { userStateRecords } from '../user-state-schema';

/** The version of the Data export format; a change to the format raises it. */
export const DATA_EXPORT_VERSION = 1;

/** An Entry as the Data export names it: by id and Lemma only, never its content (ADR 0135). */
export interface ExportedEntry {
  readonly entryId: string;
  /** The Entry's Lemma without the Stress mark, or `null` when the Language Pack no longer has the Entry. */
  readonly lemma: string | null;
}

/**
 * The Data export (ADR 0135): one versioned, human-readable JSON document of
 * the reader's own data in one Edition, built on the device from the user
 * state, so it needs no Account and no network. Every instant is ISO 8601 in
 * UTC, every local date `YYYY-MM-DD`; lists are in a stable order (by time,
 * then by id). It never holds the Session, a token, the Install id, records
 * that only run the app (Sync, Notifications, hints) or another reader's data.
 *
 * - `format`, `version`, `edition`, `exportedAt`: what the file is, which
 *   format version it follows, the Edition it comes from and when it was made.
 * - `reader.name`: the reader's name, or `null`.
 * - `settings`: only the settings the reader chose, by name; a default is left out.
 * - `favorites`, `collections` (each with its Entries), `history`: the
 *   reader's words, with the instant each was added or Seen.
 * - `knowledgeMarks`: each marked Entry's Knowledge Mark, whether it is
 *   Learned, its next Review day and when it was marked; a mark kept before
 *   its instant was recorded has none and comes first.
 * - `progress`: the Active Days, the XP log as kept (ADR 0066), the
 *   confirmed Entries and the best result of each Game Mode.
 */
export interface DataExport {
  readonly format: 'slovo-data-export';
  readonly version: typeof DATA_EXPORT_VERSION;
  readonly edition: string;
  readonly exportedAt: string;
  readonly reader: { readonly name: string | null };
  readonly settings: Readonly<Record<string, unknown>>;
  readonly favorites: readonly (ExportedEntry & { readonly addedAt: string })[];
  readonly collections: readonly {
    readonly id: string;
    readonly name: string;
    readonly createdAt: string;
    readonly entries: readonly (ExportedEntry & { readonly addedAt: string })[];
  }[];
  readonly history: readonly (ExportedEntry & {
    readonly seenAt: string;
    readonly wordOfTheDay: boolean;
  })[];
  readonly knowledgeMarks: readonly (ExportedEntry & {
    readonly mark: 'known' | 'unknown';
    readonly learned: boolean;
    readonly reviewDay: string | null;
    readonly markedAt: string | null;
  })[];
  readonly progress: {
    readonly activeDays: readonly string[];
    readonly xpLog: readonly (XpRecord & { readonly id: string })[];
    readonly confirmed: readonly (ExportedEntry & { readonly confirmedAt: string })[];
    readonly gameBest: Readonly<Record<string, number>>;
  };
}

/** The prefix every settings record is kept under. */
const SETTINGS_PREFIX = 'settings.';

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The pairs of the map sorted by their time, then by id. */
function inTimeOrder<T>(values: ReadonlyMap<string, T>, timeOf: (value: T) => string) {
  return [...values].sort(([a, x], [b, y]) => byId(timeOf(x), timeOf(y)) || byId(a, b));
}

/** Builds the reader's Data export of the Edition from the user state, at the Clock's now (ADR 0135). */
export async function buildDataExport({
  userState,
  clock,
  edition,
  rows,
}: {
  userState: UserState;
  clock: Clock;
  edition: Pick<Edition, 'id'>;
  rows: EntryRows;
}): Promise<DataExport> {
  const r = userStateRecords;
  const [favorites, collections, collectionEntries, history, knowledge, confirmed] =
    await Promise.all([
      userState.list(r.favorites),
      userState.list(r.collections),
      userState.list(r.collectionEntries),
      userState.list(r.history),
      userState.list(r.knowledge),
      userState.list(r.confirmed),
    ]);
  const [activeDays, xpLog, gameBest, readerName] = await Promise.all([
    userState.list(r.activeDays),
    readXpLog(userState).then(({ records }) => records),
    userState.list(r.gameBest),
    userState.read(r.readerName),
  ]);
  // Kept by Collection id, a `.` and the Entry id; neither holds a `.`.
  const inCollections = [...collectionEntries].map(([key, addedAt]) => {
    const dot = key.indexOf('.');
    return { collectionId: key.slice(0, dot), entryId: key.slice(dot + 1), addedAt };
  });
  const rowOf = await rows.rows([
    ...favorites.keys(),
    ...inCollections.map(({ entryId }) => entryId),
    ...history.keys(),
    ...knowledge.keys(),
    ...confirmed.keys(),
  ]);
  const entry = (entryId: string): ExportedEntry => {
    const row = rowOf.get(entryId);
    return { entryId, lemma: row === undefined ? null : withoutStress(row.title) };
  };

  // Each kept setting read through its own record, so only a value of its schema is exported.
  const keptSettings = await userState.list(declareRecords(SETTINGS_PREFIX, z.json()));
  const settings: Record<string, unknown> = {};
  for (const [name, record] of Object.entries(settingsRecords)) {
    const id = record.key.slice(SETTINGS_PREFIX.length);
    if (record === settingsRecords.readerName || !keptSettings.has(id)) continue;
    const value: unknown = record.decode(JSON.stringify(keptSettings.get(id)));
    if (value !== undefined) settings[name] = value;
  }

  return {
    format: 'slovo-data-export',
    version: DATA_EXPORT_VERSION,
    edition: edition.id,
    exportedAt: clock.now().toISOString(),
    reader: { name: readerName ?? null },
    settings,
    favorites: inTimeOrder(favorites, (addedAt) => addedAt).map(([entryId, addedAt]) => ({
      ...entry(entryId),
      addedAt,
    })),
    collections: inTimeOrder(collections, ({ createdAt }) => createdAt).map(
      ([id, { name, createdAt }]) => ({
        id,
        name,
        createdAt,
        entries: inCollections
          .filter(({ collectionId }) => collectionId === id)
          .map(({ entryId, addedAt }) => ({ ...entry(entryId), addedAt }))
          .sort((a, b) => byId(a.addedAt, b.addedAt) || byId(a.entryId, b.entryId)),
      }),
    ),
    history: inTimeOrder(history, ({ seenAt }) => seenAt).map(
      ([entryId, { seenAt, wordOfTheDay }]) => ({ ...entry(entryId), seenAt, wordOfTheDay }),
    ),
    knowledgeMarks: inTimeOrder(knowledge, ({ markedAt }) => markedAt ?? '').map(
      ([entryId, record]) => ({
        ...entry(entryId),
        mark: record.mark,
        learned: record.learned,
        reviewDay: record.reviewDay,
        markedAt: record.markedAt ?? null,
      }),
    ),
    progress: {
      activeDays: [...activeDays.keys()].sort(byId),
      xpLog: inTimeOrder(xpLog, ({ at }) => at).map(([id, record]) => ({ id, ...record })),
      confirmed: inTimeOrder(confirmed, (at) => at).map(([entryId, confirmedAt]) => ({
        ...entry(entryId),
        confirmedAt,
      })),
      gameBest: Object.fromEntries([...gameBest].sort(([a], [b]) => byId(a, b))),
    },
  };
}
