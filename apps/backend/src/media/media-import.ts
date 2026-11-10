// The one-off media import (#1770): puts an Edition folder's Recordings and
// Illustrations in the Media Store and writes their media rows, so the
// Recordings job records only what the folder lacks.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { illustrationRefusals } from '@slovo/content-rules';
import type { Clock, Edition } from '@slovo/server-core';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { illustrationKey } from '../content/illustrations';
import {
  createMediaRows,
  type NewIllustration,
  type NewRecording,
  type RecordedWord,
} from '../content/media-rows';
import type { Database } from '../database/database';
import { contentWords, mediaIllustrations, mediaRecordings } from '../database/schema';
import { RECORDING_TEXTS } from '../recordings/recording-text';
import { recordingKey } from '../recordings/recordings';
import type { MediaStore } from './media-store';
import { mp3DurationMs } from './mp3-duration';

export type MediaImport =
  | {
      readonly ok: true;
      readonly recordings: number;
      readonly illustrations: number;
      /** Recordings left out because their Word's text changed since they were made. */
      readonly stale: number;
      readonly contentVersion: number;
    }
  | { readonly ok: false; readonly reason: 'already-imported' | 'not-imported' }
  | { readonly ok: false; readonly reason: 'refused'; readonly problems: readonly string[] };

const RECORDINGS_DIR = 'assets/recordings';
const ILLUSTRATIONS_DIR = 'assets/illustrations';
const TEXTS_FILE = 'texts.json';
/** How many files go to the Media Store at once. */
const UPLOADS_AT_ONCE = 8;

const TextsSchema = z.record(z.string(), z.string());

