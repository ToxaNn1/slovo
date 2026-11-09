import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACK_FORMAT } from '@slovo/language-pack';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from '../database/database';
import { migrateDatabase } from '../database/migrate';
import {
  createTestDatabase,
  silentLogger,
  testApp,
  testDatabaseUrl,
  testEditions,
} from '../test-support';

// No whole pack is published any more: /v1 keeps content.latest and
// content.download for apps in the field (ADR 0031, 0090).
describe('content.latest', () => {
  it('answers none for an Edition that serves content updates', async () => {
    const { client } = testApp();

    const latest = await client.content.latest({ editionId: 'uk', packFormat: PACK_FORMAT });

    expect(latest).toEqual({ pack: null });
  });

  it('answers NOT_FOUND for an Edition the backend did not find', async () => {
    const { client } = testApp();

    await expect(
      client.content.latest({ editionId: 'xx', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404, defined: true });
  });

  it('answers NOT_FOUND for an Edition with content updates switched off', async () => {
    const folder = testEditions(['switched-off'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, contentUpdates: 'off' },
    }));
    const { client } = testApp({ editions: folder.read() });

    await expect(
      client.content.latest({ editionId: 'switched-off', packFormat: PACK_FORMAT }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('refuses a request with an unknown field as BAD_REQUEST', async () => {
    const { client } = testApp();
    // The contract's types allow no unknown field, so the test slips one past them.
    const input = { editionId: 'uk', packFormat: 1, since: 3 };

    await expect(client.content.latest(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
      defined: true,
    });
  });

  it('refuses a pack format that is not a positive whole number as BAD_REQUEST', async () => {
    const { client } = testApp();

    await expect(client.content.latest({ editionId: 'uk', packFormat: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });
});

describe('content.download', () => {
  it('answers NOT_FOUND for any content version', async () => {
    const { client } = testApp();

    for (const contentVersion of [1, 2 ** 31 - 1]) {
      await expect(
        client.content.download({ params: { editionId: 'uk', contentVersion } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404, defined: true });
    }
  });

  it('refuses a content version that is not a positive whole number as BAD_REQUEST', async () => {
    const { client } = testApp();

    for (const contentVersion of [0, 1.5, 2 ** 31]) {
      await expect(
        client.content.download({ params: { editionId: 'uk', contentVersion } }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    }
  });
});

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));
const JOURNAL = 'meta/_journal.json';

/** The migrations folder as it was before the table of whole packs went. */
function migrationsBeforeTheDrop(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-migrations-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  cpSync(MIGRATIONS_DIR, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, JOURNAL), 'utf8')) as {
    entries: { tag: string }[];
  };
  const drop = journal.entries.findIndex((entry) => entry.tag.endsWith('_drop_content_packs'));
  const entries = journal.entries.slice(0, drop);
  writeFileSync(join(dir, JOURNAL), JSON.stringify({ ...journal, entries }));
  return dir;
}

describe('the migrations', () => {
  it('drop the table of whole packs from a database that kept one, and the backend starts on it', async () => {
    const own = await createTestDatabase(testDatabaseUrl(), { migrate: false });
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    await migrate(database.db, { migrationsFolder: migrationsBeforeTheDrop() });
    await database.db.execute(sql`
      insert into content_packs
        (edition_id, content_version, pack_format, content_checksum, file_sha256, size, bytes, published_at)
      values ('uk', 3, 1, 'checksum', 'sha', 1, '\\x00', now())`);

    await migrateDatabase(own.url, silentLogger);

    const table = await database.db.execute<{ found: string | null }>(
      sql`select to_regclass('content_packs')::text as found`,
    );
    expect(table.rows).toEqual([{ found: null }]);
    const { request, client } = testApp({ database });
    expect((await request('/health')).status).toBe(200);
    await expect(
      client.content.latest({ editionId: 'uk', packFormat: PACK_FORMAT }),
    ).resolves.toEqual({ pack: null });
  });
});
