import { randomUUID } from 'node:crypto';

import type { ApiClient } from '@slovo/contracts/api';
import { describe, expect, it } from 'vitest';

import { passTime, testApp } from '../test-support';

const MINUTE = 60 * 1000;

/** An email no other test uses. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** The backend, and the way a test signs a device in: a new Session of the email's Account. */
function syncing() {
  const backend = testApp();
  const { client, clientOf, mailer } = backend;
  async function signIn(email = newEmail()) {
    await client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    return { device: clientOf(token), token };
  }
  return { ...backend, signIn };
}

/** Every record the Account keeps in the Edition, pulled page by page from the start, and the cursor after them. */
async function pullAll(device: ApiClient) {
  const records = [];
  let cursor: number | undefined;
  for (;;) {
    const page = await device.sync.pull({ editionId: 'uk', after: cursor });
    records.push(...page.records);
    cursor = page.cursor;
    if (!page.more) return { records, cursor };
  }
}

const badRequest = { code: 'BAD_REQUEST', status: 400, defined: true };

describe('a record of a push', () => {
  it('with a key of more than 200 characters is BAD_REQUEST, and nothing of the push is kept', async () => {
    const { signIn } = syncing();
    const { device } = await signIn();
    const now = Date.now();
    // A character is a code point, so an emoji counts once.
    const fits = [
      { key: 'k'.repeat(200), value: true, changedAt: now },
      { key: '😀'.repeat(200), value: true, changedAt: now },
    ];

    await expect(
      device.sync.push({
        editionId: 'uk',
        changes: [...fits, { key: 'k'.repeat(201), value: true, changedAt: now }],
      }),
    ).rejects.toMatchObject(badRequest);
    await expect(pullAll(device)).resolves.toMatchObject({ records: [] });
    await expect(device.sync.push({ editionId: 'uk', changes: fits })).resolves.toEqual({});
  });

  it('with a value of more than 8 KB of JSON is BAD_REQUEST, and nothing of the push is kept', async () => {
    const { signIn } = syncing();
    const { device } = await signIn();
    const now = Date.now();
    // 8 KB is 8192 bytes of the value's JSON in UTF-8, its quotes included:
    // a Cyrillic letter takes two.
    const fits = [
      { key: 'notes.latin', value: 'a'.repeat(8190), changedAt: now },
      { key: 'notes.cyrillic', value: 'ж'.repeat(4095), changedAt: now },
    ];

    for (const over of ['a'.repeat(8191), 'ж'.repeat(4096), { text: 'a'.repeat(8190) }]) {
      await expect(
        device.sync.push({
          editionId: 'uk',
          changes: [...fits, { key: 'notes.over', value: over, changedAt: now }],
        }),
      ).rejects.toMatchObject(badRequest);
    }
    await expect(pullAll(device)).resolves.toMatchObject({ records: [] });
    await expect(device.sync.push({ editionId: 'uk', changes: fits })).resolves.toEqual({});
  });
});

describe('the largest push', () => {
  it('fits under the limit of a request body', async () => {
    const { signIn } = syncing();
    const { device } = await signIn();
    const now = Date.now();
    // A control character takes six bytes of JSON (`\u0001`), the most a
    // character of a key takes; the value is 8192 bytes of JSON, quotes included.
    const changes = Array.from({ length: 500 }, (_, index) => ({
      key: String(index).padStart(200, '\u0001'),
      value: '\u0001'.repeat(1365),
      changedAt: now,
    }));

    await expect(device.sync.push({ editionId: 'uk', changes })).resolves.toEqual({});
  });
});

