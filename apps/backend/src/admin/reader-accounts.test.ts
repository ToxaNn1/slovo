import { randomUUID } from 'node:crypto';

import { describe, expect, it, onTestFinished } from 'vitest';

import { ACCOUNTS_PAGE_SIZE } from '@slovo/contracts/admin-api';

import { createDatabase, type Database } from '../database/database';
import {
  adminHeaders,
  importedDatabases,
  passTime,
  signedInAdmin,
  silentLogger,
  testApp,
} from '../test-support';

const newEmail = () => `reader-${randomUUID()}@example.com`;
/** A part of an email no other test's Account carries. */
const newTag = () => `t${randomUUID().slice(0, 8)}`;

const importedDatabase = importedDatabases();

/** A backend whose admin is on, with a signed-in Власник and a way to sign readers in. */
async function ownerOn(database?: Database) {
  const backend = testApp(database === undefined ? {} : { database });
  const owner = await signedInAdmin(backend, 'owner');
  /** A device signed in to the email's Account. */
  async function signInDevice(email: string) {
    await backend.client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email,
      code: backend.mailer.codeSentTo(email),
    });
    return backend.clientOf(token);
  }
  /** The Account procedures of a device signed in to the email's Account. */
  const signInReader = async (email: string) => (await signInDevice(email)).account;
  /** The id of the email's Account. */
  async function idOf(email: string) {
    const { account } = await backend.rowsOf(email);
    if (account === undefined) throw new Error(`${email} has no Account`);
    return account.id;
  }
  return { ...backend, owner, signInDevice, signInReader, idOf };
}

