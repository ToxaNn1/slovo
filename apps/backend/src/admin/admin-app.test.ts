import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { randomUUID } from 'node:crypto';

import { describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from '../database/database';
import { createTestDatabase, silentLogger, testApp, testDatabaseUrl } from '../test-support';
import { createAdminStore } from './admin-store';

/** A built admin of the test's own: an index page and one asset. */
function adminDist(): string {
  const dist = mkdtempSync(join(tmpdir(), 'slovo-admin-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>SLOVO admin</title>');
  writeFileSync(join(dist, 'assets', 'main.js'), 'console.log("admin");');
  return dist;
}

/** The backend serving the built admin, a Власник in its database: the admin is on. */
async function adminOn() {
  const backend = testApp({ adminDist: adminDist() });
  await createAdminStore(backend.database).addAdminUser({
    email: `owner-${randomUUID()}@example.com`,
    role: 'owner',
    createdAt: new Date(),
  });
  return backend;
}

const get = (backend: ReturnType<typeof testApp>, path: string) => backend.request(path);

describe('the owner admin app at /admin', () => {
  it('serves the built index page at /admin/ and for every nested route', async () => {
    const backend = await adminOn();
    for (const path of ['/admin/', '/admin/words', '/admin/editions/uk/reports']) {
      const response = await get(backend, path);
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain('<title>SLOVO admin</title>');
    }
  });

  it('serves its built assets', async () => {
    const response = await get(await adminOn(), '/admin/assets/main.js');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('console.log("admin");');
  });

  it('answers 404 on every path while no Власник exists', async () => {
    // A database of the test's own: the file's has a Власник once a test adds one.
    const own = await createTestDatabase(testDatabaseUrl());
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    const backend = testApp({ database, adminDist: adminDist() });
    for (const path of ['/admin/', '/admin/words', '/admin/assets/main.js']) {
      expect((await get(backend, path)).status, path).toBe(404);
    }
  });

  it('is never framed, sniffed or kept, and runs only its own scripts', async () => {
    const backend = await adminOn();
    for (const path of ['/admin/', '/admin/words', '/admin/assets/main.js']) {
      const { headers } = await get(backend, path);
      const policy = headers.get('content-security-policy') ?? '';
      expect(policy, path).toContain("frame-ancestors 'none'");
      expect(policy, path).toContain("script-src 'self'");
      expect(policy, path).not.toContain('unsafe-inline');
      expect(headers.get('x-content-type-options'), path).toBe('nosniff');
      expect(headers.get('x-frame-options'), path).toBe('DENY');
      expect(headers.get('strict-transport-security'), path).toMatch(/max-age=\d+/);
    }
  });

  it('answers the admin API and the Sync records with the same headers, never kept', async () => {
    const backend = await adminOn();
    for (const path of ['/v1/admin/status', '/v1/admin/me', '/v1/editions/uk/records']) {
      const { headers } = await get(backend, path);
      expect(headers.get('cache-control'), path).toBe('no-store');
      expect(headers.get('x-content-type-options'), path).toBe('nosniff');
      expect(headers.get('content-security-policy') ?? '', path).toContain(
        "frame-ancestors 'none'",
      );
    }
  });

  it('is not served without a built admin', async () => {
    expect((await get(testApp(), '/admin/')).status).toBe(404);
  });
});
