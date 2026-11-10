import { createHash } from 'node:crypto';

import { illustrationRefusals, recordFileOf } from '@slovo/content-rules';
import { illustrationPath } from '@slovo/contracts';
import type { Clock, EditionRegistry } from '@slovo/server-core';
import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../database/database';
import { contentWords, mediaIllustrations } from '../database/schema';
import type { MediaStore } from '../media/media-store';
import type { WriteRefusal } from './content-writes';
import { createMediaRows } from './media-rows';

/** A Word's live Illustration, at its file in the Media Store. */
export interface LiveIllustration {
  readonly hash: string;
  readonly url: string;
}

export type IllustrationUpload =
  | { readonly ok: true; readonly contentVersion: number; readonly illustration: LiveIllustration }
  | WriteRefusal;

/**
 * The Illustrations the content editor saves (ADR 0055, 0099): a file is
 * checked by the content rules where it is saved, kept in the Media Store
 * under its content hash and made its Word's live Illustration, which the
 * next Patch carries.
 */
export function createIllustrations({
  database,
  clock,
  editions,
  mediaStore,
  mediaBase,
}: {
  database: Database;
  clock: Clock;
  editions: EditionRegistry;
  mediaStore: MediaStore;
  /** The URL root of the Media Store (ADR 0099). */
  mediaBase: string;
}) {
  const { db } = database;
  const mediaRows = createMediaRows({ database, clock });
  const liveOf = (wordId: string, hash: string): LiveIllustration => ({
    hash,
    url: `${mediaBase}/${illustrationPath({ wordId, hash })}`,
  });

  /** Checks the file and makes it the Word's live Illustration; nothing is written when it is refused. */
  async function upload(
    editionId: string,
    wordId: string,
    bytes: Uint8Array,
  ): Promise<IllustrationUpload> {
    if (editions.find(editionId) === undefined) return { ok: false, reason: 'not-found' };
    const refusals = illustrationRefusals(bytes);
    if (refusals.length > 0) {
      return {
        ok: false,
        reason: 'refused',
        refusals: refusals.map((refusal) => ({
          ...refusal,
          file: recordFileOf('word', wordId),
          entryId: wordId,
          field: 'illustration',
        })),
      };
    }
    const [word] = await db
      .select({ retired: contentWords.retired })
      .from(contentWords)
      .where(and(eq(contentWords.editionId, editionId), eq(contentWords.id, wordId)));
    if (word === undefined || word.retired) return { ok: false, reason: 'not-found' };
    const hash = createHash('sha256').update(bytes).digest('hex');
    await mediaStore.put(illustrationPath({ wordId, hash }), bytes, 'image/png');
    const saved = await mediaRows.saveIllustration(editionId, {
      wordId,
      hash,
      size: bytes.byteLength,
    });
    if (!saved.ok) return saved;
    return { ok: true, contentVersion: saved.contentVersion, illustration: liveOf(wordId, hash) };
  }

  /** The Word's live Illustration, or undefined when it has none. */
  async function live(editionId: string, wordId: string): Promise<LiveIllustration | undefined> {
    const [row] = await db
      .select({ hash: mediaIllustrations.hash })
      .from(mediaIllustrations)
      .where(
        and(
          eq(mediaIllustrations.editionId, editionId),
          eq(mediaIllustrations.wordId, wordId),
          isNull(mediaIllustrations.retiredAt),
        ),
      );
    return row === undefined ? undefined : liveOf(wordId, row.hash);
  }

  return { upload, live };
}

export type Illustrations = ReturnType<typeof createIllustrations>;
