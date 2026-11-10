import type { IllustrationRow, RecordingKind, RecordingRow } from '@slovo/contracts';
import type { Clock } from '@slovo/server-core';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';

import type { Database } from '../database/database';
import { contentVersions, mediaIllustrations, mediaRecordings } from '../database/schema';

type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/** A new Recording file of a Word, already in the Media Store under its hash. */
export interface NewRecording {
  readonly wordId: string;
  readonly narratorVoice: string;
  readonly recordingKind: RecordingKind;
  readonly hash: string;
  readonly size: number;
  readonly durationMs: number;
}

/** A new Illustration file of a Word, already in the Media Store under its hash. */
export interface NewIllustration {
  readonly wordId: string;
  readonly hash: string;
  readonly size: number;
}

export type MediaWrite =
  | { readonly ok: true; readonly contentVersion: number }
  | { readonly ok: false; readonly reason: 'not-imported' };

/**
 * The Edition's media rows (ADR 0099): a saved file becomes its Word's live
 * row and retires the one it replaces, raising the content version in the
 * same transaction, so the next Patch carries both.
 */
export function createMediaRows({ database, clock }: { database: Database; clock: Clock }) {
  const { db } = database;

  /**
   * Runs the write under the Edition's write lock, the one content writes
   * take, and raises the content version once when it changed a row.
   */
  function write(
    editionId: string,
    change: (tx: Transaction, version: number, now: Date) => Promise<boolean>,
  ): Promise<MediaWrite> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${editionId}))`);
      const [held] = await tx
        .select({ contentVersion: contentVersions.contentVersion })
        .from(contentVersions)
        .where(eq(contentVersions.editionId, editionId))
        .for('update');
      if (held === undefined) return { ok: false, reason: 'not-imported' } as const;
      const now = clock.now();
      const next = held.contentVersion + 1;
      if (!(await change(tx, next, now))) return { ok: true, contentVersion: held.contentVersion };
      await tx
        .update(contentVersions)
        .set({ contentVersion: next, updatedAt: now })
        .where(eq(contentVersions.editionId, editionId));
      return { ok: true, contentVersion: next };
    });
  }

  /** Makes the file the live Recording of its Word, voice and Kind. */
  function saveRecording(editionId: string, file: NewRecording) {
    return write(editionId, async (tx, version, now) => {
      const slot = and(
        eq(mediaRecordings.editionId, editionId),
        eq(mediaRecordings.wordId, file.wordId),
        eq(mediaRecordings.narratorVoice, file.narratorVoice),
        eq(mediaRecordings.recordingKind, file.recordingKind),
      );
      const [live] = await tx
        .select({ hash: mediaRecordings.hash })
        .from(mediaRecordings)
        .where(and(slot, isNull(mediaRecordings.retiredAt)));
      if (live?.hash === file.hash) return false;
      await tx
        .update(mediaRecordings)
        .set({ retiredAt: now, contentVersion: version })
        .where(and(slot, isNull(mediaRecordings.retiredAt)));
      await tx
        .insert(mediaRecordings)
        .values({ editionId, ...file, createdAt: now, retiredAt: null, contentVersion: version })
        .onConflictDoUpdate({
          target: [
            mediaRecordings.editionId,
            mediaRecordings.wordId,
            mediaRecordings.narratorVoice,
            mediaRecordings.recordingKind,
            mediaRecordings.hash,
          ],
          set: { retiredAt: null, contentVersion: version },
        });
      return true;
    });
  }

  /** Makes the file the live Illustration of its Word. */
  function saveIllustration(editionId: string, file: NewIllustration) {
    return write(editionId, async (tx, version, now) => {
      const slot = and(
        eq(mediaIllustrations.editionId, editionId),
        eq(mediaIllustrations.wordId, file.wordId),
      );
      const [live] = await tx
        .select({ hash: mediaIllustrations.hash })
        .from(mediaIllustrations)
        .where(and(slot, isNull(mediaIllustrations.retiredAt)));
      if (live?.hash === file.hash) return false;
      await tx
        .update(mediaIllustrations)
        .set({ retiredAt: now, contentVersion: version })
        .where(and(slot, isNull(mediaIllustrations.retiredAt)));
      await tx
        .insert(mediaIllustrations)
        .values({ editionId, ...file, createdAt: now, retiredAt: null, contentVersion: version })
        .onConflictDoUpdate({
          target: [
            mediaIllustrations.editionId,
            mediaIllustrations.wordId,
            mediaIllustrations.hash,
          ],
          set: { retiredAt: null, contentVersion: version },
        });
      return true;
    });
  }

  return { saveRecording, saveIllustration };
}

export type MediaRows = ReturnType<typeof createMediaRows>;

/**
 * The media rows of the Edition changed after the content version, live and
 * retired, in Word id order and, within a Word, retired first then by hash.
 */
export async function readMediaRows(
  tx: Pick<Transaction, 'select'>,
  editionId: string,
  since: number,
): Promise<{ recordings: RecordingRow[]; illustrations: IllustrationRow[] }> {
  const recordings = await tx
    .select()
    .from(mediaRecordings)
    .where(and(eq(mediaRecordings.editionId, editionId), gt(mediaRecordings.contentVersion, since)))
    .orderBy(
      asc(mediaRecordings.wordId),
      asc(mediaRecordings.narratorVoice),
      asc(mediaRecordings.recordingKind),
      sql`${mediaRecordings.retiredAt} is null`,
      asc(mediaRecordings.hash),
    );
  const illustrations = await tx
    .select()
    .from(mediaIllustrations)
    .where(
      and(
        eq(mediaIllustrations.editionId, editionId),
        gt(mediaIllustrations.contentVersion, since),
      ),
    )
    .orderBy(
      asc(mediaIllustrations.wordId),
      sql`${mediaIllustrations.retiredAt} is null`,
      asc(mediaIllustrations.hash),
    );
  return {
    recordings: recordings.map((row) => ({
      wordId: row.wordId,
      narratorVoice: row.narratorVoice,
      recordingKind: row.recordingKind,
      hash: row.hash,
      size: row.size,
      durationMs: row.durationMs,
      retired: row.retiredAt !== null,
    })),
    illustrations: illustrations.map((row) => ({
      wordId: row.wordId,
      hash: row.hash,
      size: row.size,
      retired: row.retiredAt !== null,
    })),
  };
}
