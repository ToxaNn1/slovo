import { randomInt } from 'node:crypto';

import type { MistakeReport } from '@slovo/contracts';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { Database } from '../database/database';
import { mistakeReports, rateLimits } from '../database/schema';
import { newIp, passTime, testApp, testEditions } from '../test-support';

const DAY = 24 * 60 * 60 * 1000;

/**
 * A Word id no other test reports, since the tests of the file share its
 * database: the backend doesn't check that the Entry is in a pack.
 */
const newEntryId = () => `w_${randomInt(2 ** 47).toString(36)}`;

/** A valid report of a mistake in a Word of the UA Edition. */
const validReport = (entryId: string, change: Partial<MistakeReport> = {}): MistakeReport => ({
  editionId: 'uk',
  entryId,
  type: 'stress',
  comment: 'The Stress falls on the third syllable.',
  appVersion: '0.8.14',
  contentVersion: 42,
  ...change,
});

/** A report's body as JSON, for a test that sends its own request. */
const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

/** Every row the database keeps of reports of the Entry. */
const keptOf = ({ db }: Database, entryId: string) =>
  db.select().from(mistakeReports).where(eq(mistakeReports.entryId, entryId));

describe('reports.send', () => {
  it('keeps a valid report with its time of arrival and answers 202 with no body', async () => {
    const { request, database } = testApp();
    const entryId = newEntryId();
    passTime(1000);
    const arrived = new Date();

    const response = await request('/v1/reports', post(validReport(entryId)));

    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe('');
    await expect(keptOf(database, entryId)).resolves.toEqual([
      {
        id: expect.any(String) as unknown,
        editionId: 'uk',
        entryId,
        type: 'stress',
        comment: 'The Stress falls on the third syllable.',
        appVersion: '0.8.14',
        contentVersion: 42,
        receivedAt: arrived,
      },
    ]);
  });

  it('keeps the comment trimmed, and an empty one as empty', async () => {
    const { client, database } = testApp();
    const entryId = newEntryId();

    await client.reports.send(validReport(entryId, { comment: '  Typo in the Definition.  ' }));
    await client.reports.send(validReport(entryId, { type: 'typo', comment: '' }));

    const rows = await keptOf(database, entryId);
    expect(rows.map((row) => row.comment).sort()).toEqual(['', 'Typo in the Definition.']);
  });

  it('keeps no IP address, device id or Account, even from a signed-in device', async () => {
    const { request, database, ip } = testApp();
    const entryId = newEntryId();

    const response = await request(
      '/v1/reports',
      post(validReport(entryId), {
        authorization: 'Bearer a-session-token',
        'x-forwarded-for': '203.0.113.7',
      }),
    );

    expect(response.status).toBe(202);
    const [row] = await keptOf(database, entryId);
    // The row holds the report and its time, and nothing that names who sent it.
    expect(Object.keys(row ?? {}).sort()).toEqual([
      'appVersion',
      'comment',
      'contentVersion',
      'editionId',
      'entryId',
      'id',
      'receivedAt',
      'type',
    ]);
    const kept = JSON.stringify(row);
    expect(kept).not.toContain(ip);
    expect(kept).not.toContain('203.0.113.7');
    expect(kept).not.toContain('a-session-token');
  });

  it.each([
    ['an unknown type', { type: 'grammar' }],
    ['type other with no comment', { type: 'other', comment: '   ' }],
    ['a comment over 500 characters', { comment: 'а'.repeat(501) }],
    ['an app version that is not one', { appVersion: 'latest' }],
    ['a content version that is not a whole number', { contentVersion: 1.5 }],
    ['a device id', { deviceId: 'device-1' }],
    ['an Account', { accountId: 'account-1' }],
  ])('refuses a report with %s as 400 and keeps nothing', async (_, change) => {
    const { request, database } = testApp();
    const entryId = newEntryId();

    const response = await request('/v1/reports', post({ ...validReport(entryId), ...change }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(keptOf(database, entryId)).resolves.toEqual([]);
  });

  it('refuses a report whose Entry id is not one as BAD_REQUEST and keeps nothing', async () => {
    const { client, database } = testApp();

    await expect(client.reports.send(validReport('not-an-entry-id'))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
    await expect(keptOf(database, 'not-an-entry-id')).resolves.toEqual([]);
  });

  it('refuses a report with a field missing as BAD_REQUEST', async () => {
    const { client } = testApp();
    const { comment: _, ...withoutComment } = validReport(newEntryId());

    // The contract's types need every field, so the test slips one past them.
    await expect(client.reports.send(withoutComment as MistakeReport)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('answers an Edition it does not serve as NOT_FOUND and keeps nothing', async () => {
    const { client, database } = testApp();
    const entryId = newEntryId();

    await expect(
      client.reports.send(validReport(entryId, { editionId: 'xx' })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(keptOf(database, entryId)).resolves.toEqual([]);
  });

  it('answers an Edition with Mistake Reports switched off as NOT_FOUND and keeps nothing', async () => {
    const folder = testEditions(['off'], (config) => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, mistakeReports: false },
    }));
    const { client, database } = testApp({ editions: folder.read() });
    const entryId = newEntryId();

    await expect(
      client.reports.send(validReport(entryId, { editionId: 'off' })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(keptOf(database, entryId)).resolves.toEqual([]);
  });

  it('answers NOT_FOUND once the owner turns Mistake Reports off remotely', async () => {
    const { client, switchOff } = testApp({ editions: testEditions(['remote']).read() });
    await switchOff('remote', 'mistakeReports');

    await expect(
      client.reports.send(validReport(newEntryId(), { editionId: 'remote' })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

describe('the reports from one IP address', () => {
  it('are at most 10 a day: the 11th is TOO_MANY_REQUESTS with Retry-After, and keeps nothing', async () => {
    const { client, request, database } = testApp();
    const entryId = newEntryId();
    for (let sent = 0; sent < 10; sent++) {
      await client.reports.send(validReport(entryId));
    }
    passTime(DAY / 2);

    const eleventh = await request('/v1/reports', post(validReport(entryId)));

    expect(eleventh.status).toBe(429);
    await expect(eleventh.json()).resolves.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
    });
    expect(eleventh.headers.get('retry-after')).toBe(String(DAY / 2 / 1000));
    await expect(keptOf(database, entryId)).resolves.toHaveLength(10);
  });

  it('hold back no other IP address, and take reports again the next day', async () => {
    const { client, clientFrom, database } = testApp();
    const entryId = newEntryId();
    for (let sent = 0; sent < 10; sent++) {
      await client.reports.send(validReport(entryId));
    }
    await expect(client.reports.send(validReport(entryId))).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    await expect(clientFrom(newIp()).reports.send(validReport(entryId))).resolves.toBeUndefined();
    passTime(DAY);
    await expect(client.reports.send(validReport(entryId))).resolves.toBeUndefined();
    await expect(keptOf(database, entryId)).resolves.toHaveLength(12);
  });

  it('count an IPv6 client by its /64: the addresses of one share the count', async () => {
    const { clientFrom } = testApp();
    const entryId = newEntryId();
    for (let sent = 0; sent < 10; sent++) {
      await clientFrom(`2001:db8:9:1::${(sent + 1).toString(16)}`).reports.send(
        validReport(entryId),
      );
    }

    await expect(
      clientFrom('2001:db8:9:1::ff').reports.send(validReport(entryId)),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429 });
  });

  it('count no report to an Edition that does not take them', async () => {
    const { client } = testApp();
    for (let sent = 0; sent < 10; sent++) {
      await expect(
        client.reports.send(validReport(newEntryId(), { editionId: 'xx' })),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }

    await expect(client.reports.send(validReport(newEntryId()))).resolves.toBeUndefined();
  });

  it('are counted in a window that names no IP address', async () => {
    const { clientFrom, database } = testApp();
    const ip = '2001:db8:9:7::15';
    await clientFrom(ip).reports.send(validReport(newEntryId()));

    const keys = (await database.db.select({ key: rateLimits.key }).from(rateLimits)).map(
      (row) => row.key,
    );
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const key of keys) {
      expect(key).not.toContain('2001:db8');
      expect(key).not.toContain(':');
    }
  });
});
