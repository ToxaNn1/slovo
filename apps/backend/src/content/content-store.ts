import type { Entry } from '@slovo/contracts';
import type { BuildError } from '@slovo/language-pack';
import { readEdition } from '@slovo/language-pack';
import type { Clock, EditionRegistry } from '@slovo/server-core';
import type { Patch } from '@slovo/contracts/api';
import { and, eq, gt, inArray } from 'drizzle-orm';

import type { Database } from '../database/database';
import {
  contentBatches,
  contentCorrections,
  contentCrosswordDays,
  contentCuratedCollections,
  contentIdioms,
  contentIds,
  contentSynonymRows,
  contentTips,
  contentVersions,
  contentWords,
} from '../database/schema';

/** How many records of each kind an import wrote. */
export interface ImportCounts {
  readonly words: number;
  readonly idioms: number;
  readonly corrections: number;
  readonly tips: number;
  readonly synonymRows: number;
  readonly curatedCollections: number;
  readonly crosswordDays: number;
}

export type ImportResult =
  | { readonly ok: true; readonly contentVersion: number; readonly counts: ImportCounts }
  | { readonly ok: false; readonly reason: 'unknown-edition' | 'already-imported' }
  /** The folder breaks a content rule or does not read; each refusal names its rule when a rule refused it. */
  | { readonly ok: false; readonly reason: 'refused'; readonly refusals: readonly BuildError[] };

/** Rows a single insert sends, well inside Postgres's limit of parameters. */
const ROWS_PER_INSERT = 500;

/** Every content table, for what an import does to all of them. */
const CONTENT_TABLES = [
  contentWords,
  contentIdioms,
  contentCorrections,
  contentTips,
  contentSynonymRows,
  contentCuratedCollections,
  contentCrosswordDays,
] as const;

/** The content tables of the kinds of Entry. */
const ENTRY_TABLES = [
  contentWords,
  contentCorrections,
  contentIdioms,
  contentSynonymRows,
  contentTips,
] as const;

/** The records in code-unit order of their ids, as the Language Pack keeps them, whatever the collation. */
function inIdOrder<F>(rows: readonly { readonly id: string; readonly fields: F }[]): F[] {
  return rows.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((row) => row.fields);
}

