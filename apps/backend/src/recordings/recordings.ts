/**
 * The Recordings job (ADR 0083, 0099): records every Word of an Edition that
 * misses a live Recording in one of its Narrator Voices and Recording Kinds,
 * or whose Lemma or Stress changed, puts the files in the Media Store and
 * saves their rows at one content version per run. It then deletes the files
 * of rows retired longer than RETIRED_FILE_KEPT_MS, which no device on a
 * Patch that old still asks for. After STALL_RUNS runs in a row whose
 * generator made no file of the Words it had, it tells the owner and stops for the Edition until
 * its content or the job's deployment changes (ADR 0169).
 */
import { createHash, randomUUID } from 'node:crypto';

import { illustrationPath, recordingPath, type RecordingKind, type Word } from '@slovo/contracts';
import type { Alerts, Clock, Edition } from '@slovo/server-core';
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, sql, type SQL } from 'drizzle-orm';

import { createMediaRows, type NewRecording, type RecordedWord } from '../content/media-rows';
import type { Database } from '../database/database';
import {
  contentVersions,
  contentWords,
  mediaIllustrations,
  mediaRecordings,
  recordingLeases,
  recordingStalls,
} from '../database/schema';
import type { MediaStore } from '../media/media-store';
import type { RecordingGenerator, RecordingOutcome } from './generator';
import { RECORDING_KINDS, RECORDING_TEXTS } from './recording-text';

type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/** How long the Media Store keeps the file of a retired row: 30 days. */
export const RETIRED_FILE_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

/** How long a run's lease on an Edition lasts before another run may take it: 30 minutes. */
export const RECORDING_LEASE_MS = 30 * 60 * 1000;

/** How many runs in a row whose generator made no file of the Words it had stop the job for an Edition. */
export const STALL_RUNS = 2;

/** What one run did, summed over the Editions. */
export interface RecordingsRun {
  /** Words that got their Recordings. */
  readonly recorded: number;
  /** Words the generator failed for: the next run tries them again. */
  readonly failed: number;
  /** Editions skipped because the job stopped for them. */
  readonly stalled: number;
  /** Files of retired rows deleted from the Media Store. */
  readonly deleted: number;
}

interface Slot {
  readonly narratorVoice: string;
  readonly recordingKind: RecordingKind;
}

