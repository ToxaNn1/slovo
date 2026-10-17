import { createApiClient, PACK_MEDIA_TYPE } from '@slovo/contracts/api';
import { failingWith, serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { createContentApi } from './content-api';

const fileSha256 = 'a'.repeat(64);

/** What a published pack file answers besides its bytes. */
const packFileHeaders = {
  etag: `"${fileSha256}"`,
  'cache-control': 'public, max-age=31536000, immutable',
};

/** The content API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const contentApiServedBy = (procedures: ApiProcedures) => contentApiOver(serveApi(procedures));

/** The content API of the Ukrainian Edition over whatever `fetch` reaches. */
const contentApiOver = (fetch: (request: Request) => Promise<Response>) =>
  createContentApi({
    client: createApiClient({ url: 'http://backend.test', fetch }),
    editionId: 'uk',
    readBytes: async (file) => new Uint8Array(await file.arrayBuffer()),
  });

describe('the content API over the contract’s client', () => {
  it('asks for the newest pack of the Edition in the pack format', async () => {
    const pack = { contentVersion: 5, packFormat: 1, size: 2048, fileSha256 };
    const asked: unknown[] = [];
    const contentApi = contentApiServedBy({
      content: {
        latest: ({ input }) => {
          asked.push(input);
          return { pack };
        },
      },
    });

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: true, pack });
    expect(asked).toEqual([{ editionId: 'uk', packFormat: 1 }]);
  });

  it('answers no pack when nothing of the pack format is published', async () => {
    const contentApi = contentApiServedBy({ content: { latest: () => ({ pack: null }) } });

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: true, pack: undefined });
  });

  it('downloads the bytes of the pack file of a content version', async () => {
    const bytes = Uint8Array.from([83, 81, 76, 105, 116, 101]);
    const asked: unknown[] = [];
    const contentApi = contentApiServedBy({
      content: {
        download: ({ input }) => {
          asked.push(input.params);
          const body = new File([bytes], 'language-pack-uk-5.db', { type: PACK_MEDIA_TYPE });
          return { status: 200, headers: packFileHeaders, body };
        },
      },
    });

    await expect(contentApi.download(5)).resolves.toEqual({ ok: true, bytes });
    expect(asked).toEqual([{ editionId: 'uk', contentVersion: 5 }]);
  });

  it.each([
    ['not-found', 'NOT_FOUND'],
    ['too-many-requests', 'TOO_MANY_REQUESTS'],
    ['unexpected', 'BAD_REQUEST'],
  ] as const)('answers %s when the backend answers %s', async (reason, code) => {
    const contentApi = contentApiServedBy(failingWith(code));

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason });
  });

  it('answers a server error when the backend fails', async () => {
    const contentApi = contentApiServedBy({});

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason: 'server-error' });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it('answers a server error when a proxy answers 502', async () => {
    const contentApi = contentApiOver(() =>
      Promise.resolve(new Response('<h1>502 Bad Gateway</h1>', { status: 502 })),
    );

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason: 'server-error' });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it('answers offline when no answer comes', async () => {
    const contentApi = contentApiOver(() =>
      Promise.reject(new TypeError('Network request failed')),
    );

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason: 'offline' });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('answers unexpected when a download answers with no file', async () => {
    const contentApi = contentApiServedBy({
      content: { download: () => ({ status: 304, headers: packFileHeaders }) },
    });

    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });
});
