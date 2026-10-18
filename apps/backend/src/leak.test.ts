import { randomUUID } from 'node:crypto';

import type { ApiClient } from '@slovo/contracts/api';
import { eq, getTableColumns, is, type Column } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';

import * as schema from './database/schema';
import { accounts, sessions } from './database/schema';
import { testApp, testEditions } from './test-support';

/** The Edition of this test, with a published pack. */
const EDITION = 'probe';

/**
 * The columns whose names the contract's answers carry by design. Every
 * other column is internal and never named in an answer.
 */
const ANSWERED_COLUMNS = new Set([
  'email',
  'createdAt',
  'token',
  'contentVersion',
  'packFormat',
  'size',
  'fileSha256',
  'off',
]);

/**
 * The fields of a record in a Sync answer. They name the device's own data,
 * and the value holds it, so they are never read as columns; any other field
 * of a record is.
 */
const RECORD_FIELDS = new Set(['key', 'value', 'changedAt']);

/** The names of every internal column, as the schema and as the database name them. */
const INTERNAL_COLUMNS = Object.values(schema)
  .flatMap((value) => (is(value, PgTable) ? Object.entries<Column>(getTableColumns(value)) : []))
  .filter(([key]) => !ANSWERED_COLUMNS.has(key))
  .flatMap(([key, column]) => [key, column.name]);

/** One answer of the API, as its client got it. */
interface Answer {
  readonly request: string;
  readonly status: number;
  readonly headers: string;
  /** The JSON body; none for a file or an empty body. */
  readonly body: unknown;
}

/** Every key of a JSON value, however deep, but the fields of a Sync record (`RECORD_FIELDS`). */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, inner]) =>
    key === 'records' && Array.isArray(inner)
      ? [key, ...inner.flatMap((record) => Object.keys(record as object))].filter(
          (name) => !RECORD_FIELDS.has(name),
        )
      : [key, ...keysOf(inner)],
  );
}

/** The backend serving an Edition with a published pack, whose answers the test keeps. */
async function recordedBackend() {
  const folder = testEditions([EDITION]);
  const pack = folder.buildPack(EDITION);
  const answers: Answer[] = [];
  const backend = testApp({
    editions: folder.read(),
    onAnswer: async (request, response) => {
      answers.push({
        request: `${request.method} ${new URL(request.url).pathname}`,
        status: response.status,
        headers: JSON.stringify([...response.headers]),
        body: response.headers.get('content-type')?.includes('json')
          ? await response.clone().json()
          : undefined,
      });
    },
  });
  const published = await backend.publish(pack);
  if (!published.ok) throw new Error(`Pack not published: ${published.reason}`);
  return { ...backend, answers, db: backend.database.db, pack: published.pack };
}

