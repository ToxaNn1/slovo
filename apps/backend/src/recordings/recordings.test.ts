import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, systemClock } from '@slovo/server-core';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';

import { runAdminCommand } from '../admin/admin-command';
import { createAdminStore, hashToken } from '../admin/admin-store';
import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { memoryMediaStore, type MediaStore } from '../media/media-store';
import { systemRandom } from '../random';
import {
  adminCommandDeps,
  importedDatabases,
  passTime,
  silentLogger,
  testApp,
} from '../test-support';
import type { RecordingGenerator, RecordingRequest } from './generator';
import { createRecordings, RECORDING_LEASE_MS, RETIRED_FILE_KEPT_MS } from './recordings';

/** A copy of the UA Edition folder, removed after the file. */
const folder = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-recordings-')), 'uk');
  cpSync(join(EDITIONS_DIR, 'uk'), dir, { recursive: true });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
})();

const editions = readEditions(EDITIONS_DIR);
const VOICES = ['oksana', 'taras', 'marta', 'ostap'];

/** A generator whose file is the voice and the text it read; it fails every text that starts with `failing`. */
function fakeGenerator(
  failing?: string,
): RecordingGenerator & { readonly asked: RecordingRequest[] } {
  const asked: RecordingRequest[] = [];
  return {
    asked,
    record(requests) {
      asked.push(...requests);
      return Promise.resolve(
        requests.map(({ voice, text }) =>
          failing !== undefined && text.startsWith(failing)
            ? { ok: false as const }
            : {
                ok: true as const,
                bytes: new TextEncoder().encode(`${voice}:${text}`),
                durationMs: 900,
              },
        ),
      );
    },
  };
}

/** A generator that answers like `fakeGenerator` only once `answer` is called. */
function heldGenerator(): RecordingGenerator & {
  readonly asked: RecordingRequest[];
  answer(): void;
} {
  const inner = fakeGenerator();
  let answer = (): void => undefined;
  const answered = new Promise<void>((resolve) => {
    answer = resolve;
  });
  return {
    asked: inner.asked,
    answer: () => {
      answer();
    },
    async record(requests) {
      const outcomes = inner.record(requests);
      await answered;
      return outcomes;
    },
  };
}

/** A Media Store that keeps the keys it holds. */
function keptStore(): MediaStore & { readonly keys: Set<string> } {
  const inner = memoryMediaStore();
  const keys = new Set<string>();
  return {
    keys,
    async put(key, bytes, type) {
      keys.add(key);
      await inner.put(key, bytes, type);
    },
    async delete(key) {
      keys.delete(key);
      await inner.delete(key);
    },
    head: (key) => inner.head(key),
  };
}

/** The UA Edition imported and its backlog recorded once, copied for every test. */
const importedDatabase = importedDatabases('uk', folder, (database) =>
  createRecordings({
    database,
    clock: systemClock,
    store: memoryMediaStore(),
    generator: fakeGenerator(),
    editions,
    batch: 100_000,
  }).run(),
);

/** The backend on a database of its own, the UA Edition imported and its backlog recorded. */
async function recordingsBackend() {
  const own = await importedDatabase();
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
  const out: string[] = [];
  const io = { out: (line: string) => out.push(line), err: () => undefined };
  const commandDeps = adminCommandDeps(admin, database);
  // The admin API answers only once an owner exists.
  await runAdminCommand(['owner', 'add', 'owner@example.com'], commandDeps, io);
  await runAdminCommand(['agent', 'add', 'claude-content'], commandDeps, io);
  const token = out.find((line) => line.startsWith('slovo_agent_'));
  if (token === undefined) throw new Error('no Агент token');
  const agent = backend.clientOf(token);
  const { batchId } = await agent.admin.content.openBatch({ editionId: 'uk' });
  const store = keptStore();
  const run = (generator: RecordingGenerator, batch = 50) =>
    createRecordings({ database, clock: systemClock, store, generator, editions, batch }).run();
  return { ...backend, agent, batchId, store, run };
}

const versionOf = async (client: ApiClient) =>
  (await client.content.snapshot({ editionId: 'uk' })).contentVersion;

