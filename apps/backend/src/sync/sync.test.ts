import { randomUUID } from 'node:crypto';

import type { ApiClient } from '@slovo/contracts/api';
import type { EditionConfig } from '@slovo/contracts';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accounts, userRecords } from '../database/schema';
import { passTime, testApp, testEditions } from '../test-support';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** An email no other test uses. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/**
 * The backend serving Editions of the ids, and the way a test signs a device
 * in: the client of a new Session of the email's Account.
 */
function syncing(
  ids: readonly string[] = ['uk'],
  change?: (config: EditionConfig) => EditionConfig,
) {
  const backend = testApp({ editions: testEditions(ids, change).read() });
  const { client, clientOf, mailer } = backend;
  async function signIn(email = newEmail()): Promise<ApiClient> {
    await client.account.requestCode({ email, editionId: ids[0] ?? 'uk' });
    const { token } = await client.account.verifyCode({ email, code: mailer.codeSentTo(email) });
    return clientOf(token);
  }
  return { ...backend, signIn };
}

/** Every record the Account keeps in the Edition, pulled page by page from the start. */
async function pullAll(device: ApiClient, editionId = 'uk') {
  const records = [];
  let after: number | undefined;
  for (;;) {
    const page = await device.sync.pull({ editionId, after });
    records.push(...page.records);
    after = page.cursor;
    if (!page.more) return records;
  }
}

describe('sync.push and sync.pull', () => {
  it('pull answers the records a push kept, each with its value and change time, and the cursor', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    const changes = [
      { key: 'favorites.aa', value: { savedAt: '2026-10-18T09:00:00.000Z' }, changedAt: now - 2 },
      { key: 'settings.theme', value: 'dark', changedAt: now - 1 },
      { key: 'game.best', value: 12, changedAt: now },
    ];

    await expect(phone.sync.push({ editionId: 'uk', changes })).resolves.toEqual({});
    const pulled = await phone.sync.pull({ editionId: 'uk' });

    expect(pulled).toEqual({
      records: changes,
      cursor: expect.any(Number) as unknown,
      more: false,
    });
  });

  it('answers the records of another device of the Account', async () => {
    const { signIn } = syncing();
    const email = newEmail();
    const phone = await signIn(email);
    const tablet = await signIn(email);
    const change = { key: 'favorites.aa', value: true, changedAt: Date.now() };

    await phone.sync.push({ editionId: 'uk', changes: [change] });

    await expect(pullAll(tablet)).resolves.toEqual([change]);
  });

  it('answers nothing for an Account that kept nothing, with the cursor asked after', async () => {
    const { signIn } = syncing();
    const phone = await signIn();

    await expect(phone.sync.pull({ editionId: 'uk' })).resolves.toEqual({
      records: [],
      cursor: 0,
      more: false,
    });
    await expect(phone.sync.pull({ editionId: 'uk', after: 41 })).resolves.toEqual({
      records: [],
      cursor: 41,
      more: false,
    });
  });
});

