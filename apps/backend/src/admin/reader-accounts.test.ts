import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { adminHeaders, signedInAdmin, testApp } from '../test-support';

const newEmail = () => `reader-${randomUUID()}@example.com`;

/** A backend whose admin is on, with a signed-in Власник and a way to sign readers in. */
async function ownerOn() {
  const backend = testApp();
  const owner = await signedInAdmin(backend, 'owner');
  /** The Account procedures of a device signed in to the email's Account. */
  async function signInReader(email: string) {
    await backend.client.account.requestCode({ email, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email,
      code: backend.mailer.codeSentTo(email),
    });
    return backend.clientOf(token).account;
  }
  return { ...backend, owner, signInReader };
}

describe('a reader Account in Безпека', () => {
  it('lets a Власник find an Account by email: its date and its Google and Apple sign-in methods', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    await backend.signInReader(email);
    await backend.client.account.signInWithGoogle({
      idToken: backend.google.token({ email }),
      editionId: 'uk',
    });
    const createdAt = (await backend.rowsOf(email)).account?.createdAt.toISOString();

    await expect(
      backend.owner.client.admin.findAccount({ email: ` ${email.toUpperCase()} ` }),
    ).resolves.toEqual({ account: { email, createdAt, signInMethods: ['google'] } });
  });

  it('answers no Account for an unknown email', async () => {
    const backend = await ownerOn();

    await expect(backend.owner.client.admin.findAccount({ email: newEmail() })).resolves.toEqual({
      account: null,
    });
  });

  it('deletes the Account as the app does, signing its devices out, and logs who, which email and why', async () => {
    const backend = await ownerOn();
    const email = newEmail();
    const other = newEmail();
    const phone = await backend.signInReader(email);
    const otherReader = await backend.signInReader(other);

    await expect(
      backend.owner.client.admin.deleteAccount({ email, reason: 'spam Account' }),
    ).resolves.toEqual({ deleted: true });

    expect((await backend.rowsOf(email)).account).toBeUndefined();
    await expect(phone.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(otherReader.me()).resolves.toMatchObject({ email: other });
    await expect(backend.owner.client.admin.findAccount({ email })).resolves.toEqual({
      account: null,
    });
    const { actions } = await backend.owner.client.admin.actions({});
    expect(actions[0]).toMatchObject({
      who: { kind: 'admin-user', email: backend.owner.email },
      what: 'account.delete',
      before: { email },
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
      await expect(caller.admin.findAccount({ email })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(caller.admin.deleteAccount({ email, reason: 'try' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    expect((await backend.rowsOf(email)).account).toBeDefined();
  });
});
