import type { Patch } from '@slovo/contracts/api';

import {
  childDeletes,
  correctionRows,
  crosswordDayRows,
  curatedCollectionRows,
  entryRow,
  idiomRows,
  synonymRowRows,
  tipRows,
  wordRows,
  type BindValue,
  type Statement,
} from './record-rows';

/** What a transaction over a writable pack runs: any SQLite driver can supply it. */
export interface PackTransaction {
  runAsync(sql: string, params: BindValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: BindValue[]): Promise<T[]>;
}

/** A writable pack: runs `run` in one transaction, which rolls back when `run` rejects. */
export interface PackWriteDatabase {
  transaction(run: (tx: PackTransaction) => Promise<void>): Promise<void>;
}

/** The `metadata` key of the ETag of the Patch applied last, beside the content version it brought. */
const PATCH_ETAG = 'patch_etag';

const SELECT_METADATA = `SELECT key, value FROM metadata WHERE key IN ('edition_id', 'content_version', '${PATCH_ETAG}')`;

/** The Patch-related metadata of a pack: its Edition, content version and the ETag of the Patch applied last. */
export async function patchStateOf(
  db: Pick<PackTransaction, 'getAllAsync'>,
): Promise<{ editionId: string; contentVersion: number; etag: string | undefined }> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(SELECT_METADATA, []);
  const values = new Map(rows.map(({ key, value }) => [key, value]));
  return {
    editionId: values.get('edition_id') ?? '',
    contentVersion: Number(values.get('content_version')),
    etag: values.get(PATCH_ETAG),
  };
}

/**
 * Applies a Patch to the pack in one transaction (ADR 0090): each record of
 * the Patch replaces the pack's record of its id, a new one is added, and the
 * pack's content version and the Patch's ETag are written last. It rejects a
 * Patch of another Edition, from another content version than the pack's or
 * to a lower one, and any failure rolls the whole Patch back.
 */
export async function applyPatch(db: PackWriteDatabase, patch: Patch, etag: string): Promise<void> {
  await db.transaction(async (tx) => {
    const pack = await patchStateOf(tx);
    if (pack.editionId !== patch.editionId) {
      throw new Error(
        `A Patch of ${patch.editionId} does not apply to a pack of ${pack.editionId}`,
      );
    }
    if (pack.contentVersion !== patch.since) {
      throw new Error(
        `A Patch since ${String(patch.since)} does not apply to a pack at ${String(pack.contentVersion)}`,
      );
    }
    if (patch.contentVersion < patch.since) {
      throw new Error(
        `A Patch to ${String(patch.contentVersion)} would lower the pack from ${String(patch.since)}`,
      );
    }
    const statements: Statement[] = [
      ...patch.words.flatMap(({ id }) => childDeletes('word', id)),
      ...patch.corrections.flatMap(({ id }) => childDeletes('correction', id)),
      ...patch.idioms.flatMap(({ id }) => childDeletes('idiom', id)),
      ...patch.synonymRows.flatMap(({ id }) => childDeletes('synonymRow', id)),
      ...patch.tips.flatMap(({ id }) => childDeletes('tip', id)),
      ...patch.crosswordDays.flatMap(({ date }) => childDeletes('crosswordDay', date)),
      ...patch.curatedCollections.flatMap(({ id }) => childDeletes('curatedCollection', id)),
      ...[
        ...patch.words,
        ...patch.corrections,
        ...patch.idioms,
        ...patch.synonymRows,
        ...patch.tips,
      ].map(entryRow),
      ...patch.corrections.flatMap(correctionRows),
      ...patch.idioms.flatMap(idiomRows),
      // A new Word needs no new Recording: it has none yet.
      ...patch.words.flatMap((word) => wordRows(word, false)),
      ...patch.synonymRows.flatMap(synonymRowRows),
      ...patch.tips.flatMap(tipRows),
      ...patch.crosswordDays.flatMap(crosswordDayRows),
      ...patch.curatedCollections.flatMap(curatedCollectionRows),
      {
        sql: "UPDATE metadata SET value = ? WHERE key = 'content_version'",
        params: [String(patch.contentVersion)],
      },
      {
        sql: 'INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        params: [PATCH_ETAG, etag],
      },
    ];
    for (const { sql, params } of statements) await tx.runAsync(sql, [...params]);
  });
}
