import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';

import { PATCH_FORMAT, type ApiClient } from '@slovo/contracts/api';
import { eq, getTableColumns, is, type Column } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';

import * as schema from './database/schema';
import { accounts, sessions } from './database/schema';
import { createLogger } from './logger';
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
  // An Edition's Rules and force-update minimums, naming no reader.
  'feature',
  'verdict',
  'targets',
  'soft',
  'hard',
  // An Entry's Community Counters, totals that name no reader.
  'entryId',
  'known',
  'unknown',
  'saved',
  // The Community Word: an Entry and its Favorites adds of a week, naming no reader.
  'adds',
  // A Collection Link's Entries, as shared, naming no reader.
  'entryIds',
]);

/**
 * The internal columns a Collection Link's answers carry by design: its id
 * and the name of the Collection as shared, naming no reader. They stay
 * internal in every other answer, where an Account's or a Session's id or an
 * Account's name would show.
 */
const COLLECTION_LINK_KEYS = new Set(['id', 'name']);

/** The requests that answer Rules, whose own ids name no reader. */
const RULES_REQUEST = /\/switches(\/|$)/;

/** The requests of the Collection Links procedures. */
const COLLECTION_LINK_REQUEST = /^(POST|GET) \/v1\/collection-links(\/|$)/;

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

