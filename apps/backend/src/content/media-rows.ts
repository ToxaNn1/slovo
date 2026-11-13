import type { IllustrationRow, RecordingKind, RecordingRow, Word } from '@slovo/contracts';
import type { Clock } from '@slovo/server-core';
import { and, asc, eq, gt, gte, isNull, or, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../database/database';
import {
  contentVersions,
  contentWords,
  mediaIllustrations,
  mediaRecordings,
} from '../database/schema';

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

/** A Word's new Recording files, with the Lemma and Stress they read. */
export interface RecordedWord {
  readonly wordId: string;
  readonly read: Pick<Word, 'lemma' | 'stress'>;
  readonly files: readonly NewRecording[];
}

/** A new Illustration file of a Word, already in the Media Store under its hash. */
export interface NewIllustration {
  readonly wordId: string;
  readonly hash: string;
  readonly size: number;
}

export type MediaWrite =
  | {
      readonly ok: true;
      readonly contentVersion: number;
      /** The Words whose Recordings were saved. */
      readonly recorded: readonly string[];
      /** The Words whose Illustration was saved. */
      readonly illustrated: readonly string[];
    }
  | { readonly ok: false; readonly reason: 'not-imported' };

/**
 * The files to save, put in the Media Store from `putSince` on. A file whose
 * row had its file deleted since then is gone from the store again, so its
 * row is not made live: its Word is not saved.
 */
export interface MediaFiles {
  readonly recorded: readonly RecordedWord[];
  readonly illustrations: readonly NewIllustration[];
  readonly putSince: Date;
}

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
    change: (
      tx: Transaction,
      version: number,
      now: Date,
    ) => Promise<{ recorded: string[]; illustrated: string[]; changed: boolean }>,
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
      const { changed, recorded, illustrated } = await change(tx, next, now);
      if (!changed) return { ok: true, contentVersion: held.contentVersion, recorded, illustrated };
      await tx
        .update(contentVersions)
        .set({ contentVersion: next, updatedAt: now })
        .where(eq(contentVersions.editionId, editionId));
      return { ok: true, contentVersion: next, recorded, illustrated };
    });
  }

  /** Makes the file the live Recording of its Word, voice and Kind. */
  function saveRecording(editionId: string, file: NewRecording) {
    return write(editionId, async (tx, version, now) => ({
      recorded: [file.wordId],
      illustrated: [],
      changed: await saveRecordingRow(tx, editionId, file, version, now),
    }));
  }

  /**
   * Makes each Word's files its live Recordings and clears its «needs new
   * Recordings» flag, raising the content version once for the lot. A Word
   * whose Lemma or Stress changed since the files were made, or that was
   * retired meanwhile, keeps what it has: the next run records it again.
   */
  function saveRecordings(editionId: string, words: readonly RecordedWord[], putSince: Date) {
    return saveMedia(editionId, { recorded: words, illustrations: [], putSince });
  }

  /** Makes the file the live Illustration of its Word, unless the Word is retired or gone. */
  function saveIllustration(editionId: string, file: NewIllustration, putSince: Date) {
    return saveMedia(editionId, { recorded: [], illustrations: [file], putSince });
  }

  /**
   * Saves Recordings as `saveRecordings` does and makes each Illustration its
   * Word's live one, raising the content version once for them all.
   */
  function saveMedia(editionId: string, { recorded, illustrations, putSince }: MediaFiles) {
    return write(editionId, async (tx, version, now) => {
      let changed = false;
      const saved: { recorded: string[]; illustrated: string[] } = {
        recorded: [],
        illustrated: [],
      };
      const liveWord = async (wordId: string) => {
        const [current] = await tx
          .select({ fields: contentWords.fields, retired: contentWords.retired })
          .from(contentWords)
          .where(and(eq(contentWords.editionId, editionId), eq(contentWords.id, wordId)));
        return current === undefined || current.retired ? undefined : current.fields;
      };
      for (const word of recorded) {
        const fields = await liveWord(word.wordId);
        if (fields === undefined || readsDifferently(fields, word.read)) continue;
        if (await anyDeletedSince(tx, mediaRecordings, editionId, word.files, putSince)) continue;
        saved.recorded.push(word.wordId);
        for (const file of word.files) {
          if (await saveRecordingRow(tx, editionId, file, version, now)) changed = true;
        }
        await tx
          .update(contentWords)
          .set({ needsNewRecording: false })
          .where(and(eq(contentWords.editionId, editionId), eq(contentWords.id, word.wordId)));
      }
      for (const file of illustrations) {
        if ((await liveWord(file.wordId)) === undefined) continue;
        if (await anyDeletedSince(tx, mediaIllustrations, editionId, [file], putSince)) continue;
        saved.illustrated.push(file.wordId);
        if (await saveIllustrationRow(tx, editionId, file, version, now)) changed = true;
      }
      return { ...saved, changed };
    });
  }

  return { saveRecording, saveRecordings, saveIllustration, saveMedia };
}

/** Whether a Word's Recordings, made from `read`, no longer read its fields (ADR 0083). */
export function readsDifferently(
  fields: Pick<Word, 'lemma' | 'stress'>,
  read: Pick<Word, 'lemma' | 'stress'>,
): boolean {
  return (
    fields.lemma !== read.lemma || JSON.stringify(fields.stress) !== JSON.stringify(read.stress)
  );
}

