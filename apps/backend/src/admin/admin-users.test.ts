import { randomUUID } from 'node:crypto';

import { createAdminAccess, systemClock } from '@slovo/server-core';
import { sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import {
  createTestDatabase,
  passTime,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';
import { runAdminCommand } from './admin-command';
import { createAdminStore, hashToken } from './admin-store';

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
  async function command(...args: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runAdminCommand(args, admin, {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    });
    return { code, out, err };
  }
  const status = (headers: Record<string, string> = {}) =>
    backend.request('/v1/admin/status', { headers });
  return { ...backend, admin, command, status };
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
    const status = await backend.status();
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
