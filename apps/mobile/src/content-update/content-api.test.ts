import { createApiClient, PACK_MEDIA_TYPE } from '@slovo/contracts/api';
import { describe, expect, it } from 'vitest';

import { createContentApi } from './content-api';

const fileSha256 = 'a'.repeat(64);

/** The content API of the Ukrainian Edition over a backend that answers each request with `answer`. */
function contentApiAnswering(answer: (request: Request) => Promise<Response>) {
  const requests: string[] = [];
  const contentApi = createContentApi({
    client: createApiClient({
      url: 'http://backend.test',
      fetch: (request) => {
        requests.push(new URL(request.url).pathname + new URL(request.url).search);
        return answer(request);
      },
    }),
    editionId: 'uk',
    readBytes: async (file) => new Uint8Array(await file.arrayBuffer()),
  });
  return { contentApi, requests };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );

/** The answer of the backend to a failure it reports with its code and status. */
const failure = (code: string, status: number) =>
  json({ defined: true, code, status, message: code }, status);

describe('the content API over the contract’s client', () => {
  it('asks for the newest pack of the Edition in the pack format', async () => {
    const pack = { contentVersion: 5, packFormat: 1, size: 2048, fileSha256 };
    const { contentApi, requests } = contentApiAnswering(() => json({ pack }));

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: true, pack });
    expect(requests).toEqual(['/v1/editions/uk/content/latest?packFormat=1']);
  });

  it('answers no pack when nothing of the pack format is published', async () => {
    const { contentApi } = contentApiAnswering(() => json({ pack: null }));

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: true, pack: undefined });
  });

  it('downloads the bytes of the pack file of a content version', async () => {
    const bytes = Uint8Array.from([83, 81, 76, 105, 116, 101]);
    const { contentApi, requests } = contentApiAnswering(() =>
      Promise.resolve(
        new Response(bytes, {
          headers: {
            'content-type': PACK_MEDIA_TYPE,
            etag: `"${fileSha256}"`,
            'cache-control': 'public, max-age=31536000, immutable',
          },
        }),
      ),
    );

    await expect(contentApi.download(5)).resolves.toEqual({ ok: true, bytes });
    expect(requests).toEqual(['/v1/editions/uk/content/packs/5']);
  });

  it.each([
    ['not-found', 'NOT_FOUND', 404],
    ['too-many-requests', 'TOO_MANY_REQUESTS', 429],
    ['server-error', 'INTERNAL', 500],
    ['server-error', 'BAD_GATEWAY', 502],
  ] as const)('answers %s when the backend answers %s', async (reason, code, status) => {
    const { contentApi } = contentApiAnswering(() => failure(code, status));

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason });
  });

  it('answers offline when no answer comes', async () => {
    const { contentApi } = contentApiAnswering(() =>
      Promise.reject(new TypeError('Network request failed')),
    );

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason: 'offline' });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('answers unexpected when the backend refuses the request', async () => {
    const { contentApi } = contentApiAnswering(() => failure('BAD_REQUEST', 400));

    await expect(contentApi.latest(1)).resolves.toEqual({ ok: false, reason: 'unexpected' });
    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });

  it('answers unexpected when a download answers with no file', async () => {
    const { contentApi } = contentApiAnswering(() =>
      Promise.resolve(
        new Response(null, {
          status: 304,
          headers: { etag: `"${fileSha256}"`, 'cache-control': 'public, max-age=31536000' },
        }),
      ),
    );

    await expect(contentApi.download(5)).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });
});