/**
 * Whether a row of one of the files had its file deleted from `since` on:
 * the sweep removed the key after the file was put, and a save that made the
 * row live again would point at nothing.
 */
async function anyDeletedSince(
  tx: Transaction,
  table: typeof mediaRecordings | typeof mediaIllustrations,
  editionId: string,
  files: readonly { readonly wordId: string; readonly hash: string }[],
  since: Date,
): Promise<boolean> {
  if (files.length === 0) return false;
  const [deleted] = await tx
    .select({ hash: table.hash })
    .from(table)
    .where(
      and(
        eq(table.editionId, editionId),
        gte(table.fileDeletedAt, since),
        or(...files.map((file) => and(eq(table.wordId, file.wordId), eq(table.hash, file.hash)))),
      ),
    )
    .limit(1);
  return deleted !== undefined;
}

/**
 * Retires the live row of the slot at the version unless it is the file's
 * already; false when it is, and the file needs no row.
 */
async function retireLiveRow(
  tx: Transaction,
  table: typeof mediaRecordings | typeof mediaIllustrations,
  slot: SQL | undefined,
  { hash, version, now }: { hash: string; version: number; now: Date },
): Promise<boolean> {
  const live = and(slot, isNull(table.retiredAt));
  const [current] = await tx.select({ hash: table.hash }).from(table).where(live);
  if (current?.hash === hash) return false;
  await tx.update(table).set({ retiredAt: now, contentVersion: version }).where(live);
  return true;
}

/** Makes the file the live row of its slot, retiring the one it replaces; false when it already is. */
async function saveRecordingRow(
  tx: Transaction,
  editionId: string,
  file: NewRecording,
  version: number,
  now: Date,
): Promise<boolean> {
  const slot = and(
    eq(mediaRecordings.editionId, editionId),
    eq(mediaRecordings.wordId, file.wordId),
    eq(mediaRecordings.narratorVoice, file.narratorVoice),
    eq(mediaRecordings.recordingKind, file.recordingKind),
  );
  if (!(await retireLiveRow(tx, mediaRecordings, slot, { hash: file.hash, version, now }))) {
    return false;
  }
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
      set: { retiredAt: null, fileDeletedAt: null, contentVersion: version },
    });
  return true;
}

/** Makes the file its Word's live Illustration, retiring the one it replaces; false when it already is. */
async function saveIllustrationRow(
  tx: Transaction,
  editionId: string,
  file: NewIllustration,
  version: number,
  now: Date,
): Promise<boolean> {
  const slot = and(
    eq(mediaIllustrations.editionId, editionId),
    eq(mediaIllustrations.wordId, file.wordId),
  );
  if (!(await retireLiveRow(tx, mediaIllustrations, slot, { hash: file.hash, version, now }))) {
    return false;
  }
  await tx
    .insert(mediaIllustrations)
    .values({ editionId, ...file, createdAt: now, retiredAt: null, contentVersion: version })
    .onConflictDoUpdate({
      target: [mediaIllustrations.editionId, mediaIllustrations.wordId, mediaIllustrations.hash],
      set: { retiredAt: null, fileDeletedAt: null, contentVersion: version },
    });
  return true;
}

/**
 * Retires every live Recording of the Word at the content version, in the
 * transaction of the write that changed its Lemma or Stress (ADR 0083), so
 * the same Patch carries the Word and its retired Recordings.
 */
export async function retireRecordings(
  tx: Pick<Transaction, 'update'>,
  {
    editionId,
    wordId,
    version,
    now,
  }: { editionId: string; wordId: string; version: number; now: Date },
): Promise<void> {
  await tx
    .update(mediaRecordings)
    .set({ retiredAt: now, contentVersion: version })
    .where(
      and(
        eq(mediaRecordings.editionId, editionId),
        eq(mediaRecordings.wordId, wordId),
        isNull(mediaRecordings.retiredAt),
      ),
    );
}

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

/**
 * The media gaps of the live Words (ADR 0099): per Narrator Voice, how many
 * have no live Recording in it, and how many have no live Illustration.
 */
export async function mediaGaps(
  tx: Pick<Transaction, 'select'>,
  editionId: string,
  { wordIds, voices }: { wordIds: readonly string[]; voices: readonly string[] },
) {
  const recorded = await tx
    .select({
      wordId: mediaRecordings.wordId,
      narratorVoice: mediaRecordings.narratorVoice,
    })
    .from(mediaRecordings)
    .where(and(eq(mediaRecordings.editionId, editionId), isNull(mediaRecordings.retiredAt)));
  const illustrated = await tx
    .select({ wordId: mediaIllustrations.wordId })
    .from(mediaIllustrations)
    .where(and(eq(mediaIllustrations.editionId, editionId), isNull(mediaIllustrations.retiredAt)));
  const live = new Set(wordIds);
  const recordedIn = (voice: string) =>
    new Set(
      recorded
        .filter((row) => row.narratorVoice === voice && live.has(row.wordId))
        .map((row) => row.wordId),
    );
  const withIllustration = new Set(
    illustrated.map((row) => row.wordId).filter((id) => live.has(id)),
  );
  return {
    withoutRecording: voices.map((narratorVoice) => ({
      narratorVoice,
      words: live.size - recordedIn(narratorVoice).size,
    })),
    withoutIllustration: live.size - withIllustration.size,
  };
}
