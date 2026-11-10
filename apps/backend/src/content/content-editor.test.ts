import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { afterAll, describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  createTestDatabase,
  signedInAdmin,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';

/** A copy of the UA Edition folder, removed after the file. */
const folder = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-editor-')), 'uk');
  cpSync(join(EDITIONS_DIR, 'uk'), dir, { recursive: true });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
})();

/** The backend with a Власник, an Агент and the UA Edition imported. */
async function editorBackend() {
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
  const commandDeps = adminCommandDeps(admin, database);
  const out: string[] = [];
  const io = { out: (line: string) => out.push(line), err: () => undefined };
  await runAdminCommand(['owner', 'add', 'owner@example.com'], commandDeps, io);
  await runAdminCommand(['agent', 'add', 'claude-content'], commandDeps, io);
  const token = out.find((line) => line.startsWith('slovo_agent_'));
  if (token === undefined) throw new Error('no Агент token');
  const imported = await backend.importContent('uk', folder);
  if (!imported.ok) throw new Error('the UA Edition did not import');
  return { ...backend, agent: backend.clientOf(token), store: createAdminStore(database) };
}

const WORD_ID = 'w_009orq';

async function wordOf(client: ApiClient) {
  const snapshot = await client.content.snapshot({ editionId: 'uk' });
  const word = snapshot.words.find((found) => found.id === WORD_ID);
  if (word === undefined) throw new Error(`no Word ${WORD_ID}`);
  return { word, contentVersion: snapshot.contentVersion };
}

describe('the content editor through an admin session', () => {
  it("publishes an Адмін's save with no reason and logs it with before and after", async () => {
    const backend = await editorBackend();
    const { email, client: adminClient } = await signedInAdmin(backend, 'admin');
    const { word, contentVersion } = await wordOf(backend.client);
    const { batchId } = await adminClient.admin.content.openBatch({ editionId: 'uk' });
    const { recordVersion } = await adminClient.admin.content.record({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
    });
    const primaryDefinition = 'Кільце з металу чи дерева.';

    const written = await adminClient.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion,
      fields: { ...word, primaryDefinition },
    });

    expect(written.contentVersion).toBe(contentVersion + 1);
    const after = await wordOf(backend.client);
    expect(after.word.primaryDefinition).toBe(primaryDefinition);
    expect(after.contentVersion).toBe(contentVersion + 1);
    const [action] = (await backend.store.actions('uk')).filter(
      (row) => row.what === 'content.word.edit',
    );
    expect(action).toMatchObject({
      who: { kind: 'admin-user', email },
      batchId,
      before: { fields: { primaryDefinition: word.primaryDefinition } },
      after: { fields: { primaryDefinition } },
    });
  });

  it('lists the records of a kind by a text query, and reads the Edition card', async () => {
    const backend = await editorBackend();
    const { client: adminClient } = await signedInAdmin(backend, 'owner');
    const { word } = await wordOf(backend.client);

    const { records } = await adminClient.admin.content.records({
      editionId: 'uk',
      kind: 'word',
      query: word.lemma,
    });
    expect(records).toContainEqual({
      id: WORD_ID,
      label: word.lemma,
      retired: false,
      recordVersion: 1,
    });
    const card = await adminClient.admin.editionCard({ editionId: 'uk' });
    expect(card.id).toBe('uk');
    expect(card.displayName.length).toBeGreaterThan(0);
  });

  it('lists the records a page of 50 at a time, with the count of every match', async () => {
    const backend = await editorBackend();
    const { client: adminClient } = await signedInAdmin(backend, 'owner');
    const list = (page?: number) =>
      adminClient.admin.content.records({
        editionId: 'uk',
        kind: 'word',
        ...(page === undefined ? {} : { page }),
      });

    const first = await list();
    expect(first.records).toHaveLength(50);
    expect(first.total).toBeGreaterThan(100);
    const second = await list(2);
    expect(second.records).toHaveLength(50);
    expect(second.total).toBe(first.total);
    const firstIds = new Set(first.records.map((each) => each.id));
    expect(second.records.some((each) => firstIds.has(each.id))).toBe(false);
    expect(
      second.records[0]?.label.localeCompare(first.records[49]?.label ?? ''),
    ).toBeGreaterThanOrEqual(0);
    const last = Math.ceil(first.total / 50);
    expect((await list(last)).records).toHaveLength(first.total - (last - 1) * 50);
    expect((await list(last + 1)).records).toEqual([]);
  });

  it('refuses a session write without the admin header, and an Агент still writes', async () => {
    const backend = await editorBackend();
    const { cookie } = await signedInAdmin(backend, 'admin');
    const response = await backend.request('/v1/admin/content/uk/batches', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: '{}',
    });
    expect(response.status).toBe(403);

    const { batchId } = await backend.agent.admin.content.openBatch({ editionId: 'uk' });
    expect(batchId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
