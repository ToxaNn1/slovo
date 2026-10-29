import type { PublishedPack } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, ContentPackStore, PackFile, PublishedFile } from '../ports';

/**
 * Why a pack is not published: its Edition is not one the backend found;
 * its content checksum is not the one the Edition's manifest records, which
 * is also the case for a pack of another Edition;
 * its content version is not higher than one already published for the
 * Edition; or that version is already published (ADR 0011, 0032).
 */
export type PublishRefusal =
  'unknown-edition' | 'not-recorded' | 'version-not-higher' | 'already-published';

/** The Language Packs the backend publishes for content updates. */
export interface ContentPacks {
  /**
   * The newest published pack of the Edition in the pack format, or none
   * when nothing of that format is published. An Edition that doesn't serve
   * content updates is refused, here and in `download`.
   */
  latest(
    editionId: string,
    packFormat: number,
  ): Promise<{ readonly ok: true; readonly pack: PublishedPack | undefined } | NotServing>;
  /**
   * The file of the Edition's pack published at the content version. A
   * published version never changes, so the files of the Edition's 2 newest
   * versions downloaded are read from the store once and kept in memory: a
   * release that every device downloads at once reads it once, and every
   * download of it answers that one object. An older version is read again.
   */
  download(
    editionId: string,
    contentVersion: number,
  ): Promise<
    | { readonly ok: true; readonly file: PublishedFile }
    | NotServing
    | { readonly ok: false; readonly reason: 'not-published' }
  >;
  /**
   * Publishes a built pack of the Edition, and answers it as
   * `content.latest` will announce it. Two different packs never share a
   * content version, and a published pack never changes.
   */
  publish(
    editionId: string,
    file: PackFile,
  ): Promise<
    | { readonly ok: true; readonly pack: PublishedPack }
    | { readonly ok: false; readonly reason: PublishRefusal }
  >;
}

/**
 * How many published files of an Edition the server keeps in memory: those of
 * its newest content versions downloaded: the latest one, and the one before
 * it, which devices that asked before a release, or apps of an older pack
 * format, still download. An older one is read again.
 */
const KEPT_FILES = 2;

export function createContentPacks({
  editions,
  store,
  clock,
}: {
  editions: EditionRegistry;
  store: ContentPackStore;
  clock: Clock;
}): ContentPacks {
  // The published files of the newest content versions read so far, by
  // Edition, and so at most `KEPT_FILES` per Edition. A download that comes
  // while its file is being read waits for that read.
  const files = new Map<string, Map<number, Promise<PublishedFile | undefined>>>();

  function publishedFile(editionId: string, contentVersion: number) {
    const kept = files.get(editionId) ?? new Map<number, Promise<PublishedFile | undefined>>();
    files.set(editionId, kept);
    const keptRead = kept.get(contentVersion);
    if (keptRead !== undefined) return keptRead;
    const read = store.file(editionId, contentVersion);
    kept.set(contentVersion, read);
    // Only a published file stays, so a version not published pushes no
    // file out: it may be published later, and a read that failed is tried
    // again. A published one pushes out the oldest version kept.
    const forget = () => {
      if (kept.get(contentVersion) === read) kept.delete(contentVersion);
    };
    read.then((file) => {
      if (file === undefined) forget();
      else if (kept.size > KEPT_FILES) kept.delete(Math.min(...kept.keys()));
    }, forget);
    return read;
  }

  return {
    async latest(editionId, packFormat) {
      const serving = await editions.serving(editionId, 'contentUpdates');
      if (!serving.ok) return serving;
      return { ok: true, pack: await store.latest(editionId, packFormat) };
    },

    async download(editionId, contentVersion) {
      const serving = await editions.serving(editionId, 'contentUpdates');
      if (!serving.ok) return serving;
      const file = await publishedFile(editionId, contentVersion);
      if (file === undefined) return { ok: false, reason: 'not-published' };
      return { ok: true, file };
    },

    async publish(editionId, file) {
      const { metadata } = file;
      const edition = editions.find(editionId);
      if (edition === undefined) return { ok: false, reason: 'unknown-edition' };
      // The checksum covers the Edition and the version, so a recorded
      // checksum is the Edition's pack at the recorded version.
      if (metadata.contentChecksum !== edition.manifest.contentChecksum) {
        return { ok: false, reason: 'not-recorded' };
      }
      const refusal = await store.publish(
        { ...file, publishedAt: clock.now() },
        (publishedVersions): PublishRefusal | undefined => {
          if (publishedVersions.includes(metadata.contentVersion)) return 'already-published';
          if (publishedVersions.some((version) => version > metadata.contentVersion)) {
            return 'version-not-higher';
          }
          return undefined;
        },
      );
      if (refusal !== undefined) return { ok: false, reason: refusal };
      return {
        ok: true,
        pack: {
          contentVersion: metadata.contentVersion,
          packFormat: metadata.packFormat,
          size: file.bytes.byteLength,
          fileSha256: file.fileSha256,
        },
      };
    },
  };
}
