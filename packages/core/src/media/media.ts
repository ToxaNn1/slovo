import type { Patch } from '@slovo/contracts/api';

import type { Clock, ContentStore, MediaCache, MediaFetcher, WordMedia } from '../ports';

/** The most the media cache keeps, in bytes (ADR 0099). */
export const MEDIA_CACHE_LIMIT = 100 * 1024 * 1024;

/** How many Feed cards ahead the prefetch downloads (ADR 0099). */
export const PREFETCH_CARDS = 20;

/** The Feature Switches the media of a Word card follows. */
export type MediaSwitch = 'pronunciation' | 'illustrations' | 'narratorVoice';

/**
 * Where a Recording or an Illustration of a Word card comes from: a file the
 * app bundles (Starter Media), one the media cache holds, one in the Media
 * Store not downloaded yet, or none, which the device voice reads instead.
 */
export type MediaSource<Asset> =
  | { readonly kind: 'bundled'; readonly asset: Asset }
  | { readonly kind: 'cached'; readonly uri: string }
  | { readonly kind: 'remote'; readonly url: string }
  | { readonly kind: 'absent' };

/** The Recording and the Illustration of a Word card. */
export interface CardMedia<Asset> {
  readonly recording: MediaSource<Asset>;
  readonly illustration: MediaSource<Asset>;
}

/** The files the app bundles as Starter Media, by Word id (and voice, for a Recording). */
export interface StarterMedia<Asset> {
  recording(wordId: string, voice: string): Asset | undefined;
  illustration(wordId: string): Asset | undefined;
}

/** The Core media module: what a card shows and plays, what to download ahead and what to drop. */
export interface Media<Asset> {
  ofWord(wordId: string): Promise<CardMedia<Asset>>;
  /** Downloads the missing media of the next Feed cards, the first {@link PREFETCH_CARDS} of those given. */
  prefetch(wordIds: readonly string[]): Promise<void>;
  /** Downloads a Word's Recording not yet cached, as a tap on it does, and answers its source. */
  downloadRecording(wordId: string): Promise<MediaSource<Asset>>;
  /** Marks a Word's cached Recording played or Illustration shown, so the cache evicts it later. */
  used(wordId: string, media: 'recording' | 'illustration'): Promise<void>;
  /** Evicts the files of the rows a Patch applied retired. */
  patchApplied(patch: Patch): Promise<void>;
}

/** A file of the Media Store a card needs: its path, its URL and its size. */
interface StoredFile {
  readonly path: string;
  readonly url: string;
  readonly size: number;
}

function recordingPath(wordId: string, voice: string, kind: string, hash: string): string {
  return `recordings/${voice}/${kind}/${wordId}.${hash}.mp3`;
}

function illustrationPath(wordId: string, hash: string): string {
  return `illustrations/${wordId}.${hash}.png`;
}

