import { implement } from '@orpc/server';
import { apiContract, PATCH_FORMAT } from '@slovo/contracts/api';
import type { EditionRegistry } from '@slovo/server-core';

import { namesEtag } from '../etag';
import type { ContentStore } from './content-store';

/**
 * The CDN keeps a Patch for a minute, keyed by its URL (the Edition and the
 * device's content version), so most devices never reach the database; the
 * device revalidates it by its ETag each time. An edit reaches every device
 * within that minute, with no purge (ADR 0099).
 */
const PATCH_CACHE_CONTROL = 'public, max-age=0, s-maxage=60';

/** The content procedures of the contract, over the Editions and the content tables. */
export function contentProcedures(
  editions: EditionRegistry,
  contentStore: ContentStore,
  /** The URL root of the Media Store the snapshot and the Patch name (ADR 0099). */
  mediaBase: string,
) {
  const content = implement(apiContract.content);
  return content.router({
    snapshot: content.snapshot.handler(async ({ input, errors }) => {
      const snapshot = await contentStore.snapshot(input.editionId);
      if (snapshot === undefined) throw errors.NOT_FOUND();
      return { ...snapshot, mediaBase };
    }),

    patch: content.patch.handler(async ({ input, errors }) => {
      const { editionId } = input.params;
      const { since, patchFormat } = input.query;
      // The backend serves the one Patch format it writes; the app keeps its content.
      if (patchFormat !== PATCH_FORMAT) {
        return {
          status: 200 as const,
          headers: {
            etag: `"unsupported.p${String(PATCH_FORMAT)}"`,
            'cache-control': PATCH_CACHE_CONTROL,
          },
          body: { status: 'unsupported-format' as const, patchFormat: PATCH_FORMAT },
        };
      }
      const read = await contentStore.patch(editionId, since);
      if (!read.ok) throw errors.NOT_FOUND();
      const { patch } = read;
      // The answer to any version the device holds brings it to this one, so
      // the ETag names the content version reached and the format.
      const etag = `"${editionId}.${String(patch.contentVersion)}.p${String(PATCH_FORMAT)}"`;
      const headers = { etag, 'cache-control': PATCH_CACHE_CONTROL };
      if (namesEtag(input.headers?.['if-none-match'], etag)) {
        return { status: 304 as const, headers };
      }
      return {
        status: 200 as const,
        headers,
        body: { status: 'patch' as const, patch: { ...patch, mediaBase, patchFormat: PATCH_FORMAT } },
      };
    }),

    // Content reaches the app as Patches; no whole pack is published any
    // more, and /v1 keeps both procedures for apps in the field (ADR 0031, 0090).
    latest: content.latest.handler(async ({ input, errors }) => {
      if (!(await editions.serving(input.editionId, 'contentUpdates')).ok) throw errors.NOT_FOUND();
      return { pack: null };
    }),

    download: content.download.handler(({ errors }) => {
      throw errors.NOT_FOUND();
    }),
  });
}
