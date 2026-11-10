/**
 * The Recordings job (ADR 0083, 0099): records every Word of an Edition that
 * misses a live Recording in one of its Narrator Voices and Recording Kinds,
 * or whose Lemma or Stress changed, puts the files in the Media Store and
 * saves their rows at one content version per run. It then deletes the files
 * of rows retired longer than RETIRED_FILE_KEPT_MS, which no device on a
 * Patch that old still asks for.
 */
import { createHash } from 'node:crypto';

import type { RecordingKind, Word } from '@slovo/contracts';
import type { Clock, Edition } from '@slovo/server-core';
import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';

import { createMediaRows, type NewRecording, type RecordedWord } from '../content/media-rows';
import type { Database } from '../database/database';
import { contentWords, mediaIllustrations, mediaRecordings } from '../database/schema';
import type { MediaStore } from '../media/media-store';
import type { RecordingGenerator } from './generator';
import { RECORDING_KINDS, RECORDING_TEXTS } from './recording-text';

/** How long the Media Store keeps the file of a retired row: 30 days. */
export const RETIRED_FILE_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

/** What one run did, summed over the Editions. */
export interface RecordingsRun {
  /** Words that got their Recordings. */
  readonly recorded: number;
  /** Words the generator failed for: the next run tries them again. */
  readonly failed: number;
  /** Files of retired rows deleted from the Media Store. */
  readonly deleted: number;
}

interface Slot {
  readonly narratorVoice: string;
  readonly recordingKind: RecordingKind;
}

/** The Media Store key of a Recording file (ADR 0099). */
export const recordingKey = ({
  narratorVoice,
  recordingKind,
  wordId,
  hash,
}: Pick<NewRecording, 'narratorVoice' | 'recordingKind' | 'wordId' | 'hash'>) =>
  `recordings/${narratorVoice}/${recordingKind}/${wordId}.${hash}.mp3`;

/** The Media Store key of an Illustration file (ADR 0099). */
const illustrationKey = ({ wordId, hash }: { wordId: string; hash: string }) =>
  `illustrations/${wordId}.${hash}.png`;

export function createRecordings({
  database,
  clock,
  store,
  generator,
  editions,
  batch = 50,
}: {
  database: Database;
  clock: Clock;
  store: MediaStore;
  generator: RecordingGenerator;
  editions: readonly Edition[];
  /** The most Words one run records per Edition. */
  batch?: number;
}) {
  const { db } = database;
  const rows = createMediaRows({ database, clock });

  /** The Edition's live Words that need Recordings, each with the slots it misses, in id order. */
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
        flagged: contentWords.needsNewRecording,
      })
      .from(contentWords)
      .where(
        and(
          eq(contentWords.editionId, editionId),
          eq(contentWords.retired, false),
          sql`(${contentWords.needsNewRecording} or ${liveCount} < ${slots})`,
        ),
      )
      .orderBy(asc(contentWords.id))
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

  /** Records the Edition's next batch of Words; how many were recorded and how many failed. */
  async function recordEdition(edition: Edition) {
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
    if (requests.length === 0) return { recorded: 0, failed: 0 };
    const outcomes = await generator.record(requests.map(({ voice, text }) => ({ voice, text })));
    const recorded: RecordedWord[] = [];
    let failed = 0;
    for (const word of words) {
      const own = requests.flatMap((request, index) =>
        request.word === word ? [{ ...request, outcome: outcomes[index] }] : [],
      );
      const files: NewRecording[] = [];
      for (const { slot, outcome } of own) {
        if (outcome?.ok !== true) break;
        const file: NewRecording = {
          wordId: word.id,
          ...slot,
          hash: createHash('sha256').update(outcome.bytes).digest('hex'),
          size: outcome.bytes.byteLength,
          durationMs: outcome.durationMs,
        };
        await store.put(recordingKey(file), outcome.bytes, 'audio/mpeg');
        files.push(file);
      }
      if (files.length < own.length) {
        failed += 1;
        continue;
      }
      recorded.push({ wordId: word.id, read: readOf(word.fields), files });
    }
    await rows.saveRecordings(editionId, recorded);
    return { recorded: recorded.length, failed };
  }

  /** Deletes the files of rows retired before the cutoff; how many. */
  async function deleteRetired() {
    const before = new Date(clock.now().getTime() - RETIRED_FILE_KEPT_MS);
    const dueOf = (table: typeof mediaRecordings | typeof mediaIllustrations) =>
      and(isNotNull(table.retiredAt), lt(table.retiredAt, before), isNull(table.fileDeletedAt));
    const recordings = await db.select().from(mediaRecordings).where(dueOf(mediaRecordings));
    for (const row of recordings) {
      await store.delete(recordingKey(row));
      await db
        .update(mediaRecordings)
        .set({ fileDeletedAt: clock.now() })
        .where(
          and(
            eq(mediaRecordings.editionId, row.editionId),
            eq(mediaRecordings.wordId, row.wordId),
            eq(mediaRecordings.narratorVoice, row.narratorVoice),
            eq(mediaRecordings.recordingKind, row.recordingKind),
            eq(mediaRecordings.hash, row.hash),
          ),
        );
    }
    const illustrations = await db
      .select()
      .from(mediaIllustrations)
      .where(dueOf(mediaIllustrations));
    for (const row of illustrations) {
      await store.delete(illustrationKey(row));
      await db
        .update(mediaIllustrations)
        .set({ fileDeletedAt: clock.now() })
        .where(
          and(
            eq(mediaIllustrations.editionId, row.editionId),
            eq(mediaIllustrations.wordId, row.wordId),
            eq(mediaIllustrations.hash, row.hash),
          ),
        );
    }
    return recordings.length + illustrations.length;
  }

  /**
   * One run: every Edition records its next batch under its own lock, so two
   * runs never record the same Word; an Edition another run holds is skipped.
   */
  async function run(): Promise<RecordingsRun> {
    let recorded = 0;
    let failed = 0;
    for (const edition of editions) {
      const counts = await db.transaction(async (tx) => {
        const { rows: locks } = await tx.execute<{ held: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext(${`recordings:${edition.config.id}`})) as held`,
        );
        return locks[0]?.held === true ? recordEdition(edition) : { recorded: 0, failed: 0 };
      });
      recorded += counts.recorded;
      failed += counts.failed;
    }
    return { recorded, failed, deleted: await deleteRetired() };
  }

  return { run };
}

const readOf = ({ lemma, stress }: Pick<Word, 'lemma' | 'stress'>) => ({ lemma, stress });