export function createMedia<Asset>({
  store,
  cache,
  fetcher,
  starter,
  clock,
  voice,
  defaultVoice,
  isOn,
}: {
  store: Pick<ContentStore, 'mediaOf'>;
  cache: MediaCache;
  fetcher: MediaFetcher;
  starter: StarterMedia<Asset>;
  clock: Clock;
  /** The Narrator Voice the reader chose. */
  voice: () => string;
  defaultVoice: string;
  isOn: (name: MediaSwitch) => boolean;
}): Media<Asset> {
  const chosenVoice = () => (isOn('narratorVoice') ? voice() : defaultVoice);

  function fileOf(media: WordMedia, path: string, size: number): StoredFile {
    return { path, url: `${media.mediaBase.replace(/\/+$/, '')}/${path}`, size };
  }

  /** The Media Store files of a Word card, undefined where it has none or bundles one. */
  function storedFiles(wordId: string, media: WordMedia) {
    const narrator = chosenVoice();
    // `plain` is the one Recording Kind so far; each later Kind brings its own Feature Switch.
    const row = media.recordings.find((r) => r.narratorVoice === narrator);
    const picture = media.illustrations[0];
    return {
      voice: narrator,
      recording:
        row === undefined
          ? undefined
          : fileOf(media, recordingPath(wordId, narrator, row.recordingKind, row.hash), row.size),
      illustration:
        picture === undefined
          ? undefined
          : fileOf(media, illustrationPath(wordId, picture.hash), picture.size),
    };
  }

  async function sourceOf(
    bundled: Asset | undefined,
    file: StoredFile | undefined,
  ): Promise<MediaSource<Asset>> {
    if (bundled !== undefined) return { kind: 'bundled', asset: bundled };
    if (file === undefined) return { kind: 'absent' };
    const uri = await cache.get(file.path);
    if (uri !== undefined) return { kind: 'cached', uri };
    return { kind: 'remote', url: file.url };
  }

  /** The files a card needs downloaded: each its switch allows and the Starter Media doesn't bundle. */
  async function wanted(wordId: string): Promise<StoredFile[]> {
    const media = await store.mediaOf(wordId);
    const files = storedFiles(wordId, media);
    const wants: StoredFile[] = [];
    if (
      files.recording !== undefined &&
      isOn('pronunciation') &&
      !media.needsNewRecording &&
      starter.recording(wordId, files.voice) === undefined
    )
      wants.push(files.recording);
    if (
      files.illustration !== undefined &&
      isOn('illustrations') &&
      starter.illustration(wordId) === undefined
    )
      wants.push(files.illustration);
    return wants;
  }

  /** Evicts the least recently used files until the cache keeps at most its limit. */
  async function trim(): Promise<void> {
    const files = [...(await cache.files())].sort(
      (a, b) => a.usedAt.getTime() - b.usedAt.getTime(),
    );
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= MEDIA_CACHE_LIMIT) return;
      await cache.evict(file.path);
      total -= file.size;
    }
  }

  /** Downloads a file whole into the cache; a short or failed download leaves the cache as it was. */
  async function fetchInto(file: StoredFile): Promise<void> {
    const bytes = await fetcher.download(file.url);
    if (bytes.length !== file.size)
      throw new Error(
        `The download of ${file.url} ended at ${String(bytes.length)} of ${String(file.size)} bytes`,
      );
    await cache.put(file.path, bytes, clock.now());
    await trim();
  }

  async function ofWord(wordId: string): Promise<CardMedia<Asset>> {
    const media = await store.mediaOf(wordId);
    const files = storedFiles(wordId, media);
    return {
      recording:
        isOn('pronunciation') && !media.needsNewRecording
          ? await sourceOf(starter.recording(wordId, files.voice), files.recording)
          : { kind: 'absent' },
      illustration: isOn('illustrations')
        ? await sourceOf(starter.illustration(wordId), files.illustration)
        : { kind: 'absent' },
    };
  }

  return {
    ofWord,
    async prefetch(wordIds) {
      for (const wordId of wordIds.slice(0, PREFETCH_CARDS)) {
        for (const file of await wanted(wordId)) {
          if ((await cache.get(file.path)) !== undefined) continue;
          try {
            await fetchInto(file);
          } catch {
            // A failed download leaves the file remote; the next prefetch or a tap tries again.
          }
        }
      }
    },
    async downloadRecording(wordId) {
      const { recording } = await ofWord(wordId);
      if (recording.kind !== 'remote') return recording;
      const file = storedFiles(wordId, await store.mediaOf(wordId)).recording;
      if (file !== undefined) await fetchInto(file);
      return (await ofWord(wordId)).recording;
    },
    async used(wordId, kind) {
      const file = storedFiles(wordId, await store.mediaOf(wordId))[kind];
      if (file !== undefined && (await cache.get(file.path)) !== undefined)
        await cache.touch(file.path, clock.now());
    },
    async patchApplied(patch) {
      const retired = [
        ...patch.recordings
          .filter((row) => row.retired)
          .map((row) => recordingPath(row.wordId, row.narratorVoice, row.recordingKind, row.hash)),
        ...patch.illustrations
          .filter((row) => row.retired)
          .map((row) => illustrationPath(row.wordId, row.hash)),
      ];
      for (const path of retired) await cache.evict(path);
    },
  };
}
