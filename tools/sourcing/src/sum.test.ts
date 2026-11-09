import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PoliteClient, type FetchResponse } from './polite-client';
import { SumDictionary } from './sum';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const SITE = 'https://sum.in.ua/s/mzhychka';
const CDX =
  'https://web.archive.org/cdx/search/cdx?url=sum.in.ua/s/mzhychka&filter=statuscode:200&fl=timestamp,original';
const SNAPSHOT = 'https://web.archive.org/web/20241216072945id_/https://sum.in.ua/s/mzhychka';

const page = (file: string): FetchResponse => ({
  status: 200,
  body: readFileSync(join(fixturesDir, file), 'utf8'),
});

/**
 * A run of the dictionary in `auto` mode over a network of the given pages;
 * any other address fails like a dead host. Runs given one cache folder share it.
 */
async function lookUp(lemma: string, pages: Record<string, FetchResponse>, cacheDir: string) {
  const asked: string[] = [];
  const client = new PoliteClient(
    (url) => {
      asked.push(decodeURI(url));
      const answer = pages[decodeURI(url)];
      return answer === undefined
        ? Promise.reject(new TypeError('fetch failed'))
        : Promise.resolve(answer);
    },
    { now: () => 0, sleep: () => Promise.resolve() },
    cacheDir,
    0,
  );
  const result = await new SumDictionary(client, 'auto').lookUp(lemma);
  return { result, asked };
}

const newCache = () => mkdtempSync(join(tmpdir(), 'slovo-sum-'));

describe('SumDictionary', () => {
  it('asks sum.in.ua again on a later run when the archive had no copy', async () => {
    const cacheDir = newCache();
    const first = await lookUp('мжичка', { [CDX]: { status: 200, body: '' } }, cacheDir);
    expect(first.result.found).toBe(false);

    const second = await lookUp('мжичка', { [SITE]: page('sum/mzhychka.html') }, cacheDir);

    expect(second.asked).toContain(SITE);
    expect(second.result.found).toBe(true);
  });

  it('reads a copy the archive gave on an earlier run from the cache, without the site', async () => {
    const cacheDir = newCache();
    const archive = {
      [CDX]: page('wayback/cdx-mzhychka.txt'),
      [SNAPSHOT]: page('sum/mzhychka.html'),
    };
    expect((await lookUp('мжичка', archive, cacheDir)).result.found).toBe(true);

    const second = await lookUp('мжичка', {}, cacheDir);

    expect(second.asked).toEqual([]);
    expect(second.result.found).toBe(true);
  });

  it('tries at most 8 addresses for a Lemma of many ґ and apostrophes', async () => {
    // 32 spellings: each ґ and each apostrophe has two.
    const { result } = await lookUp("ґаґ'ґ'", {}, newCache());

    expect(!result.found && result.tried.length).toBe(8);
  });
});