/** A file the import puts in the Media Store under its key. */
interface Upload {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/** The voice's texts.json: its texts, absent when there is no file, or unreadable. */
function readTexts(
  path: string,
): Record<string, string> | undefined | 'not JSON' | 'not a map of texts' {
  if (!existsSync(path)) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return 'not JSON';
  }
  const texts = TextsSchema.safeParse(json);
  return texts.success ? texts.data : 'not a map of texts';
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const filesOf = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .map(({ name }) => name)
        .sort()
    : [];

export function createMediaImport({
  database,
  clock,
  store,
}: {
  database: Database;
  clock: Clock;
  store: MediaStore;
}) {
  const { db } = database;
  const mediaRows = createMediaRows({ database, clock });

  async function imported(editionId: string) {
    const [recording] = await db
      .select({ id: mediaRecordings.wordId })
      .from(mediaRecordings)
      .where(eq(mediaRecordings.editionId, editionId))
      .limit(1);
    const [illustration] = await db
      .select({ id: mediaIllustrations.wordId })
      .from(mediaIllustrations)
      .where(eq(mediaIllustrations.editionId, editionId))
      .limit(1);
    return recording !== undefined || illustration !== undefined;
  }

  async function upload(uploads: readonly Upload[]) {
    let next = 0;
    const worker = async () => {
      for (let upload = uploads[next++]; upload !== undefined; upload = uploads[next++]) {
        await store.put(upload.key, upload.bytes, upload.contentType);
      }
    };
    await Promise.all(Array.from({ length: UPLOADS_AT_ONCE }, worker));
  }

  /**
   * Imports the folder's media: refuses it whole, before any upload, when a
   * file names no voice or Word of the Edition, is no mp3, an Illustration
   * breaks a content rule or a texts.json is unreadable, and refuses a
   * second run over the Edition unless forced.
   */
  async function run(
    edition: Edition,
    editionDir: string,
    { force }: { force: boolean },
  ): Promise<MediaImport> {
    const editionId = edition.config.id;
    if (!force && (await imported(editionId))) return { ok: false, reason: 'already-imported' };

    const words = new Map(
      (
        await db
          .select({ id: contentWords.id, fields: contentWords.fields })
          .from(contentWords)
          .where(eq(contentWords.editionId, editionId))
      ).map(({ id, fields }) => [id, fields]),
    );
    const voices = new Set(edition.config.narratorVoices.voices.map(({ id }) => id));
    const problems: string[] = [];
    const uploads: Upload[] = [];
    const recorded = new Map<string, RecordedWord>();
    let stale = 0;

    for (const voice of filesOf(join(editionDir, RECORDINGS_DIR))) {
      const voiceDir = `${RECORDINGS_DIR}/${voice}`;
      if (!voices.has(voice)) {
        problems.push(`${voiceDir}: no Narrator Voice "${voice}" in the Edition`);
        continue;
      }
      const textsPath = join(editionDir, voiceDir, TEXTS_FILE);
      const read = readTexts(textsPath);
      if (typeof read === 'string') problems.push(`${voiceDir}/${TEXTS_FILE}: ${read}`);
      const texts = typeof read === 'string' ? undefined : read;
      for (const name of filesOf(join(editionDir, voiceDir))) {
        if (name === TEXTS_FILE) continue;
        const path = `${voiceDir}/${name}`;
        const wordId = name.endsWith('.mp3') ? name.slice(0, -'.mp3'.length) : undefined;
        if (wordId === undefined) {
          problems.push(`${path}: not a Recording file`);
          continue;
        }
        const word = words.get(wordId);
        if (word === undefined) {
          problems.push(`${path}: no Word ${wordId} in the Edition`);
          continue;
        }
        const bytes = new Uint8Array(readFileSync(join(editionDir, path)));
        const durationMs = mp3DurationMs(bytes);
        if (durationMs === undefined) {
          problems.push(`${path}: not an mp3`);
          continue;
        }
        const text = texts?.[wordId];
        if (text === undefined) {
          problems.push(`${path}: no text in ${TEXTS_FILE}`);
          continue;
        }
        if (text !== RECORDING_TEXTS.plain(word)) {
          stale += 1;
          continue;
        }
        const file: NewRecording = {
          wordId,
          narratorVoice: voice,
          recordingKind: 'plain',
          hash: sha256(bytes),
          size: bytes.byteLength,
          durationMs,
        };
        uploads.push({ key: recordingKey(file), bytes, contentType: 'audio/mpeg' });
        const files = recorded.get(wordId)?.files ?? [];
        recorded.set(wordId, {
          wordId,
          read: { lemma: word.lemma, stress: word.stress },
          files: [...files, file],
        });
      }
    }

    const illustrated = new Map(
      [...words].flatMap(([id, { illustration }]) =>
        illustration === undefined ? [] : [[illustration, id] as const],
      ),
    );
    const illustrations: NewIllustration[] = [];
    for (const name of filesOf(join(editionDir, ILLUSTRATIONS_DIR))) {
      const path = `${ILLUSTRATIONS_DIR}/${name}`;
      const wordId = illustrated.get(name);
      if (wordId === undefined) {
        problems.push(`${path}: no Word names this Illustration`);
        continue;
      }
      const bytes = new Uint8Array(readFileSync(join(editionDir, path)));
      const refusals = illustrationRefusals(bytes);
      if (refusals.length > 0) {
        problems.push(...refusals.map(({ message }) => `${path}: ${message}`));
        continue;
      }
      const file = { wordId, hash: sha256(bytes), size: bytes.byteLength };
      uploads.push({ key: illustrationKey(file), bytes, contentType: 'image/png' });
      illustrations.push(file);
    }

    if (problems.length > 0) return { ok: false, reason: 'refused', problems };

    await upload(uploads);
    const saved = await mediaRows.saveMedia(editionId, {
      recorded: [...recorded.values()],
      illustrations,
    });
    if (!saved.ok) return saved;
    return {
      ok: true,
      recordings: uploads.length - illustrations.length,
      illustrations: illustrations.length,
      stale,
      contentVersion: saved.contentVersion,
    };
  }

  return { run };
}
