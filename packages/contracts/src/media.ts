import { z } from 'zod';

import { NarratorVoiceSchema } from './edition';
import { WordIdSchema } from './shared';

/** How a Recording reads its Word; `plain` is the Lemma in its first Stress, the one Kind so far. */
export const RecordingKindSchema = z.enum(['plain']);

export type RecordingKind = z.infer<typeof RecordingKindSchema>;

/** What every media row has: the file in the Media Store is named by its Word id and hash. */
const mediaRowFields = {
  wordId: WordIdSchema,
  /** The SHA-256 of the file, in lowercase hex. */
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'Expected a SHA-256 in lowercase hex'),
  /** The file's size in bytes. */
  size: z.number().int().positive(),
  /** A retired row has left the live set: no device shows or plays its file any more. */
  retired: z.boolean(),
};

/** One Recording of a Word, as a snapshot and a Patch carry it (ADR 0099). */
export const RecordingRowSchema = z.strictObject({
  ...mediaRowFields,
  narratorVoice: NarratorVoiceSchema.shape.id,
  recordingKind: RecordingKindSchema,
  durationMs: z.number().int().positive(),
});

export type RecordingRow = z.infer<typeof RecordingRowSchema>;

/** One Illustration of a Word, as a snapshot and a Patch carry it (ADR 0099). */
export const IllustrationRowSchema = z.strictObject(mediaRowFields);

export type IllustrationRow = z.infer<typeof IllustrationRowSchema>;

/** A Recording's path in the Media Store, named by its Word id and hash (ADR 0099). */
export const recordingPath = ({
  wordId,
  narratorVoice,
  recordingKind,
  hash,
}: Pick<RecordingRow, 'wordId' | 'narratorVoice' | 'recordingKind' | 'hash'>): string =>
  `recordings/${narratorVoice}/${recordingKind}/${wordId}.${hash}.mp3`;

/** An Illustration's path in the Media Store, named by its Word id and hash (ADR 0099). */
export const illustrationPath = ({
  wordId,
  hash,
}: Pick<IllustrationRow, 'wordId' | 'hash'>): string => `illustrations/${wordId}.${hash}.png`;