describe('the cursor', () => {
  it('answers only the records kept after it, in the order they were kept', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'favorites.aa', value: true, changedAt: now }],
    });
    const { cursor } = await phone.sync.pull({ editionId: 'uk' });
    const later = [
      { key: 'favorites.bb', value: true, changedAt: now },
      { key: 'favorites.cc', value: true, changedAt: now },
    ];

    await phone.sync.push({ editionId: 'uk', changes: later });

    await expect(phone.sync.pull({ editionId: 'uk', after: cursor })).resolves.toMatchObject({
      records: later,
      more: false,
    });
  });

  it('pages the records by the limit, and says whether more follow', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    const changes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
      key: `favorites.${id}`,
      value: true,
      changedAt: now,
    }));
    await phone.sync.push({ editionId: 'uk', changes });

    const first = await phone.sync.pull({ editionId: 'uk', limit: 2 });
    const second = await phone.sync.pull({ editionId: 'uk', after: first.cursor, limit: 2 });
    const third = await phone.sync.pull({ editionId: 'uk', after: second.cursor, limit: 2 });

    expect(first).toMatchObject({ records: changes.slice(0, 2), more: true });
    expect(second).toMatchObject({ records: changes.slice(2, 4), more: true });
    expect(third).toMatchObject({ records: changes.slice(4), more: false });
    await expect(
      phone.sync.pull({ editionId: 'uk', after: third.cursor, limit: 2 }),
    ).resolves.toEqual({ records: [], cursor: third.cursor, more: false });
  });

  it('answers at most 500 records a page', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    for (const batch of [0, 1]) {
      const changes = Array.from({ length: 300 }, (_, index) => ({
        key: `history.${String(batch)}-${String(index)}`,
        value: true,
        changedAt: now,
      }));
      await phone.sync.push({ editionId: 'uk', changes });
    }

    const first = await phone.sync.pull({ editionId: 'uk' });
    const second = await phone.sync.pull({ editionId: 'uk', after: first.cursor });

    expect(first.records).toHaveLength(500);
    expect(first.more).toBe(true);
    expect(second.records).toHaveLength(100);
    expect(second.more).toBe(false);
  });

  it('answers a replaced record again after it, and once', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    await phone.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'settings.theme', value: 'light', changedAt: now - 1 },
        { key: 'settings.fontSize', value: 'M', changedAt: now - 1 },
      ],
    });
    const { cursor } = await phone.sync.pull({ editionId: 'uk' });

    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'dark', changedAt: now }],
    });

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'settings.fontSize', value: 'M', changedAt: now - 1 },
      { key: 'settings.theme', value: 'dark', changedAt: now },
    ]);
    await expect(phone.sync.pull({ editionId: 'uk', after: cursor })).resolves.toMatchObject({
      records: [{ key: 'settings.theme', value: 'dark' }],
    });
  });
});

describe('the change time', () => {
  /** A device that kept `settings.theme` as `light` at `now`, a minute ago. */
  async function keptLight() {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    passTime(MINUTE);
    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'light', changedAt: now }],
    });
    const { cursor } = await phone.sync.pull({ editionId: 'uk' });
    return { phone, now, cursor };
  }

  it('lets a later change replace the record kept', async () => {
    const { phone, now } = await keptLight();

    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'dark', changedAt: now + 1 }],
    });

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'settings.theme', value: 'dark', changedAt: now + 1 },
    ]);
  });

  it('ignores an earlier change without an error, and the cursor does not move', async () => {
    const { phone, now, cursor } = await keptLight();

    await expect(
      phone.sync.push({
        editionId: 'uk',
        changes: [{ key: 'settings.theme', value: 'dark', changedAt: now - DAY }],
      }),
    ).resolves.toEqual({});

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'settings.theme', value: 'light', changedAt: now },
    ]);
    await expect(phone.sync.pull({ editionId: 'uk', after: cursor })).resolves.toEqual({
      records: [],
      cursor,
      more: false,
    });
  });

  it('keeps the record kept on a tie', async () => {
    const { phone, now, cursor } = await keptLight();

    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'dark', changedAt: now }],
    });

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'settings.theme', value: 'light', changedAt: now },
    ]);
    await expect(phone.sync.pull({ editionId: 'uk', after: cursor })).resolves.toMatchObject({
      records: [],
    });
  });

  it('keeps an old offline change of 0 only where the Account has no record', async () => {
    const { phone } = await keptLight();

    await phone.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'settings.theme', value: 'dark', changedAt: 0 },
        { key: 'settings.fontSize', value: 'L', changedAt: 0 },
      ],
    });

    await expect(pullAll(phone)).resolves.toMatchObject([
      { key: 'settings.theme', value: 'light' },
      { key: 'settings.fontSize', value: 'L', changedAt: 0 },
    ]);
  });

  it("cuts a change time later than the server's down to the server's time", async () => {
    const { signIn } = syncing();
    const email = newEmail();
    const fastClock = await signIn(email);
    const rightClock = await signIn(email);
    const now = Date.now();

    await fastClock.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'dark', changedAt: now + 30 * DAY }],
    });
    const cut = await pullAll(rightClock);
    passTime(MINUTE);
    await rightClock.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'light', changedAt: now + MINUTE }],
    });

    expect(cut).toEqual([{ key: 'settings.theme', value: 'dark', changedAt: now }]);
    await expect(pullAll(fastClock)).resolves.toEqual([
      { key: 'settings.theme', value: 'light', changedAt: now + MINUTE },
    ]);
  });

  it('keeps the latest of two changes of one key in one push, and the first on a tie', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();

    await phone.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'settings.theme', value: 'light', changedAt: now - 1 },
        { key: 'settings.theme', value: 'dark', changedAt: now },
        { key: 'settings.theme', value: 'system', changedAt: now - 2 },
        { key: 'settings.fontSize', value: 'S', changedAt: now },
        { key: 'settings.fontSize', value: 'XL', changedAt: now },
      ],
    });

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'settings.theme', value: 'dark', changedAt: now },
      { key: 'settings.fontSize', value: 'S', changedAt: now },
    ]);
  });

  it("picks the later of two changes of one key by the device's times, before the cut", async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();

    await phone.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'settings.theme', value: 'light', changedAt: now + DAY },
        { key: 'settings.theme', value: 'dark', changedAt: now + 2 * DAY },
      ],
    });

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'settings.theme', value: 'dark', changedAt: now },
    ]);
  });
});

