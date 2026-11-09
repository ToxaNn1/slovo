import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import { afterAll, describe, expect, it, onTestFinished } from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { systemRandom } from '../random';
import { startServer } from '../server';
import {
  adminCommandDeps,
  createTestDatabase,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';

/** A scratch folder of the file's own: a copy of the UA Edition folder and the CLI's input files. */
const scratch = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-content-cli-'));
  cpSync(join(EDITIONS_DIR, 'uk'), join(dir, 'editions', 'uk'), { recursive: true });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
})();
const editionsDir = join(scratch, 'editions');

/** One hash over every file of the copied Edition folder, its path and its bytes. */
function folderHash(): string {
  const hash = createHash('sha256');
  const files = readdirSync(join(editionsDir, 'uk'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  for (const file of files) hash.update(file).update(readFileSync(file));
  return hash.digest('hex');
}

/** The backend over HTTP on a database of the test's own, the UA Edition imported, and an Агент token. */
async function servedBackend() {
  const own = await createTestDatabase(testDatabaseUrl());
  onTestFinished(() => own.drop());
  const database = createDatabase(own.url, silentLogger);
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
  const imported = await backend.importContent('uk', join(editionsDir, 'uk'));
  if (!imported.ok) throw new Error('the UA Edition did not import');
  const server = await startServer({ app: backend.app, database, port: 0 });
  onTestFinished(() => server.stop());
  const url = `http://localhost:${String(server.port)}/v1`;
  return { ...backend, admin, commandDeps, token, url, agent: backend.clientOf(token) };
}

/** Runs `pnpm content` from the repo root, as an agent does, against the API at `url`. */
function content(
  { url, token }: { url: string; token: string | undefined },
  ...args: readonly string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const { SLOVO_AGENT_TOKEN: _token, ...inherited } = process.env;
  const env = {
    ...inherited,
    SLOVO_API_URL: url,
    SLOVO_EDITIONS_DIR: editionsDir,
    ...(token === undefined ? {} : { SLOVO_AGENT_TOKEN: token }),
  };
  const child = spawn('pnpm', ['--silent', 'content', ...args], {
    cwd: join(EDITIONS_DIR, '..'),
    env,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/** Writes a CLI input file into the scratch folder and answers its path. */
function input(name: string, value: unknown): string {
  const path = join(scratch, name);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

const WORD_ID = 'w_009orq';

type Backend = Awaited<ReturnType<typeof servedBackend>>;

const snapshotOf = (backend: Backend) => backend.client.content.snapshot({ editionId: 'uk' });

/** A live Word of the snapshot without its id, for a draft. */
async function draftOf(backend: Backend, changes: Record<string, unknown>) {
  const word = (await snapshotOf(backend)).words.find(({ id }) => id === WORD_ID);
  if (word === undefined) throw new Error(`no Word ${WORD_ID}`);
  const { id: _id, ...fields } = word;
  return { ...fields, ...changes };
}

describe('pnpm content against the content write API', () => {
  it('adds the drafts in one batch and prints each id and the new content version', async () => {
    const backend = await servedBackend();
    const before = await snapshotOf(backend);
    const hash = folderHash();
    // «обру́чик» and «обру́чок».
    const drafts = input('drafts.json', [
      await draftOf(backend, { lemma: 'обручик', stress: [3] }),
      await draftOf(backend, { lemma: 'обручок', stress: [3] }),
    ]);

    const { code, stdout, stderr } = await content(
      backend,
      'add',
      'word',
      drafts,
      '--edition',
      'uk',
    );

    expect(stderr).not.toMatch(/REFUSED|UNAUTHORIZED/);
    expect(code).toBe(0);
    const lines = stdout.trim().split('\n');
    expect(lines).toEqual([
      expect.stringMatching(
        new RegExp(`^w_[a-z0-9]{6} v1 content v${String(before.contentVersion + 1)} batch \\S+$`),
      ),
      expect.stringMatching(
        new RegExp(`^w_[a-z0-9]{6} v1 content v${String(before.contentVersion + 2)} batch \\S+$`),
      ),
    ]);
    const ids = lines.map((line) => line.split(' ')[0]);
    const after = await snapshotOf(backend);
    expect(after.words.filter(({ id }) => ids.includes(id)).map(({ lemma }) => lemma)).toEqual(
      expect.arrayContaining(['обручик', 'обручок']),
    );
    const batches = new Set(lines.map((line) => line.split(' ').at(-1)));
    expect(batches.size).toBe(1);
    const actions = (await backend.admin.actions('uk')).filter(({ what }) =>
      what.startsWith('content.word.'),
    );
    expect(actions.map(({ batchId }) => batchId)).toEqual([...batches, ...batches]);
    expect(folderHash()).toBe(hash);
  });

  it('prints the refusal with the current version when an edit saw a stale one', async () => {
    const backend = await servedBackend();
    const { batchId } = await backend.agent.admin.content.openBatch({ editionId: 'uk' });
    const fields = await draftOf(backend, {});
    await backend.agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id: WORD_ID,
      batchId,
      recordVersion: 1,
      fields: { ...fields, primaryDefinition: 'Кільце з металу чи дерева.' },
    });
    const before = await snapshotOf(backend);
    const hash = folderHash();
    const edit = input('edit.json', { recordVersion: 1, ...fields });

    const { code, stdout, stderr } = await content(
      backend,
      'edit',
      'word',
      WORD_ID,
      edit,
      '--edition',
      'uk',
    );

    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(`${WORD_ID}: STALE, the current record version is 2`);
    expect(await snapshotOf(backend)).toEqual(before);
    expect(folderHash()).toBe(hash);
  });

  it('edits from the current record version when the edit file names none', async () => {
    const backend = await servedBackend();
    const before = await snapshotOf(backend);
    const edit = input('edit-current.json', {
      ...(await draftOf(backend, {})),
      primaryDefinition: 'Кільце з металу чи дерева.',
    });

    const { code, stdout } = await content(
      backend,
      'edit',
      'word',
      WORD_ID,
      edit,
      '--edition',
      'uk',
    );

    expect(code).toBe(0);
    expect(stdout).toMatch(
      new RegExp(`^${WORD_ID} v2 content v${String(before.contentVersion + 1)} batch \\S+\\n$`),
    );
  });

  it('flags a record with its explanation, which the Action log keeps', async () => {
    const backend = await servedBackend();
    const before = await snapshotOf(backend);

    const { code, stdout } = await content(
      backend,
      'flag',
      'word',
      WORD_ID,
      '--reason',
      'сумнівне джерело',
      '--edition',
      'uk',
    );

    expect(code).toBe(0);
    expect(stdout).toMatch(new RegExp(`^${WORD_ID} flagged batch \\S+\\n$`));
    expect(await backend.admin.actions('uk')).toContainEqual(
      expect.objectContaining({
        who: { kind: 'agent', name: 'claude-content' },
        what: 'content.word.flag',
        reason: 'сумнівне джерело',
      }),
    );
    expect(await snapshotOf(backend)).toEqual(before);
  });

  it('prints UNAUTHORIZED and exits non-zero without a token or with a revoked one', async () => {
    const backend = await servedBackend();
    const before = await snapshotOf(backend);
    const hash = folderHash();
    const drafts = input('unauthorized.json', [
      await draftOf(backend, { lemma: 'обручик', stress: [3] }),
    ]);

    const missing = await content(
      { url: backend.url, token: undefined },
      'add',
      'word',
      drafts,
      '--edition',
      'uk',
    );
    await runAdminCommand(['agent', 'revoke', 'claude-content'], backend.commandDeps, {
      out: () => undefined,
      err: () => undefined,
    });
    const revoked = await content(backend, 'add', 'word', drafts, '--edition', 'uk');

    for (const run of [missing, revoked]) {
      expect(run.code).not.toBe(0);
      expect(run.stdout).toBe('');
      expect(run.stderr).toContain('UNAUTHORIZED');
    }
    expect(await snapshotOf(backend)).toEqual(before);
    expect(folderHash()).toBe(hash);
  });

  it('prints the live ids `have` reads from the snapshot and the counts of the content report', async () => {
    const backend = await servedBackend();
    const snapshot = await snapshotOf(backend);
    const { report, missed } = await backend.agent.admin.content.report({ editionId: 'uk' });

    const have = await content(backend, 'have', '--kind', 'word', '--edition', 'uk');
    const counts = await content(backend, 'counts', '--edition', 'uk');

    expect(have.code).toBe(0);
    expect(
      have.stdout
        .trim()
        .split('\n')
        .map((line) => line.split('\t')[0]),
    ).toEqual(snapshot.words.filter((word) => !word.retired).map(({ id }) => id));
    expect(counts.code).toBe(0);
    expect(counts.stdout).toContain(`Words: ${String(report.words)}`);
    expect(counts.stdout).toContain(`Corrections: ${String(report.corrections)}`);
    expect(counts.stdout).toContain(`Idioms: ${String(report.idioms)}`);
    for (const { message } of missed) expect(counts.stdout).toContain(message);
  });

  it('checks the drafts against the content rules locally and sends nothing', async () => {
    const backend = await servedBackend();
    const before = await snapshotOf(backend);
    const drafts = input('bad.json', [await draftOf(backend, { lemma: 'обручик', stress: [99] })]);

    const { code, stderr } = await content(backend, 'check', 'word', drafts, '--edition', 'uk');

    expect(code).toBe(1);
    expect(stderr).toMatch(/\S/);
    expect(await snapshotOf(backend)).toEqual(before);
    expect(await backend.admin.actions('uk')).toEqual([]);
  });
});