/** Sends the rows in inserts of at most ROWS_PER_INSERT each. */
async function inChunks<R>(rows: readonly R[], insert: (chunk: R[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
    await insert(rows.slice(start, start + ROWS_PER_INSERT));
  }
}

/** The content of the Edition's tables, imported, snapshotted. */
export function createContentStore({
  database,
  clock,
  editions,
}: {
  database: Database;
  clock: Clock;
  editions: EditionRegistry;
}) {
  const { db } = database;

  /**
   * Imports the Edition's folder through the shared content rules, keeping
   * every id and retired flag, all in one transaction: a refusal writes
   * nothing. The first import continues from the manifest's content
   * version; a second one is refused unless overridden, and then replaces
   * every record one version on, so no device ever sees a lower version.
   */
  async function importEdition(
    editionId: string,
    editionDir: string,
    { override = false }: { readonly override?: boolean } = {},
  ): Promise<ImportResult> {
    if (editions.find(editionId) === undefined) return { ok: false, reason: 'unknown-edition' };
    const now = clock.now();
    const source = readEdition(editionDir, { registryRequired: true, today: now });
    if (source.editionId !== undefined && source.editionId !== editionId) {
      return { ok: false, reason: 'unknown-edition' };
    }
    const { valid, registry = [] } = source;
    if (valid === undefined) return { ok: false, reason: 'refused', refusals: source.errors };
    const { content } = valid;
    return db.transaction(async (tx) => {
      const [held] = await tx
        .select()
        .from(contentVersions)
        .where(eq(contentVersions.editionId, editionId))
        .for('update');
      if (held !== undefined && !override)
        return { ok: false, reason: 'already-imported' } as const;
      const contentVersion = held === undefined ? content.contentVersion : held.contentVersion + 1;
      const [batch] = await tx
        .insert(contentBatches)
        .values({ editionId, changedBy: 'import', createdAt: now })
        .returning({ id: contentBatches.id });
      if (batch === undefined) throw new Error('the batch of the import was not written');
      const common = {
        editionId,
        recordVersion: 1,
        contentVersion,
        changedBy: 'import' as const,
        changedAt: now,
        batchId: batch.id,
      };
      const rowsOf = <T extends { readonly id: string; readonly retired?: boolean }>(
        records: readonly T[],
      ) =>
        records.map((fields) => ({
          ...common,
          id: fields.id,
          fields,
          retired: fields.retired ?? false,
        }));
      const words = rowsOf(content.words).map((row) => ({ ...row, needsNewRecording: false }));
      const crosswordDays = (content.crosswordDays ?? []).map((fields) => ({
        ...common,
        id: fields.date,
        fields,
        retired: false,
      }));
      for (const table of CONTENT_TABLES) {
        await tx.delete(table).where(eq(table.editionId, editionId));
      }
      await inChunks(words, (rows) => tx.insert(contentWords).values(rows));
      await inChunks(rowsOf(content.idioms), (rows) => tx.insert(contentIdioms).values(rows));
      await inChunks(rowsOf(content.corrections), (rows) =>
        tx.insert(contentCorrections).values(rows),
      );
      await inChunks(rowsOf(content.tips), (rows) => tx.insert(contentTips).values(rows));
      await inChunks(rowsOf(content.synonymRows), (rows) =>
        tx.insert(contentSynonymRows).values(rows),
      );
      await inChunks(rowsOf(content.curatedCollections ?? []), (rows) =>
        tx.insert(contentCuratedCollections).values(rows),
      );
      await inChunks(crosswordDays, (rows) => tx.insert(contentCrosswordDays).values(rows));
      await inChunks(
        registry.map((id) => ({ editionId, id, registeredAt: now })),
        (rows) => tx.insert(contentIds).values(rows).onConflictDoNothing(),
      );
      await tx
        .insert(contentVersions)
        .values({ editionId, contentVersion, importedAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: contentVersions.editionId,
          set: { contentVersion, updatedAt: now },
        });
      return {
        ok: true,
        contentVersion,
        counts: {
          words: content.words.length,
          idioms: content.idioms.length,
          corrections: content.corrections.length,
          tips: content.tips.length,
          synonymRows: content.synonymRows.length,
          curatedCollections: content.curatedCollections?.length ?? 0,
          crosswordDays: content.crosswordDays?.length ?? 0,
        },
      } as const;
    });
  }

  type Reader = Parameters<Parameters<typeof db.transaction>[0]>[0];

  /** The records of every kind of the Edition changed after the content version, in id order. */
  async function readKinds(tx: Reader, editionId: string, since: number) {
    const changed = (table: (typeof CONTENT_TABLES)[number]) =>
      and(eq(table.editionId, editionId), gt(table.contentVersion, since));
    const words = await tx
      .select({
        id: contentWords.id,
        fields: contentWords.fields,
        needsNewRecording: contentWords.needsNewRecording,
      })
      .from(contentWords)
      .where(changed(contentWords));
    const kinds = {
      words: inIdOrder(words),
      idioms: inIdOrder(
        await tx
          .select({ id: contentIdioms.id, fields: contentIdioms.fields })
          .from(contentIdioms)
          .where(changed(contentIdioms)),
      ),
      corrections: inIdOrder(
        await tx
          .select({ id: contentCorrections.id, fields: contentCorrections.fields })
          .from(contentCorrections)
          .where(changed(contentCorrections)),
      ),
      tips: inIdOrder(
        await tx
          .select({ id: contentTips.id, fields: contentTips.fields })
          .from(contentTips)
          .where(changed(contentTips)),
      ),
      synonymRows: inIdOrder(
        await tx
          .select({ id: contentSynonymRows.id, fields: contentSynonymRows.fields })
          .from(contentSynonymRows)
          .where(changed(contentSynonymRows)),
      ),
      curatedCollections: inIdOrder(
        await tx
          .select({
            id: contentCuratedCollections.id,
            fields: contentCuratedCollections.fields,
          })
          .from(contentCuratedCollections)
          .where(changed(contentCuratedCollections)),
      ),
      crosswordDays: inIdOrder(
        await tx
          .select({ id: contentCrosswordDays.id, fields: contentCrosswordDays.fields })
          .from(contentCrosswordDays)
          .where(changed(contentCrosswordDays)),
      ),
    };
    return { kinds, words };
  }

  /** The Edition's content version, then what `read` makes of it, in one consistent view of every table; none while it is not imported. */
  function atCurrentVersion<T>(
    editionId: string,
    read: (tx: Reader, contentVersion: number) => Promise<T>,
  ) {
    return db.transaction(
      async (tx) => {
        const [held] = await tx
          .select()
          .from(contentVersions)
          .where(eq(contentVersions.editionId, editionId));
        return held === undefined ? undefined : read(tx, held.contentVersion);
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  /** Every record of the Edition at its current content version; none while it is not imported. */
  async function snapshot(editionId: string) {
    if (editions.find(editionId) === undefined) return undefined;
    return atCurrentVersion(editionId, async (tx, contentVersion) => {
      const { kinds, words } = await readKinds(tx, editionId, 0);
      return {
        editionId,
        contentVersion,
        ...kinds,
        needsNewRecording: inIdOrder(
          words.filter((word) => word.needsNewRecording).map(({ id }) => ({ id, fields: id })),
        ),
      };
    });
  }

  /**
   * Every record of the Edition changed after the content version the device
   * holds, and the content version it reaches. A device ahead of the backend
   * gets no record: content versions only grow (ADR 0090).
   */
  async function patch(
    editionId: string,
    since: number,
  ): Promise<
    | { readonly ok: true; readonly patch: Omit<Patch, 'patchFormat'> }
    | { readonly ok: false; readonly reason: 'not-serving' | 'not-imported' }
  > {
    if (!(await editions.serving(editionId, 'contentUpdates')).ok) {
      return { ok: false, reason: 'not-serving' };
    }
    const read = await atCurrentVersion(editionId, async (tx, contentVersion) => ({
      editionId,
      since,
      contentVersion,
      ...(await readKinds(tx, editionId, since)).kinds,
    }));
    return read === undefined ? { ok: false, reason: 'not-imported' } : { ok: true, patch: read };
  }

  /**
   * The Entries of the ids the Edition's tables have and have not retired,
   * at its current content version, in no set order.
   */
  async function entries(editionId: string, ids: readonly string[]): Promise<readonly Entry[]> {
    if (ids.length === 0) return [];
    return db.transaction(
      async (tx) => {
        const live = (table: (typeof ENTRY_TABLES)[number]) =>
          and(
            eq(table.editionId, editionId),
            inArray(table.id, [...ids]),
            eq(table.retired, false),
          );
        const fieldsOf = async <F>(rows: Promise<readonly { readonly fields: F }[]>) =>
          (await rows).map(({ fields }) => fields);
        const [words, corrections, idioms, synonymRows, tips] = [
          await fieldsOf(
            tx.select({ fields: contentWords.fields }).from(contentWords).where(live(contentWords)),
          ),
          await fieldsOf(
            tx
              .select({ fields: contentCorrections.fields })
              .from(contentCorrections)
              .where(live(contentCorrections)),
          ),
          await fieldsOf(
            tx
              .select({ fields: contentIdioms.fields })
              .from(contentIdioms)
              .where(live(contentIdioms)),
          ),
          await fieldsOf(
            tx
              .select({ fields: contentSynonymRows.fields })
              .from(contentSynonymRows)
              .where(live(contentSynonymRows)),
          ),
          await fieldsOf(
            tx.select({ fields: contentTips.fields }).from(contentTips).where(live(contentTips)),
          ),
        ];
        return [...words, ...corrections, ...idioms, ...synonymRows, ...tips];
      },
      // One consistent view of every table.
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  return { importEdition, snapshot, patch, entries };
}

export type ContentStore = ReturnType<typeof createContentStore>;