describe('a tombstone', () => {
  it('pulls as a tombstone, and replaces the record kept when it is later', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'favorites.aa', value: true, changedAt: now - 1 }],
    });

    await phone.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'favorites.aa', value: null, changedAt: now },
        { key: 'favorites.bb', value: null, changedAt: now },
      ],
    });

    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'favorites.aa', value: null, changedAt: now },
      { key: 'favorites.bb', value: null, changedAt: now },
    ]);
  });

  it('stops an earlier change from bringing the record back, and a later one brings it', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const now = Date.now();
    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'favorites.aa', value: null, changedAt: now - 1 }],
    });

    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'favorites.aa', value: true, changedAt: now - 2 }],
    });
    const deleted = await pullAll(phone);
    await phone.sync.push({
      editionId: 'uk',
      changes: [{ key: 'favorites.aa', value: true, changedAt: now }],
    });

    expect(deleted).toEqual([{ key: 'favorites.aa', value: null, changedAt: now - 1 }]);
    await expect(pullAll(phone)).resolves.toEqual([
      { key: 'favorites.aa', value: true, changedAt: now },
    ]);
  });
});

describe('the records of an Account in an Edition', () => {
  it("are never another Account's", async () => {
    const { signIn } = syncing();
    const reader = await signIn();
    const other = await signIn();
    const now = Date.now();

    await reader.sync.push({
      editionId: 'uk',
      changes: [{ key: 'settings.theme', value: 'dark', changedAt: now }],
    });
    await other.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'settings.theme', value: 'light', changedAt: now },
        { key: 'favorites.aa', value: true, changedAt: now },
      ],
    });

    await expect(pullAll(reader)).resolves.toEqual([
      { key: 'settings.theme', value: 'dark', changedAt: now },
    ]);
  });

  it("are never the same Account's in another Edition", async () => {
    const { signIn } = syncing(['uk', 'pl']);
    const reader = await signIn();
    const now = Date.now();

    await reader.sync.push({
      editionId: 'uk',
      changes: [{ key: 'favorites.aa', value: true, changedAt: now }],
    });
    await reader.sync.push({
      editionId: 'pl',
      changes: [{ key: 'favorites.aa', value: null, changedAt: now - 1 }],
    });

    await expect(pullAll(reader, 'uk')).resolves.toEqual([
      { key: 'favorites.aa', value: true, changedAt: now },
    ]);
    await expect(pullAll(reader, 'pl')).resolves.toEqual([
      { key: 'favorites.aa', value: null, changedAt: now - 1 },
    ]);
  });

  it('go with the Account when it is deleted, in every Edition', async () => {
    const { signIn, database } = syncing(['uk', 'pl']);
    const email = newEmail();
    const phone = await signIn(email);
    const change = { key: 'favorites.aa', value: true, changedAt: Date.now() };
    for (const editionId of ['uk', 'pl']) {
      await phone.sync.push({ editionId, changes: [change] });
    }
    const [account] = await database.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email));
    const keptOf = () =>
      database.db
        .select({ key: userRecords.key })
        .from(userRecords)
        .where(eq(userRecords.accountId, account?.id ?? ''));
    expect(await keptOf()).toHaveLength(2);

    await phone.account.delete();

    expect(await keptOf()).toEqual([]);
    const again = await signIn(email);
    await expect(pullAll(again, 'uk')).resolves.toEqual([]);
    await expect(pullAll(again, 'pl')).resolves.toEqual([]);
  });
});

