import type { PublishedPack } from '@slovo/contracts';

import type { EditionRegistry } from '../edition/edition-registry';
import type { Clock, ContentPackStore, PackFile } from '../ports';

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
   * when nothing of that format is published. An Edition the backend didn't
   * find is `unknown-edition`.
   */
  latest(
    editionId: string,
    packFormat: number,
  ): Promise<
    | { readonly ok: true; readonly pack: PublishedPack | undefined }
    | { readonly ok: false; readonly reason: 'unknown-edition' }
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

export function createContentPacks({
  editions,
  store,
  clock,
}: {
  editions: EditionRegistry;
  store: ContentPackStore;
  clock: Clock;
}): ContentPacks {
  return {
    async latest(editionId, packFormat) {
      if (editions.find(editionId) === undefined) return { ok: false, reason: 'unknown-edition' };
      return { ok: true, pack: await store.latest(editionId, packFormat) };
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