export function createRecordings({
  database,
  clock,
  store,
  generator,
  editions,
  alerts,
  deployment,
  batch = 50,
}: {
  database: Database;
  clock: Clock;
  store: MediaStore;
  generator: RecordingGenerator;
  editions: readonly Edition[];
  /** Where the owner hears that the job stopped for an Edition. */
  alerts: Alerts;
  /** The job's deployment: a new one tries an Edition the job stopped for again. */
  deployment: string;
  /** The most Words one run records per Edition. */
  batch?: number;
}) {
  const { db } = database;
  const rows = createMediaRows({ database, clock });

  /**
   * The Edition's live Words that need Recordings, each with the slots it
   * misses: the Words the job never failed for first, in id order, then the
   * ones it failed for, longest ago first, so a Word that always fails never
   * holds the batch.
   */
  async function candidates(editionId: string, voices: readonly string[]) {
    const slots = voices.length * RECORDING_KINDS.length;
    const liveCount = sql`(select count(*) from ${mediaRecordings} r
      where r.edition_id = ${contentWords.editionId} and r.word_id = ${contentWords.id}
        and r.retired_at is null
        and r.narrator_voice in (${sql.join(
          voices.map((voice) => sql`${voice}`),
          sql`, `,
        )})
        and r.recording_kind in (${sql.join(
          RECORDING_KINDS.map((kind) => sql`${kind}`),
          sql`, `,
        )}))`;
    const words = await db
      .select({
        id: contentWords.id,
        fields: contentWords.fields,
      })
      .from(contentWords)
      .where(
        and(
          eq(contentWords.editionId, editionId),
          eq(contentWords.retired, false),
          sql`(${contentWords.needsNewRecording} or ${liveCount} < ${slots})`,
        ),
      )
      .orderBy(sql`${contentWords.recordingFailedAt} asc nulls first`, asc(contentWords.id))
      .limit(batch);
    if (words.length === 0) return [];
    const held = await db
      .select({
        wordId: mediaRecordings.wordId,
        narratorVoice: mediaRecordings.narratorVoice,
        recordingKind: mediaRecordings.recordingKind,
      })
      .from(mediaRecordings)
      .where(
        and(
          eq(mediaRecordings.editionId, editionId),
          inArray(
            mediaRecordings.wordId,
            words.map(({ id }) => id),
          ),
          isNull(mediaRecordings.retiredAt),
        ),
      );
    const all: Slot[] = voices.flatMap((narratorVoice) =>
      RECORDING_KINDS.map((recordingKind) => ({ narratorVoice, recordingKind })),
    );
    const slotOf = (wordId: string, { narratorVoice, recordingKind }: Slot) =>
      `${wordId}/${narratorVoice}/${recordingKind}`;
    const live = new Set(held.map((row) => slotOf(row.wordId, row)));
    return words.map((word) => {
      const missing = all.filter((slot) => !live.has(slotOf(word.id, slot)));
      // A flagged Word with every slot live reads text it no longer has: record it all again.
      return { ...word, slots: missing.length === 0 ? all : missing };
    });
  }

  const leaseEnd = () => new Date(clock.now().getTime() + RECORDING_LEASE_MS);

  /** Takes the Edition's lease for the holder when no run holds it or its lease expired; whether it did. */
  async function takeLease(editionId: string, holder: string) {
    const taken = await db
      .insert(recordingLeases)
      .values({ editionId, holder, expiresAt: leaseEnd() })
      .onConflictDoUpdate({
        target: recordingLeases.editionId,
        set: { holder, expiresAt: leaseEnd() },
        setWhere: lte(recordingLeases.expiresAt, clock.now()),
      })
      .returning({ holder: recordingLeases.holder });
    return taken.length > 0;
  }

  /** Extends the holder's lease; false when another run took it over. */
  async function renewLease(editionId: string, holder: string) {
    const renewed = await db
      .update(recordingLeases)
      .set({ expiresAt: leaseEnd() })
      .where(and(eq(recordingLeases.editionId, editionId), eq(recordingLeases.holder, holder)))
      .returning({ holder: recordingLeases.holder });
    return renewed.length > 0;
  }

  async function releaseLease(editionId: string, holder: string) {
    await db
      .delete(recordingLeases)
      .where(and(eq(recordingLeases.editionId, editionId), eq(recordingLeases.holder, holder)));
  }

  /**
   * Records the Edition's next batch of Words; how many were recorded, how
   * many failed, and whether the generator made no file of them at all.
   * Nothing is written when the holder lost its lease while the generator read.
   */
  async function recordEdition(edition: Edition, holder: string) {
    const editionId = edition.config.id;
    const voices = edition.config.narratorVoices.voices.map(({ id }) => id);
    const words = await candidates(editionId, voices);
    const requests = words.flatMap((word) =>
      word.slots.map((slot) => ({
        word,
        slot,
        voice: slot.narratorVoice,
        text: RECORDING_TEXTS[slot.recordingKind](word.fields),
      })),
    );
    if (requests.length === 0) return { recorded: 0, failed: 0, empty: false };
    const putSince = clock.now();
    // A generator that throws fails the whole batch: its Words go to the back of the queue.
    const outcomes: readonly (RecordingOutcome | undefined)[] = await generator
      .record(requests.map(({ voice, text }) => ({ voice, text })))
      .catch((error: unknown) => {
        console.error(
          `recordings: the generator failed for ${editionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return requests.map(() => ({ ok: false }) satisfies RecordingOutcome);
      });
    const empty = outcomes.every((outcome) => outcome?.ok !== true);
    if (!(await renewLease(editionId, holder))) return { recorded: 0, failed: 0, empty: false };
    const made: RecordedWord[] = [];
    for (const word of words) {
      const own = requests.flatMap((request, index) =>
        request.word === word ? [{ ...request, outcome: outcomes[index] }] : [],
      );
      const files: { file: NewRecording; bytes: Uint8Array }[] = [];
      for (const { slot, outcome } of own) {
        if (outcome?.ok !== true) break;
        files.push({
          file: {
            wordId: word.id,
            ...slot,
            hash: createHash('sha256').update(outcome.bytes).digest('hex'),
            size: outcome.bytes.byteLength,
            durationMs: outcome.durationMs,
          },
          bytes: outcome.bytes,
        });
      }
      // A Word puts nothing unless every slot of it was made.
      if (files.length < own.length) continue;
      for (const { file, bytes } of files)
        await store.put(recordingPath(file), bytes, 'audio/mpeg');
      made.push({
        wordId: word.id,
        read: readOf(word.fields),
        files: files.map(({ file }) => file),
      });
    }
    const saved = await rows.saveRecordings(editionId, made, putSince);
    const recorded = saved.ok ? saved.recorded : [];
    await markFailures(editionId, words, recorded);
    return { recorded: recorded.length, failed: words.length - recorded.length, empty };
  }

  async function stallOf(editionId: string) {
    const [version] = await db
      .select({ contentVersion: contentVersions.contentVersion })
      .from(contentVersions)
      .where(eq(contentVersions.editionId, editionId));
    const [row] = await db
      .select()
      .from(recordingStalls)
      .where(eq(recordingStalls.editionId, editionId));
    const contentVersion = version?.contentVersion ?? 0;
    // A count kept at another deployment or content version starts again.
    const emptyRuns =
      row?.deployment === deployment && row.contentVersion === contentVersion ? row.emptyRuns : 0;
    return { contentVersion, emptyRuns };
  }

  /** Counts a run whose generator made no file; tells the owner once the job stops. */
  async function countEmptyRun(editionId: string) {
    const { contentVersion, emptyRuns } = await stallOf(editionId);
    const runs = emptyRuns + 1;
    await db
      .insert(recordingStalls)
      .values({ editionId, emptyRuns: runs, deployment, contentVersion })
      .onConflictDoUpdate({
        target: recordingStalls.editionId,
        set: { emptyRuns: runs, deployment, contentVersion },
      });
    if (runs === STALL_RUNS) await alerts.send({ kind: 'recordings-stalled', editionId, runs });
  }

  /** Stamps the Words the run failed for, and clears the stamp of the ones it recorded. */
  async function markFailures(
    editionId: string,
    words: readonly { readonly id: string }[],
    recorded: readonly string[],
  ) {
    const done = new Set(recorded);
    const stamp = async (ids: string[], recordingFailedAt: Date | null) => {
      if (ids.length === 0) return;
      await db
        .update(contentWords)
        .set({ recordingFailedAt })
        .where(and(eq(contentWords.editionId, editionId), inArray(contentWords.id, ids)));
    };
    await stamp(
      words.filter(({ id }) => !done.has(id)).map(({ id }) => id),
      clock.now(),
    );
    await stamp([...done], null);
  }

  /**
   * Deletes the files of rows retired before the cutoff; how many. Each row
   * is stamped under its Edition's write lock, the one a save that re-lives
   * it takes, and only while it is still due, so a row a save re-lived keeps
   * its file.
   */
  async function deleteRetired() {
    const before = new Date(clock.now().getTime() - RETIRED_FILE_KEPT_MS);
    const dueOf = (table: typeof mediaRecordings | typeof mediaIllustrations) =>
      and(isNotNull(table.retiredAt), lt(table.retiredAt, before), isNull(table.fileDeletedAt));
    const locked = (editionId: string, sweep: (tx: Transaction) => Promise<boolean>) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${editionId}))`);
        return sweep(tx);
      });
    // Under its Edition's lock, while the row is still due, deletes its file and
    // then stamps the row: a time taken after the delete, so a save that put the
    // same file before the delete landed finds it deleted since then.
    const sweep = async (
      table: typeof mediaRecordings | typeof mediaIllustrations,
      row: { editionId: string; wordId: string; hash: string },
      slot: SQL | undefined,
      path: string,
    ) =>
      locked(row.editionId, async (tx) => {
        const of = and(
          eq(table.editionId, row.editionId),
          eq(table.wordId, row.wordId),
          eq(table.hash, row.hash),
          slot,
          dueOf(table),
        );
        const [due] = await tx.select({ hash: table.hash }).from(table).where(of);
        if (due === undefined) return false;
        await store.delete(path);
        await tx.update(table).set({ fileDeletedAt: clock.now() }).where(of);
        return true;
      });
    let deleted = 0;
    for (const row of await db.select().from(mediaRecordings).where(dueOf(mediaRecordings))) {
      const slot = and(
        eq(mediaRecordings.narratorVoice, row.narratorVoice),
        eq(mediaRecordings.recordingKind, row.recordingKind),
      );
      if (await sweep(mediaRecordings, row, slot, recordingPath(row))) deleted += 1;
    }
    for (const row of await db.select().from(mediaIllustrations).where(dueOf(mediaIllustrations))) {
      if (await sweep(mediaIllustrations, row, undefined, illustrationPath(row))) deleted += 1;
    }
    return deleted;
  }

  /**
   * One run: every Edition records its next batch under the run's lease on
   * it, so two runs never record the same Word; an Edition another run holds
   * is skipped until that lease expires.
   */
  async function run(): Promise<RecordingsRun> {
    const holder = randomUUID();
    let recorded = 0;
    let failed = 0;
    let stalled = 0;
    for (const edition of editions) {
      const editionId = edition.config.id;
      if ((await stallOf(editionId)).emptyRuns >= STALL_RUNS) {
        console.error(
          `recordings: stopped for ${editionId} until its content or the deployment changes`,
        );
        stalled += 1;
        continue;
      }
      if (!(await takeLease(editionId, holder))) continue;
      try {
        const counts = await recordEdition(edition, holder);
        recorded += counts.recorded;
        failed += counts.failed;
        if (counts.empty) await countEmptyRun(editionId);
        // The generator made a file: the job is not stuck, and the count starts again.
        else if (counts.recorded + counts.failed > 0)
          await db.delete(recordingStalls).where(eq(recordingStalls.editionId, editionId));
      } finally {
        await releaseLease(editionId, holder);
      }
    }
    return { recorded, failed, stalled, deleted: await deleteRetired() };
  }

  return { run };
}

const readOf = ({ lemma, stress }: Pick<Word, 'lemma' | 'stress'>) => ({ lemma, stress });