describe('a reader Account in Безпека', () => {
  it('lists every Account for a Власник, newest first, with its date and Google and Apple sign-in methods', async () => {
    const backend = await ownerOn();
    const tag = newTag();
    const first = `${tag}-a@example.com`;
    const second = `${tag}-b@example.com`;
    const third = `${tag}-c@example.com`;
    for (const email of [first, second, third]) {
      await backend.signInReader(email);
      passTime(1000);
    }
    await backend.client.account.signInWithGoogle({
      idToken: backend.google.token({ email: second }),
      editionId: 'uk',
    });
    const rowOf = async (email: string) => {
      const { account } = await backend.rowsOf(email);
      return {
        id: account?.id,
        email,
        createdAt: account?.createdAt.toISOString(),
        signInMethods: email === second ? ['google'] : [],
      };
    };

    await expect(backend.owner.client.admin.listAccounts({ search: tag })).resolves.toEqual({
      accounts: [await rowOf(third), await rowOf(second), await rowOf(first)],
      total: 3,
    });
  });

  it('narrows the list by a part of an email, in any case, and takes its wildcards as text', async () => {
    const backend = await ownerOn();
    const tag = newTag();
    await backend.signInReader(`${tag}-anna@example.com`);
    await backend.signInReader(`${tag}-boris@example.com`);

    const { accounts, total } = await backend.owner.client.admin.listAccounts({
      search: ` ${tag.toUpperCase()}-ANN `,
    });
    expect(accounts.map(({ email }) => email)).toEqual([`${tag}-anna@example.com`]);
    expect(total).toBe(1);
    await expect(backend.owner.client.admin.listAccounts({ search: `${tag}-%` })).resolves.toEqual({
      accounts: [],
      total: 0,
    });
  });

  it('lists a page at a time, with the count of every match on each', async () => {
    const backend = await ownerOn();
    const tag = newTag();
    const emails = Array.from(
      { length: ACCOUNTS_PAGE_SIZE + 1 },
      (_, i) => `${tag}-${String(i)}@example.com`,
    );
    for (const [i, email] of emails.entries()) {
      // Past the per-IP limit of Google sign-ins.
      if (i % 25 === 24) passTime(11 * 60 * 1000);
      await backend.client.account.signInWithGoogle({
        idToken: backend.google.token({ email }),
        editionId: 'uk',
      });
      passTime(1000);
    }

    const page1 = await backend.owner.client.admin.listAccounts({ search: tag });
    const page2 = await backend.owner.client.admin.listAccounts({ search: tag, page: 2 });
    const page3 = await backend.owner.client.admin.listAccounts({ search: tag, page: 3 });
    expect(page1.accounts).toHaveLength(ACCOUNTS_PAGE_SIZE);
    expect(page1.accounts[0]?.email).toBe(emails.at(-1));
    expect(page2.accounts.map(({ email }) => email)).toEqual([emails[0]]);
    expect(page3.accounts).toEqual([]);
    expect([page1.total, page2.total, page3.total]).toEqual([51, 51, 51]);
  });

  it('writes nothing to the Action log for opening the list', async () => {
    const backend = await ownerOn();
    const before = (await backend.owner.client.admin.actions({})).actions;

    await backend.owner.client.admin.listAccounts({});

    expect((await backend.owner.client.admin.actions({})).actions).toEqual(before);
  });

  it("opens one Account with its sign-in methods and every Edition's Sync records, a tombstone left out", async () => {
    const backend = await ownerOn();
    const email = newEmail();
    const device = await backend.signInDevice(email);
    await backend.client.account.signInWithGoogle({
      idToken: backend.google.token({ email }),
      editionId: 'uk',
    });
    // Long past, so the server's own time never caps it.
    const at = Date.parse('2026-01-01T00:00:00.000Z');
    await device.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'favorites.w_a1', value: '2026-11-01T10:00:00.000Z', changedAt: at },
        { key: 'knowledge.w_b2', value: { mark: 'known', learned: false }, changedAt: at + 1 },
        { key: 'hidden.w_c3', value: null, changedAt: at + 2 },
      ],
    });
    const { account } = await backend.rowsOf(email);

    await expect(
      backend.owner.client.admin.getAccount({ accountId: await backend.idOf(email) }),
    ).resolves.toEqual({
      account: {
        id: account?.id,
        email,
        createdAt: account?.createdAt.toISOString(),
        signInMethods: ['google'],
        editions: [
          {
            editionId: 'uk',
            records: [
              { key: 'favorites.w_a1', value: '2026-11-01T10:00:00.000Z', changedAt: at },
              {
                key: 'knowledge.w_b2',
                value: { mark: 'known', learned: false },
                changedAt: at + 1,
              },
            ],
            entries: [],
          },
        ],
      },
    });
  });

  it('opens an Account with the Entries its records name, as the content database keeps them now, and no others', async () => {
    const own = await importedDatabase();
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    const backend = await ownerOn(database);
    const { words } = await backend.client.content.snapshot({ editionId: 'uk' });
    const [favorite, collected, seen] = words;
    if (favorite === undefined || collected === undefined || seen === undefined) {
      throw new Error('no Words');
    }
    const email = newEmail();
    const device = await backend.signInDevice(email);
    const at = Date.parse('2026-01-01T00:00:00.000Z');
    await device.sync.push({
      editionId: 'uk',
      changes: [
        { key: `favorites.${favorite.id}`, value: '2026-11-01T10:00:00.000Z', changedAt: at },
        {
          key: `collectionEntries.c1.${collected.id}`,
          value: '2026-11-01T10:00:00.000Z',
          changedAt: at,
        },
        { key: 'knowledge.w_nosuchword', value: { mark: 'known' }, changedAt: at },
        // History is counted on the page, never named, so its Entries are not read.
        {
          key: `history.${seen.id}`,
          value: { seenAt: '2026-11-01T10:00:00.000Z', wordOfTheDay: false },
          changedAt: at,
        },
      ],
    });

    const opened = await backend.owner.client.admin.getAccount({
      accountId: await backend.idOf(email),
    });

    const entry = ({ id, ...fields }: typeof favorite) => ({
      id,
      kind: 'word',
      fields: expect.objectContaining(fields) as unknown,
      retired: false,
    });
    expect(opened.account?.editions).toEqual([expect.objectContaining({ editionId: 'uk' })]);
    expect(opened.account?.editions[0]?.entries).toEqual(
      expect.arrayContaining([entry(favorite), entry(collected)]),
    );
    expect(opened.account?.editions[0]?.entries).toHaveLength(2);
  });

  it('opens an Account with no Sync records with no Editions, an unknown one as none, and logs neither', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    await backend.signInReader(email);
    const before = (await backend.owner.client.admin.actions({})).actions;

    const opened = await backend.owner.client.admin.getAccount({
      accountId: await backend.idOf(email),
    });
    expect(opened.account?.email).toBe(email);
    expect(opened.account?.editions).toEqual([]);
    await expect(
      backend.owner.client.admin.getAccount({ accountId: randomUUID() }),
    ).resolves.toEqual({ account: null });
    expect((await backend.owner.client.admin.actions({})).actions).toEqual(before);
  });

  it('lets the deleted email sign in to a new, empty Account', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    const device = await backend.signInDevice(email);
    await device.sync.push({
      editionId: 'uk',
      changes: [
        { key: 'favorites.w_a1', value: '2026-11-01T10:00:00.000Z', changedAt: Date.now() },
      ],
    });
    const deletedId = await backend.idOf(email);
    await backend.owner.client.admin.deleteAccount({ email, reason: 'test Account' });

    const again = await backend.signInDevice(email);

    const newId = await backend.idOf(email);
    expect(newId).not.toBe(deletedId);
    await expect(again.sync.pull({ editionId: 'uk' })).resolves.toMatchObject({ records: [] });
    const opened = await backend.owner.client.admin.getAccount({ accountId: newId });
    expect(opened.account?.editions).toEqual([]);
    await expect(backend.owner.client.admin.getAccount({ accountId: deletedId })).resolves.toEqual({
      account: null,
    });
  });

  it('deletes the Account as the app does, signing its devices out, and logs who, which email and why', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    const other = newEmail();
    const phone = await backend.signInReader(email);
    const otherReader = await backend.signInReader(other);
    const { account: created } = await backend.rowsOf(email);

    await expect(
      backend.owner.client.admin.deleteAccount({ email, reason: 'spam Account' }),
    ).resolves.toEqual({ deleted: true });

    expect((await backend.rowsOf(email)).account).toBeUndefined();
    await expect(phone.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(otherReader.me()).resolves.toMatchObject({ email: other });
    await expect(backend.owner.client.admin.listAccounts({ search: email })).resolves.toEqual({
      accounts: [],
      total: 0,
    });
    const { actions } = await backend.owner.client.admin.actions({});
    expect(actions[0]).toMatchObject({
      who: { kind: 'admin-user', email: backend.owner.email },
      what: 'account.delete',
      before: { email, createdAt: created?.createdAt.toISOString() },
      after: null,
      reason: 'spam Account',
      editionId: null,
    });
  });

  it('refuses an unknown email as unknown, and changes nothing', async () => {
    const backend = await ownerOn();
    const before = (await backend.owner.client.admin.actions({})).actions;

    await expect(
      backend.owner.client.admin.deleteAccount({ email: newEmail(), reason: 'spam' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', data: { refusal: 'unknown' } });

    expect((await backend.owner.client.admin.actions({})).actions).toEqual(before);
  });

  it('needs a reason', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    await backend.signInReader(email);

    await expect(
      backend.owner.client.admin.deleteAccount({ email, reason: '  ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect((await backend.rowsOf(email)).account).toBeDefined();
  });

  it('refuses an Адмін and an Агент, and the Account stays', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    await backend.signInReader(email);
    const adminUser = await signedInAdmin(backend, 'admin');
    const { token } = await backend.owner.client.admin.issueAgentToken({
      name: `agent-${randomUUID().slice(0, 8)}`,
      reason: 'content',
    });
    const agent = backend.clientWith({ ...adminHeaders(), authorization: `Bearer ${token}` });

    for (const caller of [adminUser.client, agent]) {
      await expect(caller.admin.listAccounts({})).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        caller.admin.getAccount({ accountId: await backend.idOf(email) }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(caller.admin.deleteAccount({ email, reason: 'try' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    expect((await backend.rowsOf(email)).account).toBeDefined();
  });
});