async function patchSince(client: ApiClient, since: number) {
  const answer = await client.content.patch({
    params: { editionId: 'uk' },
    query: { since, patchFormat: PATCH_FORMAT },
  });
  if (answer.status !== 200 || answer.body.status !== 'patch') {
    throw new Error(`no Patch: ${JSON.stringify(answer)}`);
  }
  return answer.body.patch;
}

/** Creates a Word of the Lemma stressed at the position; its id. */
async function createWord(
  client: ApiClient,
  agent: ApiClient,
  batchId: string,
  lemma: string,
  stress: number,
) {
  const [word] = (await client.content.snapshot({ editionId: 'uk' })).words;
  if (word === undefined) throw new Error('no Word');
  const { id: _id, ...fields } = word;
  const { id } = await agent.admin.content.create({
    editionId: 'uk',
    kind: 'word',
    batchId,
    fields: { ...fields, lemma, stress: [stress] },
  });
  return id;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the Recordings job', () => {
  // The template database imports the Edition and records its backlog once, before the first test.
  beforeAll(async () => {
    await (await importedDatabase()).drop();
  }, 180_000);

  it('records a new Word in every Narrator Voice at one content version, and a second run writes nothing', async () => {
    const { client, agent, batchId, store, run } = await recordingsBackend();
    const id = await createWord(client, agent, batchId, 'обручичок', 3);
    const before = await versionOf(client);
    const generator = fakeGenerator();

    await run(generator);

    expect(generator.asked).toEqual(VOICES.map((voice) => ({ voice, text: 'обру́чичок' })));
    const patch = await patchSince(client, before);
    expect(patch.contentVersion).toBe(before + 1);
    expect(
      patch.recordings.map(({ wordId, narratorVoice, recordingKind, retired, durationMs }) => ({
        wordId,
        narratorVoice,
        recordingKind,
        retired,
        durationMs,
      })),
    ).toEqual(
      ['marta', 'oksana', 'ostap', 'taras'].map((narratorVoice) => ({
        wordId: id,
        narratorVoice,
        recordingKind: 'plain',
        retired: false,
        durationMs: 900,
      })),
    );
    for (const row of patch.recordings) {
      expect(store.keys.has(`recordings/${row.narratorVoice}/plain/${id}.${row.hash}.mp3`)).toBe(
        true,
      );
    }

    const again = fakeGenerator();
    await run(again);
    expect(again.asked).toEqual([]);
    expect(await versionOf(client)).toBe(before + 1);
  });

  it('records nothing while another run holds the Edition, and takes it over once that lease expired', async () => {
    const { client, agent, batchId, run } = await recordingsBackend();
    await createWord(client, agent, batchId, 'обручичок', 3);
    const before = await versionOf(client);
    const held = heldGenerator();

    const first = run(held);
    await vi.waitFor(() => {
      expect(held.asked).not.toEqual([]);
    });
    const meanwhile = fakeGenerator();
    await run(meanwhile);
    expect(meanwhile.asked).toEqual([]);

    vi.setSystemTime(Date.now() + RECORDING_LEASE_MS + 1);
    const later = fakeGenerator();
    await run(later);
    expect(later.asked).toEqual(VOICES.map((voice) => ({ voice, text: 'обру́чичок' })));
    expect(await versionOf(client)).toBe(before + 1);

    // The run whose lease expired writes nothing when its generator answers at last.
    held.answer();
    await first;
    expect(await versionOf(client)).toBe(before + 1);
  });

  it('records the other Words when the generator fails for one, and that one on a later run', async () => {
    const { client, agent, batchId, run } = await recordingsBackend();
    const failed = await createWord(client, agent, batchId, 'обручичок', 3);
    const recorded = await createWord(client, agent, batchId, 'ґудзичок', 1);
    const before = await versionOf(client);

    await run(fakeGenerator('обру́'));

    const words = (await patchSince(client, before)).recordings.map(({ wordId }) => wordId);
    expect(new Set(words)).toEqual(new Set([recorded]));
    const retry = fakeGenerator();
    await run(retry);
    expect(new Set(retry.asked.map(({ text }) => text))).toEqual(new Set(['обру́чичок']));
    expect(
      new Set((await patchSince(client, before)).recordings.map(({ wordId }) => wordId)),
    ).toEqual(new Set([failed, recorded]));
  });

  it('fails the batch when the generator throws, and records the next Word on a later run', async () => {
    const { client, agent, batchId, run } = await recordingsBackend();
    await createWord(client, agent, batchId, 'обручичок', 3);
    await createWord(client, agent, batchId, 'ґудзичок', 1);
    const throwing: RecordingGenerator = { record: () => Promise.reject(new Error('exit 1')) };

    expect(await run(throwing, 1)).toMatchObject({ recorded: 0, failed: 1 });
    expect(await run(fakeGenerator(), 1)).toMatchObject({ recorded: 1, failed: 0 });
  });

  it('retires the Recordings of a Word whose Lemma changed, and records it anew', async () => {
    const { client, agent, batchId, run } = await recordingsBackend();
    const id = await createWord(client, agent, batchId, 'обручичок', 3);
    await run(fakeGenerator());
    const before = await versionOf(client);
    const word = (await client.content.snapshot({ editionId: 'uk' })).words.find(
      (found) => found.id === id,
    );
    if (word === undefined) throw new Error('no Word');
    const { id: _id, ...fields } = word;

    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id,
      batchId,
      recordVersion: 1,
      fields: { ...fields, lemma: 'обручик' },
    });
    const afterEdit = await patchSince(client, before);
    expect(afterEdit.recordings.map(({ retired }) => retired)).toEqual([true, true, true, true]);

    const generator = fakeGenerator();
    await run(generator);
    expect(new Set(generator.asked.map(({ text }) => text))).toEqual(new Set(['обру́чик']));
    const rows = (await patchSince(client, before)).recordings;
    const retired = rows.filter((row) => row.retired).map(({ hash }) => hash);
    const live = rows.filter((row) => !row.retired).map(({ hash }) => hash);
    expect(retired).toHaveLength(4);
    expect(live).toHaveLength(4);
    expect(live.some((hash) => retired.includes(hash))).toBe(false);
  });

  it('tries a Word that failed after the Words that never did, so it never blocks the batch', async () => {
    const { client, agent, batchId, run } = await recordingsBackend();
    const words = [
      { id: await createWord(client, agent, batchId, 'обручичок', 3), text: 'обру́чичок' },
      { id: await createWord(client, agent, batchId, 'ґудзичок', 1), text: 'ґу́дзичок' },
    ].sort((one, other) => (one.id < other.id ? -1 : 1));
    const [first, second] = words;
    if (first === undefined || second === undefined) throw new Error('no Words');
    const before = await versionOf(client);

    // The Word first in id order fails every time; a batch holds one Word.
    await run(fakeGenerator(first.text), 1);
    await run(fakeGenerator(first.text), 1);

    const recorded = (await patchSince(client, before)).recordings.map(({ wordId }) => wordId);
    expect(new Set(recorded)).toEqual(new Set([second.id]));
  });

  it('deletes the file of a row retired 31 days ago, and keeps one retired 29 days ago', async () => {
    const { client, agent, batchId, store, run } = await recordingsBackend();
    const id = await createWord(client, agent, batchId, 'обручичок', 3);
    await run(fakeGenerator());
    const keysOf = () => [...store.keys].filter((key) => key.includes(`/${id}.`));
    const first = keysOf();
    const word = (await client.content.snapshot({ editionId: 'uk' })).words.find(
      (found) => found.id === id,
    );
    if (word === undefined) throw new Error('no Word');
    const { id: _id, ...fields } = word;
    await agent.admin.content.edit({
      editionId: 'uk',
      kind: 'word',
      id,
      batchId,
      recordVersion: 1,
      fields: { ...fields, lemma: 'обручик' },
    });
    await run(fakeGenerator());

    const day = 24 * 60 * 60 * 1000;
    passTime(RETIRED_FILE_KEPT_MS - day);
    await run(fakeGenerator());
    expect(first.every((key) => store.keys.has(key))).toBe(true);

    passTime(2 * day);
    await run(fakeGenerator());
    expect(first.some((key) => store.keys.has(key))).toBe(false);
    expect(keysOf()).toHaveLength(4);
  });
});
