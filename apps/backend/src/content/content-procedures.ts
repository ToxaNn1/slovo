import { implement } from '@orpc/server';
import { apiContract, PACK_MEDIA_TYPE } from '@slovo/contracts/api';
import type { ContentPacks, PublishedFile } from '@slovo/server-core';

import { namesEtag } from '../etag';

/** A published content version never changes, so the file may be kept for good. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** The content procedures of the contract, over the server Core's content packs. */
export function contentProcedures(contentPacks: ContentPacks) {
  // The server Core answers one object per published file, so its File is
  // made once and every download sends that one copy of the bytes.
  const packFiles = new WeakMap<PublishedFile, File>();
  const content = implement(apiContract.content);
  return content.router({
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