it("answers no stored token, Sign-in code or its hash, password field, internal column or another Account's record in any procedure", async () => {
  const { client, clientOf, answers, mailer, keptSignInCode, db, pack, switchOff } =
    await recordedBackend();
  /** What the database keeps that no answer may show. */
  const secrets = new Set<string>();
  const refused = () => undefined;

  async function requestCode(email: string) {
    await client.account.requestCode({ email, editionId: EDITION });
    const code = mailer.codeSentTo(email);
    secrets.add(code);
    const kept = await keptSignInCode(email);
    if (kept === undefined) throw new Error(`no Sign-in code is kept for ${email}`);
    secrets.add(kept.id);
    secrets.add(kept.hash);
    return code;
  }

  async function signIn() {
    const email = `reader-${randomUUID()}@example.com`;
    const { token } = await client.account.verifyCode({ email, code: await requestCode(email) });
    const rows = await db
      .select({ account: accounts.id, session: sessions.id, token: sessions.token })
      .from(sessions)
      .innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(eq(accounts.email, email));
    for (const row of rows) for (const secret of Object.values(row)) secrets.add(secret);
    return clientOf(token);
  }

  // One run of each procedure, answering and refusing; the types ask for every one.
  const procedures: { [D in keyof ApiClient]: Record<keyof ApiClient[D], () => Promise<unknown>> } =
    {
      account: {
        requestCode: async () => {
          await requestCode(`reader-${randomUUID()}@example.com`);
          await client.account
            .requestCode({ email: 'not an email', editionId: EDITION })
            .catch(refused);
          await client.account
            .requestCode({ email: 'reader@example.com', editionId: 'pl' })
            .catch(refused);
        },
        verifyCode: async () => {
          const email = `reader-${randomUUID()}@example.com`;
          const code = await requestCode(email);
          const wrong = code === '000000' ? '111111' : '000000';
          await client.account.verifyCode({ email, code: wrong }).catch(refused);
          await client.account.verifyCode({ email, code });
          await client.account.verifyCode({ email, code }).catch(refused);
          await signIn();
        },
        me: async () => {
          await (await signIn()).account.me();
          await client.account.me().catch(refused);
        },
        signOut: async () => {
          const device = (await signIn()).account;
          await device.signOut();
          await device.signOut().catch(refused);
        },
        signOutEverywhere: async () => {
          const device = (await signIn()).account;
          await device.signOutEverywhere();
          await device.signOutEverywhere().catch(refused);
        },
        delete: async () => {
          const device = (await signIn()).account;
          await device.delete();
          await device.delete().catch(refused);
        },
      },
      content: {
        latest: async () => {
          for (const row of await db.select().from(schema.contentPacks)) {
            secrets.add(row.id);
            secrets.add(row.contentChecksum);
          }
          await client.content.latest({ editionId: EDITION, packFormat: 1 });
          await client.content.latest({ editionId: 'pl', packFormat: 1 }).catch(refused);
          await client.content.latest({ editionId: EDITION, packFormat: 0 }).catch(refused);
        },
        // The bytes are the published pack, which any app may download; its headers are checked.
        download: async () => {
          const params = { editionId: EDITION, contentVersion: pack.contentVersion };
          await client.content.download({ params });
          await client.content.download({
            params,
            headers: { 'if-none-match': `"${pack.fileSha256}"` },
          });
          await client.content
            .download({ params: { ...params, contentVersion: pack.contentVersion + 1 } })
            .catch(refused);
        },
      },
      edition: {
        switches: async () => {
          const params = { editionId: EDITION };
          const { headers } = await client.edition.switches({ params });
          await switchOff(EDITION, 'game');
          await client.edition.switches({ params, headers: { 'if-none-match': headers.etag } });
          await client.edition.switches({ params: { editionId: 'pl' } }).catch(refused);
        },
      },
      sync: {
        push: async () => {
          const device = await signIn();
          const changes = [{ key: 'favorites.aa', value: true, changedAt: Date.now() }];
          await device.sync.push({ editionId: EDITION, changes });
          await device.sync.push({ editionId: 'pl', changes }).catch(refused);
          await client.sync.push({ editionId: EDITION, changes }).catch(refused);
        },
        pull: async () => {
          // Another Account's record, which no answer to the reader may carry.
          const other = await signIn();
          const theirs = `theirs-${randomUUID()}`;
          secrets.add(theirs);
          await other.sync.push({
            editionId: EDITION,
            changes: [{ key: `favorites.${theirs}`, value: theirs, changedAt: Date.now() }],
          });
          const reader = await signIn();
          await reader.sync.push({
            editionId: EDITION,
            changes: [
              { key: 'favorites.aa', value: { savedAt: new Date().toISOString() }, changedAt: 0 },
              { key: 'favorites.bb', value: null, changedAt: 0 },
            ],
          });
          const { cursor } = await reader.sync.pull({ editionId: EDITION });
          await reader.sync.pull({ editionId: EDITION, after: cursor });
          await reader.sync.pull({ editionId: 'pl' }).catch(refused);
          await client.sync.pull({ editionId: EDITION }).catch(refused);
        },
      },
    };
  for (const domain of Object.values(procedures)) {
    for (const run of Object.values(domain)) await run();
  }

  expect(answers.length).toBeGreaterThan(20);
  for (const { request, status, headers, body } of answers) {
    // A new Session's token is the one secret an answer carries, to its own device.
    const shown =
      request === 'POST /v1/account/sessions' && status === 200
        ? { ...(body as object), token: undefined }
        : body;
    const text = `${headers} ${JSON.stringify(shown)}`;
    expect({
      request,
      secrets: [...secrets].filter((secret) => text.includes(secret)),
      columns: keysOf(body).filter((key) => INTERNAL_COLUMNS.includes(key)),
      password: /password/i.test(text),
      cookie: /set-cookie|set-auth-token/i.test(headers),
    }).toEqual({ request, secrets: [], columns: [], password: false, cookie: false });
  }
});