// Each test keeps 20 000 records, 40 pushes and 40 pulls, which takes a
// while beside the other files.
describe('the records of an Account in an Edition', { timeout: 60_000 }, () => {
  /** Pushes the records `history.0` to `history.<count - 1>`, 500 a push, the first 500 tombstones. */
  async function keep(device: ApiClient, count: number, changedAt: number) {
    for (let start = 0; start < count; start += 500) {
      const changes = Array.from({ length: Math.min(500, count - start) }, (_, index) => ({
        key: `history.${String(start + index)}`,
        value: start === 0 ? null : true,
        changedAt,
      }));
      await device.sync.push({ editionId: 'uk', changes });
    }
  }

  it('are at most 20 000, tombstones included: a push over is TOO_MANY_RECORDS, and nothing of it is kept', async () => {
    const { signIn } = syncing();
    const email = newEmail();
    // Each Session counts its own requests, so the tablet reads what the phone keeps.
    const { device: phone } = await signIn(email);
    const { device: tablet } = await signIn(email);
    const now = Date.now();
    await keep(phone, 19_999, now - 1);
    const kept = await pullAll(tablet);
    expect(kept.records).toHaveLength(19_999);

    // The 20 000th and the 20 001st record, with a record kept replaced.
    const overTheLimit = phone.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'history.0', value: true, changedAt: now },
        { key: 'favorites.aa', value: true, changedAt: now },
        { key: 'favorites.bb', value: true, changedAt: now },
      ],
    });

    await expect(overTheLimit).rejects.toMatchObject({
      code: 'TOO_MANY_RECORDS',
      status: 409,
      defined: true,
    });
    await expect(tablet.sync.pull({ editionId: 'uk', after: kept.cursor })).resolves.toEqual({
      records: [],
      cursor: kept.cursor,
      more: false,
    });
    // The 20 000th record alone fits.
    const last = { key: 'favorites.aa', value: true, changedAt: now };
    await expect(phone.sync.push({ editionId: 'uk', changes: [last] })).resolves.toEqual({});
    await expect(tablet.sync.pull({ editionId: 'uk', after: kept.cursor })).resolves.toMatchObject({
      records: [last],
    });
  });

  it('are at most 20 000 when two pushes come at once: one is kept, the other is TOO_MANY_RECORDS', async () => {
    const { signIn } = syncing();
    const email = newEmail();
    const { device: phone } = await signIn(email);
    const { device: tablet } = await signIn(email);
    const now = Date.now();
    await keep(phone, 19_500, now - 1);

    // Each push alone fits, but not both.
    const pushes = await Promise.allSettled(
      [phone, tablet].map((device, index) =>
        device.sync.push({
          editionId: 'uk',
          changes: Array.from({ length: 500 }, (_, n) => ({
            key: `favorites.${String(index)}.${String(n)}`,
            value: true,
            changedAt: now,
          })),
        }),
      ),
    );

    expect(pushes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(pushes.find((push) => push.status === 'rejected')?.reason).toMatchObject({
      code: 'TOO_MANY_RECORDS',
    });
    expect((await pullAll(tablet)).records).toHaveLength(20_000);
  });

  it('at the limit still take a push that only replaces records kept', async () => {
    const { signIn } = syncing();
    const email = newEmail();
    const { device: phone } = await signIn(email);
    const { device: tablet } = await signIn(email);
    const now = Date.now();
    await keep(phone, 20_000, now - 1);
    await expect(
      phone.sync.push({
        editionId: 'uk',
        changes: [{ key: 'favorites.aa', value: true, changedAt: now }],
      }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_RECORDS' });
    const kept = await pullAll(tablet);
    expect(kept.records).toHaveLength(20_000);

    // A value in place of a tombstone, a tombstone in place of a value, and a change that loses.
    const replaced = [
      { key: 'history.0', value: 'again', changedAt: now },
      { key: 'history.500', value: null, changedAt: now },
    ];
    await expect(
      phone.sync.push({
        editionId: 'uk',
        changes: [...replaced, { key: 'history.501', value: false, changedAt: now - 2 }],
      }),
    ).resolves.toEqual({});

    await expect(tablet.sync.pull({ editionId: 'uk', after: kept.cursor })).resolves.toMatchObject({
      records: replaced,
      more: false,
    });
  });
});

describe('the Sync requests of one Session', () => {
  it('are at most 120 in 10 minutes, pushes and pulls together: the 121st is TOO_MANY_REQUESTS with Retry-After', async () => {
    const { signIn, request } = syncing();
    const email = newEmail();
    const { device, token } = await signIn(email);
    const now = Date.now();
    for (let sent = 0; sent < 60; sent++) {
      await device.sync.push({
        editionId: 'uk',
        changes: [{ key: `history.${String(sent)}`, value: true, changedAt: now }],
      });
      await device.sync.pull({ editionId: 'uk' });
    }
    passTime(4 * MINUTE);

    const pull = await request('/v1/editions/uk/records', {
      headers: { authorization: `Bearer ${token}` },
    });
    const push = await device.sync
      .push({ editionId: 'uk', changes: [{ key: 'favorites.aa', value: true, changedAt: now }] })
      .catch((error: unknown) => error);

    expect({
      status: pull.status,
      body: (await pull.json()) as unknown,
      retryAfter: pull.headers.get('retry-after'),
    }).toMatchObject({
      status: 429,
      body: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' },
      // The 10 minutes began with the first request, 4 minutes ago.
      retryAfter: '360',
    });
    expect(push).toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      status: 429,
      defined: true,
    });
    // Another Session of the Account is not held back, and the push was not kept.
    const { device: tablet } = await signIn(email);
    const { records } = await pullAll(tablet);
    expect(records).toHaveLength(60);
    expect(records).not.toContainEqual(expect.objectContaining({ key: 'favorites.aa' }));
  });

  it('go through again when the 10 minutes have passed', async () => {
    const { signIn } = syncing();
    const { device } = await signIn();
    for (let sent = 0; sent < 120; sent++) await device.sync.pull({ editionId: 'uk' });
    passTime(10 * MINUTE - 1000);
    await expect(device.sync.pull({ editionId: 'uk' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    passTime(1000);

    await expect(
      device.sync.push({
        editionId: 'uk',
        changes: [{ key: 'favorites.aa', value: true, changedAt: Date.now() }],
      }),
    ).resolves.toEqual({});
    await expect(device.sync.pull({ editionId: 'uk' })).resolves.toMatchObject({
      records: [{ key: 'favorites.aa' }],
    });
  });
});
