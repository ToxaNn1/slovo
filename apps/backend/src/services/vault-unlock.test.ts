import { randomBytes } from 'node:crypto';

import { totpOf } from '@slovo/server-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { hmacSha1 } from '../admin/admin-store';
import { adminCookieOf, adminHeaders, signedInAdmin, testApp } from '../test-support';
import { VAULT_OFF } from './vault';

const MINUTE = 60 * 1000;
const START = new Date('2026-11-17T10:00:00Z').getTime();

/** Moves the backend's clock to the minutes after the start. */
const at = (minutes: number) => vi.setSystemTime(new Date(START + minutes * MINUTE));

afterEach(() => {
  vi.useRealTimers();
});

/** A fake secret, made for the test: never a real one. */
const fakeSecret = () => `fake-${randomBytes(12).toString('hex')}`;

/** A Власник signed in at the start, with a sealed token of Neon whose value the test made. */
async function ownerWithToken(options: Parameters<typeof testApp>[0] = {}) {
  at(0);
  const backend = testApp(options);
  const owner = await signedInAdmin(backend, 'owner');
  const services = owner.client.admin.services;
  const { services: all } = await services.list();
  const neon = all.find(({ name }) => name === 'Neon')?.id;
  if (neon === undefined) throw new Error('no Service Neon');
  const value = fakeSecret();
  const { entry } =
    options.vault === VAULT_OFF
      ? { entry: { id: crypto.randomUUID() } }
      : await services.addEntry({
          serviceId: neon,
          type: 'token',
          label: 'API key',
          note: null,
          value,
          reason: 'the Neon key',
        });
  /** The owner's TOTP of the current moment. */
  const totp = () => totpOf(hmacSha1, owner.enrolment.secret, new Date());
  return { backend, owner, services, entry, value, totp };
}

describe('the Vault unlock', () => {
  it('keeps reveal and copy locked before a TOTP, opens them for 15 minutes, then locks again', async () => {
    const { services, entry, value, totp } = await ownerWithToken();

    await expect(services.revealEntry({ id: entry.id })).rejects.toMatchObject({
      code: 'LOCKED',
      status: 423,
    });
    await expect(services.copyEntry({ id: entry.id })).rejects.toMatchObject({ code: 'LOCKED' });

    at(1);
    const { openUntil } = await services.unlockVault({ code: totp() });
    expect(openUntil).toBe(new Date(START + 16 * MINUTE).toISOString());
    expect(await services.revealEntry({ id: entry.id })).toEqual({ value });
    at(15.9);
    expect(await services.copyEntry({ id: entry.id })).toEqual({ value });

    at(16);
    await expect(services.revealEntry({ id: entry.id })).rejects.toMatchObject({ code: 'LOCKED' });
    await expect(services.copyEntry({ id: entry.id })).rejects.toMatchObject({ code: 'LOCKED' });
  });

  it('opens only the session that entered the code', async () => {
    const { backend, owner, services, entry, totp } = await ownerWithToken();
    at(1);
    const anonymous = backend.clientWith(adminHeaders());
    await anonymous.admin.requestCode({ email: owner.email });
    const code = backend.mailer.codeSentTo(owner.email);
    const response = await backend.request('/v1/admin/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ email: owner.email, code, factor: { kind: 'totp', totp: totp() } }),
    });
    const elsewhere = backend.clientWith(adminHeaders(adminCookieOf(response))).admin.services;

    at(2);
    await services.unlockVault({ code: totp() });

    await expect(elsewhere.revealEntry({ id: entry.id })).rejects.toMatchObject({
      code: 'LOCKED',
    });
    await owner.client.admin.signOut();
    await expect(services.revealEntry({ id: entry.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('refuses a wrong code, the code that signed in, and blocks after three', async () => {
    const { services, entry, totp } = await ownerWithToken();

    await expect(services.unlockVault({ code: totp() })).rejects.toMatchObject({
      code: 'WRONG_CODE',
      data: { attemptsLeft: 2 },
    });
    at(1);
    const wrong = totp() === '000000' ? '111111' : '000000';
    await expect(services.unlockVault({ code: wrong })).rejects.toMatchObject({
      code: 'WRONG_CODE',
      data: { attemptsLeft: 1 },
    });
    await expect(services.revealEntry({ id: entry.id })).rejects.toMatchObject({ code: 'LOCKED' });
    await expect(services.unlockVault({ code: wrong })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    await expect(services.unlockVault({ code: totp() })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('logs every reveal and copy by the entry, never the value', async () => {
    const { owner, services, entry, value, totp } = await ownerWithToken();

    at(1);
    await services.unlockVault({ code: totp() });
    await services.revealEntry({ id: entry.id });
    await services.copyEntry({ id: entry.id });

    const { actions } = await owner.client.admin.actions({});
    const rows = actions.filter(
      ({ what, after }) => what !== 'service.entry.add' && JSON.stringify(after).includes(entry.id),
    );
    expect(
      rows.map(({ who, what, before, after, reason }) => ({ who, what, before, after, reason })),
    ).toEqual(
      ['service.entry.copy', 'service.entry.reveal'].map((what) => ({
        who: { kind: 'admin-user', email: owner.email },
        what,
        before: null,
        after: { service: 'Neon', entry: entry.id, type: 'token' },
        reason: null,
      })),
    );
    expect(JSON.stringify(actions)).not.toContain(value);
  });

  it('answers NOT_FOUND for an unknown entry, and the vault-off error without VAULT_KEY', async () => {
    const open = await ownerWithToken();
    at(1);
    await open.services.unlockVault({ code: open.totp() });
    await expect(open.services.revealEntry({ id: crypto.randomUUID() })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const off = await ownerWithToken({ vault: VAULT_OFF });
    await expect(off.services.revealEntry({ id: off.entry.id })).rejects.toMatchObject({
      code: 'VAULT_OFF',
    });
  });

  it('refuses an Адмін', async () => {
    const { backend, entry } = await ownerWithToken();
    const admin = (await signedInAdmin(backend, 'admin')).client.admin.services;

    await expect(admin.unlockVault({ code: '123456' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(admin.revealEntry({ id: entry.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(admin.copyEntry({ id: entry.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
