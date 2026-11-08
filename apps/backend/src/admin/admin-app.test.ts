import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EDITIONS_DIR } from '@slovo/language-pack/edition';

import { readEditions } from '../edition/edition-folders';
import { testApp } from '../test-support';

/** A built admin of the test's own: an index page and one asset. */
function adminDist(): string {
  const dist = mkdtempSync(join(tmpdir(), 'slovo-admin-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>SLOVO admin</title>');
  writeFileSync(join(dist, 'assets', 'main.js'), 'console.log("admin");');
  return dist;
}

const get = (backend: ReturnType<typeof testApp>, path: string) => backend.request(path);

describe('the owner admin app at /admin', () => {
  it('serves the built index page at /admin/ and for every nested route', async () => {
    const backend = testApp({ adminDist: adminDist() });
    for (const path of ['/admin/', '/admin/words', '/admin/editions/uk/reports']) {
      const response = await get(backend, path);
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain('<title>SLOVO admin</title>');
    }
  });

  it('serves its built assets', async () => {
    const response = await get(testApp({ adminDist: adminDist() }), '/admin/assets/main.js');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('console.log("admin");');
  });

  it('answers the admin API with the Editions it serves', async () => {
    const response = await get(testApp({ adminDist: adminDist() }), '/admin/api/editions');
    expect(response.status).toBe(200);
    const editions = readEditions(EDITIONS_DIR).map(({ config }) => ({
      id: config.id,
      displayName: config.displayName,
    }));
    expect(editions.length).toBeGreaterThan(0);
    expect(await response.json()).toEqual({ editions });
  });

  it('is not served without a built admin', async () => {
    expect((await get(testApp(), '/admin/')).status).toBe(404);
  });
});
