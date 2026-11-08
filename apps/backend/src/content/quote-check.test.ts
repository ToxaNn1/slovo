import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { quoteOf } from '@slovo/content-rules';
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
  passTime,
  silentLogger,
  testApp,
  testDatabaseUrl,
} from '../test-support';
import { createQuoteCheck, QUOTE_CHECK_FRESHNESS_MS, type SourcePages } from './quote-check';

/** A copy of the UA Edition folder, removed after the file. */
const folder = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-quote-check-')), 'uk');
  cpSync(join(EDITIONS_DIR, 'uk'), dir, { recursive: true });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
})();

/** A source that holds the given pages and counts every fetch. */
function fakePages(pages: Record<string, string>): SourcePages & { readonly fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    get: (url) => {
      fetched.push(url);
      const body = pages[url];
      return Promise.resolve(
        body === undefined ? { status: 404, body: '' } : { status: 200, body },
      );
    },
  };
}

/** A goroh page with one dictionary article holding the text. */
const pageWith = (text: string) =>
  `<div class="article-block"><h2><span class="uppercase">слово</span></h2>` +
  `<p>${text}</p><div class="source-info">Тлумачний словник української мови</div></div>`;

/** The backend on a database of its own, the UA Edition imported, and an Агент's client. */
async function quoteCheckBackend() {
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
  const agent = backend.clientOf(token);
  const { batchId } = await agent.admin.content.openBatch({ editionId: 'uk' });
  const job = (pages: SourcePages) =>
    createQuoteCheck({ database, clock: systemClock, pages }).run();
  return { ...backend, admin, agent, batchId, job };
}

const QUOTE = 'Невеличке кільце з металу чи дерева.';

/** Creates a Word quoting QUOTE from the first source of an imported Word; its id and source. */
async function createQuoted(client: ApiClient, agent: ApiClient, batchId: string) {
  const [word] = (await client.content.snapshot({ editionId: 'uk' })).words;
  if (word === undefined) throw new Error('no Word');
  const url = word.sources[0]?.url;
  if (url === undefined) throw new Error('the Word has no source page');
  const { id: _id, ...fields } = word;
  const created = await agent.admin.content.create({
    editionId: 'uk',
    kind: 'word',
    batchId,
    fields: { ...fields, lemma: 'обручичок', stress: [3], primaryDefinition: QUOTE },
  });
  return { id: created.id, url };
}

const quoteCheckOf = async (agent: ApiClient) =>
  (await agent.admin.content.report({ editionId: 'uk' })).quoteCheck;

describe('the quote check job', () => {
  it('counts no imported record unverified and fetches no page for them', async () => {
    const { agent, job } = await quoteCheckBackend();
    const pages = fakePages({});

    expect(await quoteCheckOf(agent)).toEqual({ unverified: 0, failed: 0 });
    await job(pages);

    expect(pages.fetched).toEqual([]);
  });

  it('marks a created record unverified, then verified once its quote is on the page', async () => {
    const { client, agent, batchId, job } = await quoteCheckBackend();
    const { url } = await createQuoted(client, agent, batchId);

    expect(await quoteCheckOf(agent)).toEqual({ unverified: 1, failed: 0 });
    await job(fakePages({ [url]: pageWith(QUOTE) }));

    expect(await quoteCheckOf(agent)).toEqual({ unverified: 0, failed: 0 });
  });

  it('marks a quote the page does not hold with the finding; the record stays live and the save fetched nothing', async () => {
    const { client, agent, batchId, admin, job } = await quoteCheckBackend();
    const word = (await client.content.snapshot({ editionId: 'uk' })).words[0];
    const pages = fakePages({ [word?.sources[0]?.url ?? '']: pageWith('Зовсім інший текст.') });
    const { id, url } = await createQuoted(client, agent, batchId);

    expect(pages.fetched).toEqual([]);
    await job(pages);

    expect(await quoteCheckOf(agent)).toEqual({ unverified: 0, failed: 1 });
    const words = (await client.content.snapshot({ editionId: 'uk' })).words;
    expect(words.find((word) => word.id === id)).toMatchObject({ primaryDefinition: QUOTE });
    expect((await admin.actions('uk')).filter(({ what }) => what === 'content.word.flag')).toEqual([
      expect.objectContaining({
        who: { kind: 'command', command: 'quote-check' },
        reason: `quote not found: «${quoteOf(QUOTE)}» is not on ${url}`,
      }),
    ]);
  });

  it('reuses a cached page on the next run, and fetches it again once the cache is stale', async () => {
    const { client, agent, batchId, job } = await quoteCheckBackend();
    const { id, url } = await createQuoted(client, agent, batchId);
    const pages = fakePages({ [url]: pageWith(QUOTE) });
    await job(pages);
    const word = (await client.content.snapshot({ editionId: 'uk' })).words.find(
      (found) => found.id === id,
    );
    if (word === undefined) throw new Error('no Word');
    const edit = (recordVersion: number) =>
      agent.admin.content.edit({
        editionId: 'uk',
        kind: 'word',
        id,
        batchId,
        recordVersion,
        fields: { ...word, primaryDefinition: recordVersion === 1 ? QUOTE.slice(0, -1) : QUOTE },
      });

    await edit(1);
    expect(await quoteCheckOf(agent)).toEqual({ unverified: 1, failed: 0 });
    await job(pages);
    expect(pages.fetched).toEqual([url]);
    expect(await quoteCheckOf(agent)).toEqual({ unverified: 0, failed: 0 });

    passTime(QUOTE_CHECK_FRESHNESS_MS + 1);
    await edit(2);
    await job(pages);
    expect(pages.fetched).toEqual([url, url]);
  });
});
