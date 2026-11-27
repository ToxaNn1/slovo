import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PoliteClient, type FetchResponse } from './polite-client';

/** A client over a network that gives each answer in turn, and the addresses it was asked. */
function clientAnswering(...answers: FetchResponse[]) {
  const asked: string[] = [];
  const cacheDir = mkdtempSync(join(tmpdir(), 'slovo-polite-'));
  const client = () =>
    new PoliteClient(
      (url) => {
        asked.push(url);
        const answer = answers[asked.length - 1];
        return answer === undefined
          ? Promise.reject(new Error('No more answers'))
          : Promise.resolve(answer);
      },
      { now: () => 0, sleep: () => Promise.resolve() },
      cacheDir,
      0,
    );
  return { client, asked };
}

const URL = 'https://goroh.pp.ua/Тлумачення/слово';

describe('PoliteClient', () => {
  it('asks again for a page that answered 404, also from a later run', async () => {
    const { client, asked } = clientAnswering(
      { status: 404, body: 'Not found' },
      { status: 200, body: 'Слово.' },
    );

    expect(await client().get(URL)).toEqual({ status: 404, body: 'Not found' });
    expect(await client().get(URL)).toEqual({ status: 200, body: 'Слово.' });
    expect(asked).toEqual([URL, URL]);
  });

  it('keeps a 404 when asked to, so a later run does not ask again', async () => {
    const { client, asked } = clientAnswering(
      { status: 404, body: 'Not found' },
      { status: 200, body: 'Слово.' },
    );

    expect(await client().get(URL, { keepNotFound: true })).toEqual({
      status: 404,
      body: 'Not found',
    });
    expect(await client().get(URL, { keepNotFound: true })).toEqual({
      status: 404,
      body: 'Not found',
    });
    expect(asked).toEqual([URL]);
  });

  it('asks again for a kept 404 when the caller does not keep them', async () => {
    const { client, asked } = clientAnswering(
      { status: 404, body: 'Not found' },
      { status: 200, body: 'Слово.' },
    );

    await client().get(URL, { keepNotFound: true });

    expect(client().cached(URL)).toBeUndefined();
    expect(await client().get(URL)).toEqual({ status: 200, body: 'Слово.' });
    expect(asked).toEqual([URL, URL]);
  });

  it('reads a page from the cache once it has been fetched', async () => {
    const { client, asked } = clientAnswering({ status: 200, body: 'Слово.' });

    await client().get(URL);
    const again = await client().get(URL);

    expect(again).toEqual({ status: 200, body: 'Слово.' });
    expect(asked).toEqual([URL]);
    expect(client().cached(URL)).toEqual({ status: 200, body: 'Слово.' });
  });
});
