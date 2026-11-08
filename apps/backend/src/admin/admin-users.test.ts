import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, createOwnerChecks, systemClock } from '@slovo/server-core';
import { sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { systemRandom } from '../random';
import {
  adminHeaders,
  createTestDatabase,
  passTime,
  signInAdmin,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';
import { runAdminCommand } from './admin-command';
import { createAdminStore, hashToken } from './admin-store';
import { createOwnerCheckStore } from './owner-check-store';

/**
 * The backend on a database of the test's own, since a Власник turns the
 * admin on for every test that shares a database; and the server commands,
 * run on that database as `pnpm admin` runs them.
 */
async function freshBackend() {
  const own = await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
  onTestFinished(() => database.close());
  const backend = testApp({ database });
  const admin = createAdminAccess({
    store: createAdminStore(database),
    clock: systemClock,
    random: systemRandom,
    hash: hashToken,
  });
  const ownerChecks = createOwnerChecks({
    store: createOwnerCheckStore(database),
    clock: systemClock,
    admin,
  });
  const deps = { admin, ownerChecks, readFile: (path: string) => readFile(path, 'utf8') };
  async function command(...args: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runAdminCommand(args, deps, {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    });
    return { code, out, err };
  }
  const status = (headers: Record<string, string> = {}) =>
    backend.request('/v1/admin/status', { headers });
  return { ...backend, admin, ownerChecks, command, status };
}

const newEmail = () => `owner-${randomUUID()}@example.com`;
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** The one line of the command's output that is a token. */
const tokenOf = (out: readonly string[]) => out.filter((line) => line.startsWith('slovo_agent_'));

describe('pnpm admin owner add', () => {
  it('creates the Власник, logs itself as a server command and turns the admin on', async () => {
    const backend = await freshBackend();
    const email = newEmail();
    expect((await backend.status()).status).toBe(404);

    const added = await backend.command('owner', 'add', email);

    expect(added.code).toBe(0);
    const { cookie } = await signInAdmin(backend, email);
    const status = await backend.status({ cookie });
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ on: true });
    expect(await backend.admin.actions()).toEqual([
      expect.objectContaining({
        who: { kind: 'command', command: 'pnpm admin owner add' },
        what: 'admin.owner.add',
        before: null,
        after: { email, role: 'owner' },
      }),
    ]);
  });

  it('refuses an email that has an Admin user already', async () => {
    const backend = await freshBackend();
    const email = newEmail();
    await backend.command('owner', 'add', email);

    const again = await backend.command('owner', 'add', email.toUpperCase());

    expect(again.code).toBe(1);
    expect(await backend.admin.actions()).toHaveLength(1);
  });
});

