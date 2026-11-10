import type { IllustrationRow, RecordingRow } from '@slovo/contracts';
import type { WordMedia } from '@slovo/core';

import type { Statement } from './record-rows';

/** The `metadata` key of the URL root of the Edition's Media Store (ADR 0099). */
export const MEDIA_BASE = 'media_base';

const SQL = {
  recording: `INSERT INTO media_recordings (word_id, narrator_voice, recording_kind, hash, size, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (word_id, narrator_voice, recording_kind, hash) DO UPDATE SET size = excluded.size, duration_ms = excluded.duration_ms`,
  retireRecording:
    'DELETE FROM media_recordings WHERE word_id = ? AND narrator_voice = ? AND recording_kind = ? AND hash = ?',
  illustration: `INSERT INTO media_illustrations (word_id, hash, size) VALUES (?, ?, ?)
    ON CONFLICT (word_id, hash) DO UPDATE SET size = excluded.size`,
  retireIllustration: 'DELETE FROM media_illustrations WHERE word_id = ? AND hash = ?',
  mediaBase:
    'INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
} as const;

/**
 * The statements that bring the pack's live media rows in step with the rows
 * given and keep the media base: a live row is added, a retired one leaves
 * the pack, so the pack holds the live set alone.
 */
export function mediaStatements({
  mediaBase,
  recordings,
  illustrations,
}: {
  mediaBase: string;
  recordings: readonly RecordingRow[];
  illustrations: readonly IllustrationRow[];
}): Statement[] {
  return [
    ...recordings.map(
      ({ wordId, narratorVoice, recordingKind, hash, size, durationMs, retired }) =>
        retired
          ? { sql: SQL.retireRecording, params: [wordId, narratorVoice, recordingKind, hash] }
          : {
              sql: SQL.recording,
              params: [wordId, narratorVoice, recordingKind, hash, size, durationMs],
            },
    ),
    ...illustrations.map(({ wordId, hash, size, retired }) =>
      retired
        ? { sql: SQL.retireIllustration, params: [wordId, hash] }
        : { sql: SQL.illustration, params: [wordId, hash, size] },
    ),
    { sql: SQL.mediaBase, params: [MEDIA_BASE, mediaBase] },
  ];
}

interface RecordingRecord {
  word_id: string;
  narrator_voice: string;
  recording_kind: RecordingRow['recordingKind'];
  hash: string;
  size: number;
  duration_ms: number;
}

interface IllustrationRecord {
  word_id: string;
  hash: string;
  size: number;
}

/** What reads the pack's rows: a transaction, or any SQLite driver of the same shape. */
interface MediaReader {
  getAllAsync<T>(sql: string, params: string[]): Promise<T[]>;
}

/** The live Recording and Illustration rows of a Word, each kind in a steady order, with the media base and its mark. */
export async function mediaOf(db: MediaReader, wordId: string): Promise<WordMedia> {
  // One read after the other: a transaction runs one statement at a time.
  const [base] = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM metadata WHERE key = ?',
    [MEDIA_BASE],
  );
  if (base === undefined) throw new Error('The pack has no media base');
  const marked = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM words WHERE id = ? AND needs_new_recording = 1',
    [wordId],
  );
  const recordings = await db.getAllAsync<RecordingRecord>(
    `SELECT word_id, narrator_voice, recording_kind, hash, size, duration_ms FROM media_recordings
        WHERE word_id = ? ORDER BY narrator_voice, recording_kind, hash`,
    [wordId],
  );
  const illustrations = await db.getAllAsync<IllustrationRecord>(
    'SELECT word_id, hash, size FROM media_illustrations WHERE word_id = ? ORDER BY hash',
    [wordId],
  );
  return {
    mediaBase: base.value,
    needsNewRecording: marked.length > 0,
    recordings: recordings.map((row) => ({
      wordId: row.word_id,
      narratorVoice: row.narrator_voice,
      recordingKind: row.recording_kind,
      hash: row.hash,
      size: row.size,
      durationMs: row.duration_ms,
    })),
    illustrations: illustrations.map((row) => ({
      wordId: row.word_id,
      hash: row.hash,
      size: row.size,
    })),
  };
}