/** The requests that start a Session, whose answer carries its token. */
const SIGN_INS = new Set([
  'POST /v1/account/sessions',
  'POST /v1/account/google-sessions',
  'POST /v1/account/apple-sessions',
]);

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
  const { client, clientOf, answers, mailer, google, apple, keptSignInCode, db, pack, kill } =
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
        signInWithGoogle: async () => {
          const email = `reader-${randomUUID()}@example.com`;
          const idToken = google.token({ email });
          secrets.add(idToken);
          const { token } = await client.account.signInWithGoogle({ idToken, editionId: EDITION });
          const rows = await db
            .select({ session: sessions.token, method: schema.signInMethods.providerAccountId })
            .from(sessions)
            .innerJoin(accounts, eq(accounts.id, sessions.accountId))
            .innerJoin(schema.signInMethods, eq(schema.signInMethods.accountId, accounts.id))
            .where(eq(accounts.email, email));
          for (const row of rows) for (const secret of Object.values(row)) secrets.add(secret);
          await clientOf(token).account.me();
          /** A Google sign-in the backend refuses, whose token no answer may echo. */
          const refusedGoogle = async (refusedToken: string, editionId = EDITION) => {
            secrets.add(refusedToken);
            await client.account
              .signInWithGoogle({ idToken: refusedToken, editionId })
              .catch(refused);
          };
          await refusedGoogle('not-a-token');
          await refusedGoogle(google.token({ email }, { audience: 'another-app.example' }));
          await refusedGoogle(google.token({ email }, { expiresAt: new Date(Date.now() - 1000) }));
          await refusedGoogle(google.token({ email, emailVerified: false }));
          await refusedGoogle(google.token({ email }), 'pl');
          // Over the per-IP limit of Google sign-ins: TOO_MANY_REQUESTS with Retry-After.
          for (let tried = 0; tried < 30; tried++) {
            await client.account
              .signInWithGoogle({ idToken: google.token({ email }), editionId: EDITION })
              .catch(refused);
          }
          await refusedGoogle(google.token({ email }));
          const overLimit = answers.at(-1);
          expect(overLimit).toMatchObject({
            request: 'POST /v1/account/google-sessions',
            status: 429,
          });
          expect(overLimit?.headers).toContain('retry-after');
          await kill(EDITION, 'googleSignIn');
          await refusedGoogle(google.token({ email }));
        },
        signInWithApple: async () => {
          const email = `${randomUUID().slice(0, 12)}@privaterelay.appleid.com`;
          const idToken = apple.token({ email });
          secrets.add(idToken);
          const { token } = await client.account.signInWithApple({ idToken, editionId: EDITION });
          const rows = await db
            .select({ session: sessions.token, method: schema.signInMethods.providerAccountId })
            .from(sessions)
            .innerJoin(accounts, eq(accounts.id, sessions.accountId))
            .innerJoin(schema.signInMethods, eq(schema.signInMethods.accountId, accounts.id))
            .where(eq(accounts.email, email));
          for (const row of rows) for (const secret of Object.values(row)) secrets.add(secret);
          await clientOf(token).account.me();
          /** An Apple sign-in the backend refuses, whose token no answer may echo. */
          const refusedApple = async (refusedToken: string, editionId = EDITION) => {
            secrets.add(refusedToken);
            await client.account
              .signInWithApple({ idToken: refusedToken, editionId })
              .catch(refused);
          };
          await refusedApple('not-a-token');
          await refusedApple(apple.token({ email }, { audience: 'app.slovo.another' }));
          await refusedApple(apple.token({ email }, { expiresAt: new Date(Date.now() - 1000) }));
          await refusedApple(apple.token({ email }, { issuer: 'https://accounts.google.com' }));
          await refusedApple(apple.token({ email }), 'pl');
          // Over the per-IP limit of Apple sign-ins: TOO_MANY_REQUESTS with Retry-After.
          for (let tried = 0; tried < 30; tried++) {
            await client.account
              .signInWithApple({ idToken: apple.token({ email }), editionId: EDITION })
              .catch(refused);
          }
          await refusedApple(apple.token({ email }));
          expect(answers.at(-1)).toMatchObject({
            request: 'POST /v1/account/apple-sessions',
            status: 429,
          });
          await kill(EDITION, 'signInWithApple');
          await refusedApple(apple.token({ email }));
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
        // The records are the published content; what the import keeps beside them is checked.
        snapshot: async () => {
          for (const row of await db.select().from(schema.contentBatches)) secrets.add(row.id);
          await client.content.snapshot({ editionId: EDITION }).catch(refused);
          await client.content.snapshot({ editionId: 'pl' }).catch(refused);
        },
        // The records are the published content; what the import keeps beside them is checked.
        patch: async () => {
          for (const row of await db.select().from(schema.contentBatches)) secrets.add(row.id);
          const ask = (editionId: string, patchFormat: number) =>
            client.content.patch({ params: { editionId }, query: { since: 0, patchFormat } });
          await ask(EDITION, PATCH_FORMAT).catch(refused);
          await ask(EDITION, PATCH_FORMAT + 1).catch(refused);
          await ask('pl', PATCH_FORMAT).catch(refused);
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
      admin: {
        // No Власник in this database: every admin procedure answers 404.
        requestCode: async () => {
          await client.admin.requestCode({ email: 'admin@example.com' }).catch(refused);
        },
        verifyCode: async () => {
          await client.admin
            .verifyCode({ email: 'admin@example.com', code: '000000' })
            .catch(refused);
        },
        signIn: async () => {
          await client.admin
            .signIn({
              email: 'admin@example.com',
              code: '000000',
              factor: { kind: 'totp', totp: '000000' },
            })
            .catch(refused);
        },
        me: async () => {
          await client.admin.me().catch(refused);
        },
        sessions: async () => {
          await client.admin.sessions().catch(refused);
        },
        signOut: async () => {
          await client.admin.signOut().catch(refused);
        },
        signOutEverywhere: async () => {
          await client.admin.signOutEverywhere().catch(refused);
        },
        people: async () => {
          await client.admin.people().catch(refused);
        },
        invite: async () => {
          await client.admin
            .invite({ email: 'admin@example.com', role: 'admin', reason: 'help' })
            .catch(refused);
        },
        setRole: async () => {
          await client.admin
            .setRole({ email: 'admin@example.com', role: 'owner', reason: 'trust' })
            .catch(refused);
        },
        removePerson: async () => {
          await client.admin
            .removePerson({ email: 'admin@example.com', reason: 'left' })
            .catch(refused);
        },
        agentTokens: async () => {
          await client.admin.agentTokens().catch(refused);
        },
        issueAgentToken: async () => {
          await client.admin.issueAgentToken({ name: 'claude', reason: 'batches' }).catch(refused);
        },
        revokeAgentToken: async () => {
          await client.admin.revokeAgentToken({ name: 'claude', reason: 'leaked' }).catch(refused);
        },
        actions: async () => {
          await client.admin.actions({}).catch(refused);
        },
        status: async () => {
          // No Власник in this database: the admin API answers 404.
          await client.admin.status().catch(refused);
        },
        switches: async () => {
          await client.admin.switches({ editionId: EDITION }).catch(refused);
        },
        setRules: async () => {
          await client.admin
            .setRules({ editionId: EDITION, feature: 'game', rules: [], reason: 'leak' })
            .catch(refused);
        },
        setMinimum: async () => {
          await client.admin
            .setMinimum({
              editionId: EDITION,
              platform: 'ios',
              minimum: { soft: '1.0.0' },
              reason: 'leak',
            })
            .catch(refused);
        },
        kill: async () => {
          await client.admin.kill({ feature: 'game', reason: 'leak' }).catch(refused);
        },
        editions: async () => {
          await client.admin.editions().catch(refused);
        },
        editionCard: async () => {
          await client.admin.editionCard({ editionId: EDITION }).catch(refused);
        },
        content: async () => {
          const { content } = client.admin;
          const editionId = EDITION;
          const batchId = '00000000-0000-4000-8000-000000000000';
          const record = { editionId, kind: 'word' as const, batchId };
          await content.openBatch({ editionId }).catch(refused);
          await content.create({ ...record, fields: {} }).catch(refused);
          await content
            .edit({ ...record, id: 'w_a1', recordVersion: 1, fields: {} })
            .catch(refused);
          await content.retire({ ...record, id: 'w_a1', recordVersion: 1 }).catch(refused);
          await content.flag({ ...record, id: 'w_a1', reason: 'check' }).catch(refused);
          await content.report({ editionId }).catch(refused);
          await content.records({ editionId, kind: 'word' }).catch(refused);
        },
        development: async () => {
          await client.admin.development().catch(refused);
        },
      },
      collectionLinks: {
        create: async () => {
          const link = { edition: EDITION, name: 'reader@example.com', entryIds: ['w_a1'] };
          await client.collectionLinks.create(link);
          await client.collectionLinks.create({ ...link, edition: 'pl' }).catch(refused);
        },
        read: async () => {
          const link = { edition: EDITION, name: 'Осінь', entryIds: ['w_a1'] };
          const { id } = await client.collectionLinks.create(link);
          await client.collectionLinks.read({ id });
          await client.collectionLinks.read({ id: 'aZ3kQ9mB0x' }).catch(refused);
        },
      },
      counters: {
        send: async () => {
          const events = [{ entryId: 'w_a1', known: 1, unknown: 0, saved: 1 } as const];
          await client.counters.send({ editionId: EDITION, events }).catch(refused);
          await client.counters.send({ editionId: 'pl', events }).catch(refused);
        },
        read: async () => {
          await client.counters.read({ edition: EDITION, entries: 'w_a1,c_a1' }).catch(refused);
          await client.counters.read({ edition: 'pl', entries: 'w_a1' }).catch(refused);
        },
        communityWord: async () => {
          await client.counters.communityWord({ edition: EDITION }).catch(refused);
          await client.counters.communityWord({ edition: 'pl' }).catch(refused);
        },
        questionnaire: async () => {
          const answer = { question: 'level', answer: 'studying' } as const;
          await client.counters.questionnaire({ editionId: EDITION, ...answer }).catch(refused);
          await client.counters.questionnaire({ editionId: 'pl', ...answer }).catch(refused);
        },
      },
      edition: {
        switches: async () => {
          const params = { editionId: EDITION };
          const { headers } = await client.edition.switches({ params });
          await kill(EDITION, 'game');
          await client.edition.switches({ params, headers: { 'if-none-match': headers.etag } });
          await client.edition.switches({ params: { editionId: 'pl' } }).catch(refused);
        },
      },
      reports: {
        send: async () => {
          const report = {
            editionId: EDITION,
            entryId: 'w_a1',
            type: 'other',
            comment: 'reader@example.com',
            appVersion: '0.8.14',
            contentVersion: 1,
          } as const;
          await client.reports.send(report).catch(refused);
          await client.reports.send({ ...report, comment: '' }).catch(refused);
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
      SIGN_INS.has(request) && status === 200 ? { ...(body as object), token: undefined } : body;
    const text = `${headers} ${JSON.stringify(shown)}`;
    expect({
      request,
      secrets: [...secrets].filter((secret) => text.includes(secret)),
      columns: keysOf(body).filter(
        (key) =>
          INTERNAL_COLUMNS.includes(key) &&
          !(COLLECTION_LINK_REQUEST.test(request) && COLLECTION_LINK_KEYS.has(key)) &&
          !(RULES_REQUEST.test(request) && key === 'id'),
      ),
      password: /password/i.test(text),
      cookie: /set-cookie|set-auth-token/i.test(headers),
    }).toEqual({ request, secrets: [], columns: [], password: false, cookie: false });
  }
});

it('logs an unexpected failure whose message quotes an email with no email', async () => {
  const lines: string[] = [];
  const logger = createLogger(
    new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    }),
  );
  const email = `reader-${randomUUID()}@example.com`;
  const { client } = testApp({
    logger,
    google: { verify: () => Promise.reject(new Error(`User ${email} not found`)) },
  });

  const failure = client.account.signInWithGoogle({ idToken: 'a-token', editionId: 'uk' });

  await expect(failure).rejects.toMatchObject({ status: 500 });
  expect(lines.join('')).toContain('unexpected failure');
  expect(lines.join('')).not.toContain(email);
});
