import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { EditionConfig } from '@slovo/contracts';
import type { ContentSnapshot } from '@slovo/contracts/api';
import { illustrationPath, recordingPath } from '@slovo/contracts';
import { z } from 'zod';

/** How many Words of the default Mix the app bundles the media of (ADR 0099). */
export const STARTER_WORDS = 300;

/** The Edition folder's git-ignored folder of the Starter Media, downloaded at build time. */
export const STARTER_MEDIA_DIR = 'starter-media';

/** The list in that folder, written once every file of it is there. */
const LIST_FILE = 'list.json';

const StarterFileSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('recording'),
    wordId: z.string(),
    voice: z.string(),
    path: z.string(),
    url: z.string(),
    size: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('illustration'),
    wordId: z.string(),
    path: z.string(),
    url: z.string(),
    size: z.number().int().positive(),
  }),
]);

const StarterMediaListSchema = z.strictObject({
  /** The default Narrator Voice, whose Recordings of the Starter Words the app bundles. */
  voice: z.string(),
  /** The first {@link STARTER_WORDS} live Words of the default Mix, in id order. */
  wordIds: z.array(z.string()),
  /** The Word the voice screen reads, bundled in every voice. */
  sampleWordId: z.string(),
  files: z.array(StarterFileSchema),
});

/** A file of the Media Store the app bundles. */
export type StarterFile = z.infer<typeof StarterFileSchema>;

/** The Starter Media of an Edition (ADR 0099): its Words, its voice and every file it bundles. */
export type StarterMediaList = z.infer<typeof StarterMediaListSchema>;

/**
 * The Starter Media of an Edition from a snapshot: the default voice's
 * Recordings of the first 300 live Words of the default Mix, the sample
 * Word's in every voice, and those Words' Illustrations. A Word whose text
 * changed since its Recordings bundles none, as the app plays none.
 */
export function starterMediaOf(config: EditionConfig, snapshot: ContentSnapshot): StarterMediaList {
  const { categories } = config.userSettingDefaults.mix;
  const voice = config.narratorVoices.default;
  const sampleWordId = config.narratorVoices.sample.word;
  const wordIds = snapshot.words
    .filter((word) => !word.retired)
    .filter((word) => categories === 'all' || categories.includes(word.categoryId))
    .map((word) => word.id)
    .slice(0, STARTER_WORDS);
  const starters = new Set(wordIds);
  const changed = new Set(snapshot.needsNewRecording);
  const base = snapshot.mediaBase.replace(/\/+$/, '');
  const recordings: StarterFile[] = snapshot.recordings
    .filter((row) => !row.retired && !changed.has(row.wordId))
    .filter(
      (row) =>
        row.wordId === sampleWordId || (row.narratorVoice === voice && starters.has(row.wordId)),
    )
    .map((row) => {
      const path = recordingPath(row);
      return {
        kind: 'recording',
        wordId: row.wordId,
        voice: row.narratorVoice,
        path,
        url: `${base}/${path}`,
        size: row.size,
      };
    });
  const illustrations: StarterFile[] = snapshot.illustrations
    .filter((row) => !row.retired && (starters.has(row.wordId) || row.wordId === sampleWordId))
    .map((row) => {
      const path = illustrationPath(row);
      return {
        kind: 'illustration',
        wordId: row.wordId,
        path,
        url: `${base}/${path}`,
        size: row.size,
      };
    });
  return { voice, wordIds, sampleWordId, files: [...recordings, ...illustrations] };
}

/** Downloads a file of the Media Store whole. */
export type MediaDownload = (url: string) => Promise<Uint8Array>;

/**
 * Downloads the Starter Media into `dir`, each file at its Media Store path,
 * and writes the list last, so the folder holds a list only once every file
 * of it is there. A file already there at its size stays: its name carries
 * its hash.
 */
export async function downloadStarterMedia(
  list: StarterMediaList,
  dir: string,
  download: MediaDownload,
): Promise<void> {
  for (const file of list.files) {
    const target = join(dir, file.path);
    if (existsSync(target) && statSync(target).size === file.size) continue;
    const bytes = await download(file.url);
    if (bytes.length !== file.size)
      throw new Error(
        `The download of ${file.url} ended at ${String(bytes.length)} of ${String(file.size)} bytes`,
      );
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(`${target}.part`, bytes);
    renameSync(`${target}.part`, target);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, LIST_FILE), `${JSON.stringify(list, null, 2)}\n`);
}

/**
 * The bundled files of the Starter Media, as absolute paths by Media Store
 * path: the path carries the hash, so the app bundles a file only for the row
 * it was cut from.
 */
export type StarterMediaFiles = Readonly<Record<string, string>>;

/**
 * The Starter Media files in `dir` that Metro bundles; none when the folder
 * has no list yet (the Language Pack build writes it).
 */
export function starterMediaFiles(dir: string): StarterMediaFiles {
  const listFile = join(dir, LIST_FILE);
  if (!existsSync(listFile)) return {};
  const list = StarterMediaListSchema.parse(JSON.parse(readFileSync(listFile, 'utf8')));
  return Object.fromEntries(list.files.map((file) => [file.path, join(dir, file.path)]));
}
