import type { PublishedPack } from '@slovo/contracts';

import type { EditionRegistry } from '../edition/edition-registry';
import type { ContentPackStore } from '../ports';

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
}

export function createContentPacks({
  editions,
  store,
}: {
  editions: EditionRegistry;
  store: ContentPackStore;
}): ContentPacks {
  return {
    async latest(editionId, packFormat) {
      if (editions.find(editionId) === undefined) return { ok: false, reason: 'unknown-edition' };
      return { ok: true, pack: await store.latest(editionId, packFormat) };
    },
  };
}