describe('the Агент token', () => {
  it('is printed once, authenticates as the Агент, and is refused once revoked', async () => {
    const backend = await freshBackend();
    await backend.command('owner', 'add', newEmail());

    const added = await backend.command('agent', 'add', 'claude-content');
    const [token] = tokenOf(added.out);
    if (token === undefined) throw new Error('no token printed');

    expect(added.code).toBe(0);
    expect(tokenOf(added.out)).toHaveLength(1);
    // Known, so refused for its role on a procedure that writes no content.
    expect((await backend.status(bearer(token))).status).toBe(403);
    expect((await backend.status(bearer('slovo_agent_unknown'))).status).toBe(401);

    const revoked = await backend.command('agent', 'revoke', 'claude-content');

    expect(revoked.code).toBe(0);
    const after = await backend.status(bearer(token));
    expect(after.status).toBe(401);
    expect(await after.json()).toMatchObject({ code: 'UNAUTHORIZED' });
    expect((await backend.command('agent', 'revoke', 'claude-content')).code).toBe(1);
  });

  it('is refused on every procedure that is not a content write', async () => {
    const backend = await freshBackend();
    await backend.command('owner', 'add', newEmail());
    const [token] = tokenOf((await backend.command('agent', 'add', 'claude-content')).out);
    if (token === undefined) throw new Error('no token printed');
    const agent = backend.clientOf(token);

    // The admin API's procedures: none writes content yet.
    expect((await backend.status(bearer(token))).status).toBe(403);
    expect((await backend.request('/v1/admin/editions', { headers: bearer(token) })).status).toBe(
      403,
    );
    // The app's API takes an Account's Session only.
    await expect(agent.account.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('keeps one token per name', async () => {
    const backend = await freshBackend();
    await backend.command('agent', 'add', 'claude-content');

    const again = await backend.command('agent', 'add', 'claude-content');

    expect(again.code).toBe(1);
    expect(tokenOf(again.out)).toEqual([]);
  });
});

describe('the admin API at /v1/admin', () => {
  it('answers the Editions the backend serves once a Власник exists', async () => {
    const backend = await freshBackend();
    expect((await backend.request('/v1/admin/editions')).status).toBe(404);

    const email = newEmail();
    await backend.command('owner', 'add', email);
    const { cookie } = await signInAdmin(backend, email);

    const response = await backend.request('/v1/admin/editions', { headers: { cookie } });
    expect(response.status).toBe(200);
    const editions = readEditions(EDITIONS_DIR).map(({ config }) => ({
      id: config.id,
      displayName: config.displayName,
    }));
    expect(editions.length).toBeGreaterThan(0);
    expect(await response.json()).toEqual({ editions });
  });
});

describe('the Action log', () => {
  it('holds who, when, what, before, after and reason of a change', async () => {
    const backend = await freshBackend();
    const entry = {
      who: { kind: 'agent', name: 'claude-content' },
      what: 'content.entry.edit',
      before: { gloss: 'old' },
      after: { gloss: 'new' },
      reason: 'a typo',
      editionId: 'uk',
      batchId: 'batch-1',
    } as const;

    await backend.admin.log(entry);

    expect(await backend.admin.actions('uk')).toEqual([{ ...entry, at: new Date() }]);
    expect(await backend.admin.actions('en')).toEqual([]);
  });

  it('keeps every row as written: later commands append, and nothing edits or deletes one', async () => {
    const backend = await freshBackend();
    await backend.command('owner', 'add', newEmail());
    const [first] = await backend.admin.actions();
    passTime(60_000);

    await backend.command('agent', 'add', 'claude-content');
    await backend.command('agent', 'revoke', 'claude-content');

    const rows = await backend.admin.actions();
    expect(rows.map((row) => row.what)).toEqual([
      'admin.owner.add',
      'admin.agent.add',
      'admin.agent.revoke',
    ]);
    expect(rows[0]).toEqual(first);
    const { db } = backend.database;
    await expect(db.execute(sql`UPDATE action_log SET reason = 'edited'`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM action_log`)).rejects.toThrow();
    expect(await backend.admin.actions()).toEqual(rows);
  });
});

describe('the Owner checks', () => {
  const FIXTURE = fileURLToPath(new URL('fixtures/owner-checks.md', import.meta.url));
  const importCommand = { kind: 'command', command: 'pnpm admin check import' };

  it('imports every line of the file as a check of its version', async () => {
    const backend = await freshBackend();

    const imported = await backend.command('check', 'import', FIXTURE);

    expect(imported).toMatchObject({ code: 0, out: ['5 Owner checks imported.'] });
    const checks = await backend.ownerChecks.list();
    expect(checks.map(({ version, text, ticked }) => [version, text, ticked !== null])).toEqual([
      ['0.9', 'Open the app on a phone.', false],
      ['0.9', 'Search finds **слово**.', false],
      ['0.9', 'Share a card.', false],
      ['0.9', 'The paywall shows once.', true],
      ['1.0', 'Sign in with Apple.', false],
    ]);
    expect(checks[3]?.ticked).toEqual({ at: new Date(), by: importCommand });
    expect((await backend.command('check', 'import', FIXTURE)).code).toBe(1);
    expect(await backend.ownerChecks.list()).toHaveLength(5);
  });

  it('refuses a check line with no version unless --version names one', async () => {
    const backend = await freshBackend();
    const dir = mkdtempSync(join(tmpdir(), 'owner-checks-'));
    onTestFinished(() => {
      rmSync(dir, { recursive: true });
    });
    const file = join(dir, 'checks.md');
    writeFileSync(file, '# Checks\n\n- [ ] Open the app.\n');

    expect((await backend.command('check', 'import', file)).code).toBe(1);
    expect(await backend.ownerChecks.list()).toEqual([]);
    expect((await backend.command('check', 'import', file, '--version', '0.8')).code).toBe(0);
    expect((await backend.ownerChecks.list()).map(({ version }) => version)).toEqual(['0.8']);
  });

  it('ticks a check with who and when, no reason, and logs it', async () => {
    const backend = await freshBackend();
    const email = newEmail();
    await backend.command('owner', 'add', email);
    await backend.command('check', 'import', FIXTURE);
    const [first] = await backend.ownerChecks.list();
    if (!first) throw new Error('nothing imported');
    const { client } = await signInAdmin(backend, email);
    passTime(60_000);

    const { check } = await client.admin.tickOwnerCheck({ id: first.id });

    const at = new Date().toISOString();
    expect(check).toMatchObject({ id: first.id, ticked: { at, by: email } });
    const listed = await client.admin.ownerChecks({ version: '0.9' });
    expect(listed.open).toEqual({ '0.9': 2 });
    expect((await backend.admin.actions()).at(-1)).toMatchObject({
      who: { kind: 'admin-user', email },
      what: 'owner-check.tick',
      reason: null,
      at: new Date(at),
    });
    passTime(60_000);
    const again = await client.admin.tickOwnerCheck({ id: first.id });
    expect(again.check.ticked).toEqual({ at, by: email });
  });

  it('adds a check by pnpm admin check add that the list answers', async () => {
    const backend = await freshBackend();
    const email = newEmail();
    await backend.command('owner', 'add', email);

    const added = await backend.command('check', 'add', '0.9', 'Read', 'the', 'feed', 'offline.');

    expect(added.code).toBe(0);
    const { client } = await signInAdmin(backend, email);
    const listed = await client.admin.ownerChecks({});
    expect(listed.checks).toEqual([
      expect.objectContaining({
        version: '0.9',
        text: 'Read the feed offline.',
        addedBy: 'pnpm admin check add',
        ticked: null,
      }),
    ]);
    expect(listed.open).toEqual({ '0.9': 1 });
    expect((await backend.admin.actions()).at(-1)).toMatchObject({
      who: { kind: 'command', command: 'pnpm admin check add' },
      what: 'owner-check.add',
    });
  });

  it('refuses an Агент token on every Owner-check procedure', async () => {
    const backend = await freshBackend();
    await backend.command('owner', 'add', newEmail());
    await backend.command('check', 'add', '0.9', 'Open the app.');
    const [token] = tokenOf((await backend.command('agent', 'add', 'claude-content')).out);
    if (token === undefined) throw new Error('no token printed');
    const [check] = await backend.ownerChecks.list();
    if (!check) throw new Error('no check');
    const write = { ...bearer(token), ...adminHeaders(), 'content-type': 'application/json' };

    const answers = await Promise.all([
      backend.request('/v1/admin/owner-checks', { headers: bearer(token) }),
      backend.request(`/v1/admin/owner-checks/${String(check.id)}/tick`, {
        method: 'POST',
        headers: write,
        body: '{}',
      }),
      backend.request('/v1/admin/owner-checks', {
        method: 'POST',
        headers: write,
        body: JSON.stringify({ version: '0.9', text: 'More.' }),
      }),
    ]);

    expect(answers.map(({ status }) => status)).toEqual([403, 403, 403]);
    expect((await backend.ownerChecks.list())[0]?.ticked).toBeNull();
  });
});