/** Each Sync procedure, run once in the Edition. The types ask for a new one. */
const syncProcedures: Record<
  keyof ApiClient['sync'],
  (device: ApiClient, editionId: string) => Promise<unknown>
> = {
  push: (device, editionId) =>
    device.sync.push({
      editionId,
      changes: [{ key: 'favorites.aa', value: true, changedAt: Date.now() }],
    }),
  pull: (device, editionId) => device.sync.pull({ editionId }),
};

const notFound = { code: 'NOT_FOUND', status: 404, defined: true };

describe('a Sync procedure', () => {
  it.each(Object.entries(syncProcedures))(
    '%s is UNAUTHORIZED without a Session and after the Session ended',
    async (_, run) => {
      const { client, signIn } = syncing();
      const phone = await signIn();
      await phone.account.signOut();

      for (const device of [client, phone]) {
        await expect(run(device, 'uk')).rejects.toMatchObject({
          code: 'UNAUTHORIZED',
          status: 401,
          defined: true,
        });
      }
    },
  );

  it.each(Object.entries(syncProcedures))(
    '%s is NOT_FOUND in an Edition the backend did not find',
    async (_, run) => {
      const { signIn } = syncing();

      await expect(run(await signIn(), 'pl')).rejects.toMatchObject(notFound);
    },
  );

  it.each(['sync', 'account'] as const)(
    'is NOT_FOUND in an Edition that switches %s off',
    async (feature) => {
      const { signIn } = syncing(['on', 'off'], (config) =>
        config.id === 'off'
          ? { ...config, featureSwitches: { ...config.featureSwitches, [feature]: false } }
          : config,
      );
      const phone = await signIn();

      for (const run of Object.values(syncProcedures)) {
        await expect(run(phone, 'off')).rejects.toMatchObject(notFound);
        await expect(run(phone, 'on')).resolves.toBeDefined();
      }
    },
  );

  it.each(['sync', 'account'] as const)(
    'is NOT_FOUND while %s is turned off remotely, and served once it is cleared',
    async (feature) => {
      const { signIn, switchOff, clearSwitch } = syncing();
      const phone = await signIn();

      await switchOff('uk', feature);
      for (const run of Object.values(syncProcedures)) {
        await expect(run(phone, 'uk')).rejects.toMatchObject(notFound);
      }
      await clearSwitch('uk', feature);
      for (const run of Object.values(syncProcedures)) {
        await expect(run(phone, 'uk')).resolves.toBeDefined();
      }
    },
  );
});

describe('a push', () => {
  it('of more than 500 changes is BAD_REQUEST, and nothing of it is kept', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    const changes = Array.from({ length: 501 }, (_, index) => ({
      key: `history.${String(index)}`,
      value: true,
      changedAt: Date.now(),
    }));

    await expect(phone.sync.push({ editionId: 'uk', changes })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
    await expect(pullAll(phone)).resolves.toEqual([]);
  });

  it('with a change that names another Account is BAD_REQUEST', async () => {
    const { signIn } = syncing();
    const phone = await signIn();
    // The contract's types allow no such field, so the test slips one past them.
    const change = { key: 'favorites.aa', value: true, changedAt: 0, accountId: randomUUID() };

    await expect(phone.sync.push({ editionId: 'uk', changes: [change] })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('with a change time before 1970 or not whole is BAD_REQUEST', async () => {
    const { signIn } = syncing();
    const phone = await signIn();

    for (const changedAt of [-1, 1.5]) {
      await expect(
        phone.sync.push({
          editionId: 'uk',
          changes: [{ key: 'favorites.aa', value: true, changedAt }],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    }
  });
});

describe('a pull', () => {
  it('of more than 500 records, or none, is BAD_REQUEST', async () => {
    const { signIn } = syncing();
    const phone = await signIn();

    for (const limit of [501, 0]) {
      await expect(phone.sync.pull({ editionId: 'uk', limit })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        status: 400,
      });
    }
  });
});
