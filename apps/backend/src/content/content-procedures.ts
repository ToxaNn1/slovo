import { implement } from '@orpc/server';
import { apiContract, PACK_MEDIA_TYPE, PATCH_FORMAT } from '@slovo/contracts/api';
import type { ContentPacks, PublishedFile } from '@slovo/server-core';

import { namesEtag } from '../etag';
import type { ContentStore } from './content-store';

/** A published content version never changes, so the file may be kept for good. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** A Patch changes with every edit, so the device revalidates it by its ETag each time. */
const PATCH_CACHE_CONTROL = 'no-cache';

/** The content procedures of the contract, over the server Core's content packs and the content tables. */
export function contentProcedures(contentPacks: ContentPacks, contentStore: ContentStore) {
  // The server Core answers one object per published file, so its File is
  // made once and every download sends that one copy of the bytes.
  const packFiles = new WeakMap<PublishedFile, File>();
  const content = implement(apiContract.content);
  return content.router({
    snapshot: content.snapshot.handler(async ({ input, errors }) => {
      const snapshot = await contentStore.snapshot(input.editionId);
      if (snapshot === undefined) throw errors.NOT_FOUND();
      return snapshot;
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
        body: { status: 'patch' as const, patch: { ...patch, patchFormat: PATCH_FORMAT } },
      };
    }),

    latest: content.latest.handler(async ({ input, errors }) => {
      const latest = await contentPacks.latest(input.editionId, input.packFormat);
      if (!latest.ok) throw errors.NOT_FOUND();
      return { pack: latest.pack ?? null };
    }),

    download: content.download.handler(async ({ input, errors }) => {
      const { editionId, contentVersion } = input.params;
      const download = await contentPacks.download(editionId, contentVersion);
      if (!download.ok) throw errors.NOT_FOUND();
      const { file } = download;
      const headers = { etag: `"${file.fileSha256}"`, 'cache-control': IMMUTABLE_CACHE_CONTROL };
      if (namesEtag(input.headers?.['if-none-match'], headers.etag)) {
        return { status: 304 as const, headers };
      }
      let body = packFiles.get(file);
      if (body === undefined) {
        const name = `language-pack-${editionId}-${String(contentVersion)}.db`;
        // A part of a File sits on an ArrayBuffer; the File keeps its own copy.
        body = new File([file.bytes.slice()], name, { type: PACK_MEDIA_TYPE });
        packFiles.set(file, body);
      }
      return { status: 200 as const, headers, body };
    }),
  });
}
