import { recordingPath } from '@slovo/contracts';
import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { createAdminAccess, systemClock, type Alert, type Alerts } from '@slovo/server-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

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
      return Promise.resolve({
        outcomes: requests.map(({ voice, text }) =>
          failing !== undefined && text.startsWith(failing)
            ? { ok: false as const }
            : {
                ok: true as const,
                bytes: new TextEncoder().encode(`${voice}:${text}`),
                durationMs: 900,
              },
        ),
        timedOut: false,
      });
    },
  };
}

/** A generator that hits its time limit after the first `made` requests, which it makes. */
function timedOutGenerator(made: number): RecordingGenerator {
  return {
    record: async (requests) => {
      const { outcomes } = await fakeGenerator().record(requests);
      return {
        outcomes: outcomes.map((outcome, index) => (index < made ? outcome : { ok: false })),
        timedOut: true,
      };
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

/** Alerts that keep what they were told. */
function keptAlerts(): Alerts & { readonly sent: Alert[] } {
  const sent: Alert[] = [];
  return {
    sent,
    send(alert) {
      sent.push(alert);
      return Promise.resolve();
    },
  };
}

/** The UA Edition imported and its backlog recorded once, copied for every test. */
const importedDatabase = importedDatabases((database) =>
  createRecordings({
    database,
    clock: systemClock,
    store: memoryMediaStore(),
    generator: fakeGenerator(),
    editions,
    alerts: keptAlerts(),
    deployment: 'template',
    batch: 100_000,
  }).run(),
);

/** The backend on a database of its own, the UA Edition imported and its backlog recorded. */
async function recordingsBackend(store = keptStore()) {
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
  const alerts = keptAlerts();
  const run = (generator: RecordingGenerator, batch = 50, deployment = 'first') =>
    createRecordings({
      database,
      clock: systemClock,
      store,
      generator,
      editions,
      alerts,
      deployment,
      batch,
    }).run();
  return { ...backend, agent, batchId, store, alerts, run };
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

  it('stops after two runs in a row whose generator made no file, tells the owner once, and records again once the content changed', async () => {
    const { client, agent, batchId, alerts, run } = await recordingsBackend();
    await createWord(client, agent, batchId, 'обручичок', 3);
    const throwing: RecordingGenerator = { record: () => Promise.reject(new Error('timed out')) };

    expect(await run(throwing)).toMatchObject({ recorded: 0, failed: 1, stalled: 0 });
    expect(alerts.sent).toEqual([]);
    expect(await run(throwing)).toMatchObject({ recorded: 0, failed: 1, stalled: 0 });
    expect(alerts.sent).toEqual([
      { kind: 'recordings-stalled', editionId: 'uk', runs: 2, cause: 'nothing-made' },
    ]);

    const idle = fakeGenerator();
    expect(await run(idle)).toEqual({ recorded: 0, failed: 0, stalled: 1, deleted: 0 });
    expect(idle.asked).toEqual([]);
    expect(alerts.sent).toHaveLength(1);

    await createWord(client, agent, batchId, 'ґудзичок', 1);
    expect(await run(fakeGenerator())).toMatchObject({ recorded: 2, failed: 0, stalled: 0 });
  });

  it('stops after two runs in a row whose generator hit its time limit, though each made a Word', async () => {
    const { client, agent, batchId, alerts, run } = await recordingsBackend();
    for (const [lemma, stress] of [
      ['обручичок', 3],
      ['ґудзичок', 1],
      ['обручик', 3],
    ] as const)
      await createWord(client, agent, batchId, lemma, stress);
    // One Word is four requests, one in each Narrator Voice.
    const slow = timedOutGenerator(VOICES.length);

    expect(await run(slow)).toMatchObject({ recorded: 1, failed: 2, stalled: 0 });
    expect(alerts.sent).toEqual([]);
    expect(await run(slow)).toMatchObject({ recorded: 1, failed: 1, stalled: 0 });
    expect(alerts.sent).toEqual([
      { kind: 'recordings-stalled', editionId: 'uk', runs: 2, cause: 'time-limit' },
    ]);

    const idle = fakeGenerator();
    expect(await run(idle)).toMatchObject({ recorded: 0, stalled: 1 });
    expect(idle.asked).toEqual([]);
    expect(await run(fakeGenerator(), 50, 'second')).toMatchObject({ recorded: 1, stalled: 0 });
  });

  it('records again on a new deployment of the job after it stopped', async () => {
    const { client, agent, batchId, run } = await recordingsBackend();
    await createWord(client, agent, batchId, 'обручичок', 3);
    const throwing: RecordingGenerator = { record: () => Promise.reject(new Error('timed out')) };
    await run(throwing);
    await run(throwing);

    expect(await run(fakeGenerator(), 50, 'second')).toMatchObject({ recorded: 1, stalled: 0 });
  });

  it('counts only runs in a row that had Words, and starts again after a run that made a file', async () => {
    const { client, agent, batchId, alerts, run } = await recordingsBackend();
    const throwing: RecordingGenerator = { record: () => Promise.reject(new Error('timed out')) };
    await run(throwing);
    await run(throwing);
    await createWord(client, agent, batchId, 'обручичок', 3);
    await run(throwing);
    await createWord(client, agent, batchId, 'ґудзичок', 1);
    await run(fakeGenerator(), 1);
    await run(throwing);

    expect(alerts.sent).toEqual([]);
    expect(await run(fakeGenerator())).toMatchObject({ recorded: 1, stalled: 0 });
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

  it('keeps a Recording retired when a run puts its file again while the sweep deletes it', async () => {
    const store = keptStore();
    let during: ((key: string) => Promise<void>) | undefined;
    let onPut: ((key: string) => void) | undefined;
    const raced: MediaStore & { readonly keys: Set<string> } = {
      ...store,
      async put(key, bytes, type) {
        await store.put(key, bytes, type);
        onPut?.(key);
      },
      async delete(key) {
        const hook = during;
        during = undefined;
        await hook?.(key);
        await store.delete(key);
      },
    };
    const { client, agent, batchId, run } = await recordingsBackend(raced);
    const id = await createWord(client, agent, batchId, 'обручичок', 3);
    await run(fakeGenerator());
    const before = await versionOf(client);
    const word = (await client.content.snapshot({ editionId: 'uk' })).words.find(
      (found) => found.id === id,
    );
    if (word === undefined) throw new Error('no Word');
    const { id: _id, ...fields } = word;
    const edit = (lemma: string, recordVersion: number) =>
      agent.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id,
        batchId,
        recordVersion,
        fields: { ...fields, lemma },
      });
    await edit('обручик', 1);
    await run(fakeGenerator());
    passTime(RETIRED_FILE_KEPT_MS + 1);
    // Back to the first Lemma: a run would make the very files the sweep deletes.
    await edit('обручичок', 2);

    let other: Promise<unknown> | undefined;
    during = async (key) => {
      // The delete takes time; meanwhile another run makes the same file again.
      passTime(1);
      const put = new Promise<void>((resolve) => {
        onPut = (putKey) => {
          if (putKey === key) resolve();
        };
      });
      other = run(fakeGenerator());
      await put;
    };
    await run(fakeGenerator('обру'));
    await other;

    const live = (await patchSince(client, before)).recordings.filter(
      (row) => row.wordId === id && !row.retired,
    );
    expect(live.every((row) => store.keys.has(recordingPath(row)))).toBe(true);

    // A later run makes the files anew, and the Word is recorded.
    passTime(1);
    await run(fakeGenerator());
    const after = (await patchSince(client, before)).recordings.filter(
      (row) => row.wordId === id && !row.retired,
    );
    expect(after).toHaveLength(VOICES.length);
    expect(after.every((row) => store.keys.has(recordingPath(row)))).toBe(true);
  });
});
