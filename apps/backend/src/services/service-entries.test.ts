import { randomBytes, randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { adminHeaders, signedInAdmin, testApp } from '../test-support';
import { createVault, VAULT_OFF } from './vault';

/** A backend whose admin is on, with a signed-in Власник; its Vault is on under a fake key unless given. */
async function ownerOn(options: Parameters<typeof testApp>[0] = {}) {
  const backend = testApp(options);
  return { ...backend, owner: await signedInAdmin(backend, 'owner') };
}

/** The id of the Service of the name. */
async function serviceId(backend: Awaited<ReturnType<typeof ownerOn>>, name: string) {
  const { services } = await backend.owner.client.admin.services.list();
  const id = services.find((service) => service.name === name)?.id;
  if (id === undefined) throw new Error(`no Service ${name}`);
  return id;
}

/** A fake secret, made for the test: never a real one. */
const fakeSecret = () => `fake-${randomBytes(12).toString('hex')}`;

describe('the Service entries', () => {
  it('keep a login and a link in the open and never answer a sealed value', async () => {
    const backend = await ownerOn();
    const neon = await serviceId(backend, 'Neon');
    const services = backend.owner.client.admin.services;
    const password = fakeSecret();
    const codes = fakeSecret();

    const login = await services.addEntry({
      serviceId: neon,
      type: 'login',
      label: 'Account',
      note: null,
      value: 'owner@example.com',
      reason: 'the Neon login',
    });
    const sealed = await services.addEntry({
      serviceId: neon,
      type: 'password',
      label: 'Password',
      note: 'the console',
      value: password,
      reason: 'the Neon password',
    });
    await services.addEntry({
      serviceId: neon,
      type: 'recovery-codes',
      label: 'Codes',
      note: null,
      value: codes,
      reason: 'the recovery codes',
    });

    expect(login.entry).toMatchObject({ type: 'login', value: 'owner@example.com' });
    expect(sealed.entry).toEqual({
      id: sealed.entry.id,
      serviceId: neon,
      type: 'password',
      label: 'Password',
      note: 'the console',
    });
    const read = await services.entries({ serviceId: neon });
    expect(read.vault).toBe('on');
    const ours = read.entries.filter(({ id }) =>
      [login, sealed].some(({ entry }) => entry.id === id),
    );
    expect(ours).toEqual([login.entry, sealed.entry]);
    expect(read.entries.map(({ type }) => type)).toContain('recovery-codes');
    const everyRead = JSON.stringify([read, await services.list(), sealed]);
    expect(everyRead).not.toContain(password);
    expect(everyRead).not.toContain(codes);
  });

  it('change and delete an entry, the Action log naming the fields and never a value', async () => {
    const backend = await ownerOn();
    const sentry = await serviceId(backend, 'Sentry');
    const services = backend.owner.client.admin.services;
    const before = fakeSecret();
    const after = fakeSecret();
    const { entry } = await services.addEntry({
      serviceId: sentry,
      type: 'token',
      label: 'Read token',
      note: null,
      value: before,
      reason: 'Якість reads Sentry',
    });

    const edited = await services.editEntry({
      id: entry.id,
      label: 'Read token',
      note: 'SENTRY_AUTH_TOKEN',
      value: after,
      reason: 'rotated',
    });
    await services.deleteEntry({ id: entry.id, reason: 'no longer used' });

    expect(edited.entry).toEqual({ ...entry, note: 'SENTRY_AUTH_TOKEN' });
    const left = (await services.entries({ serviceId: sentry })).entries;
    expect(left.map(({ id }) => id)).not.toContain(entry.id);
    const { actions } = await backend.owner.client.admin.actions({});
    const rows = actions.filter(({ after: now }) => JSON.stringify(now).includes(entry.id));
    expect(
      rows.map(({ who, what, before: was, after: now, reason }) => ({
        who,
        what,
        was,
        now,
        reason,
      })),
    ).toEqual([
      {
        who: { kind: 'admin-user', email: backend.owner.email },
        what: 'service.entry.delete',
        was: null,
        now: { service: 'Sentry', entry: entry.id, type: 'token', fields: [] },
        reason: 'no longer used',
      },
      {
        who: { kind: 'admin-user', email: backend.owner.email },
        what: 'service.entry.edit',
        was: null,
        now: { service: 'Sentry', entry: entry.id, type: 'token', fields: ['note', 'value'] },
        reason: 'rotated',
      },
      {
        who: { kind: 'admin-user', email: backend.owner.email },
        what: 'service.entry.add',
        was: null,
        now: {
          service: 'Sentry',
          entry: entry.id,
          type: 'token',
          fields: ['type', 'label', 'note', 'value'],
        },
        reason: 'Якість reads Sentry',
      },
    ]);
    expect(JSON.stringify(actions)).not.toContain(before);
    expect(JSON.stringify(actions)).not.toContain(after);
  });

  it('change a login in the open', async () => {
    const backend = await ownerOn();
    const github = await serviceId(backend, 'GitHub');
    const services = backend.owner.client.admin.services;
    const { entry } = await services.addEntry({
      serviceId: github,
      type: 'link',
      label: 'Billing',
      note: null,
      value: 'https://github.com/settings/billing',
      reason: 'the billing page',
    });

    const edited = await services.editEntry({
      id: entry.id,
      value: 'https://github.com/settings/billing/summary',
      reason: 'moved',
    });

    expect(edited.entry).toMatchObject({ value: 'https://github.com/settings/billing/summary' });
  });

  it('change a sealed value without opening the old one: only a reveal opens it', async () => {
    const sealer = createVault(randomBytes(32));
    if (sealer.state !== 'on') throw new Error('the Vault is off');
    const backend = await ownerOn({
      vault: {
        ...sealer,
        open: () => {
          throw new Error('a sealed value was opened outside a reveal');
        },
      },
    });
    const sentry = await serviceId(backend, 'Sentry');
    const services = backend.owner.client.admin.services;
    const { entry } = await services.addEntry({
      serviceId: sentry,
      type: 'token',
      label: 'Read token',
      note: null,
      value: fakeSecret(),
      reason: 'Якість reads Sentry',
    });

    await services.editEntry({ id: entry.id, value: fakeSecret(), reason: 'rotated' });

    const { actions } = await backend.owner.client.admin.actions({});
    const edit = actions.find(({ what }) => what === 'service.entry.edit');
    expect(edit?.after).toEqual({
      service: 'Sentry',
      entry: entry.id,
      type: 'token',
      fields: ['value'],
    });
  });

  it('need a reason, and refuse an unknown Service or entry', async () => {
    const backend = await ownerOn();
    const services = backend.owner.client.admin.services;
    const zoho = await serviceId(backend, 'Zoho Mail');

    await expect(
      services.addEntry({
        serviceId: zoho,
        type: 'password',
        label: 'Password',
        note: null,
        value: fakeSecret(),
        reason: ' ',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(services.entries({ serviceId: randomUUID() })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      services.addEntry({
        serviceId: randomUUID(),
        type: 'login',
        label: 'Account',
        note: null,
        value: 'owner@example.com',
        reason: 'a login',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(services.deleteEntry({ id: randomUUID(), reason: 'gone' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('answer the vault-off error to every write without VAULT_KEY', async () => {
    const backend = await ownerOn({ vault: VAULT_OFF });
    const services = backend.owner.client.admin.services;
    const neon = await serviceId(backend, 'Neon');

    await expect(
      services.addEntry({
        serviceId: neon,
        type: 'login',
        label: 'Account',
        note: null,
        value: 'owner@example.com',
        reason: 'the Neon login',
      }),
    ).rejects.toMatchObject({ code: 'VAULT_OFF', status: 503 });
    await expect(
      services.editEntry({ id: randomUUID(), label: 'Account', reason: 'renamed' }),
    ).rejects.toMatchObject({ code: 'VAULT_OFF' });
    await expect(services.deleteEntry({ id: randomUUID(), reason: 'gone' })).rejects.toMatchObject({
      code: 'VAULT_OFF',
    });
    expect((await services.entries({ serviceId: neon })).vault).toBe('off');
  });

  it('refuse an Адмін and an Агент', async () => {
    const backend = await ownerOn();
    const neon = await serviceId(backend, 'Neon');
    const admin = await signedInAdmin(backend, 'admin');
    const { token } = await backend.owner.client.admin.issueAgentToken({
      name: `agent-${randomUUID().slice(0, 8)}`,
      reason: 'content batches',
    });
    const entry = {
      serviceId: neon,
      type: 'token',
      label: `API key ${randomUUID()}`,
      note: null,
      value: fakeSecret(),
      reason: 'a key',
    } as const;

    await expect(admin.client.admin.services.entries({ serviceId: neon })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(admin.client.admin.services.addEntry(entry)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const asAgent = { ...adminHeaders(), authorization: `Bearer ${token}` };
    const read = await backend.request(`/v1/admin/services/${neon}/entries`, { headers: asAgent });
    const write = await backend.request(`/v1/admin/services/${neon}/entries`, {
      method: 'POST',
      headers: { ...asAgent, 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    });
    expect([read.status, write.status]).toEqual([403, 403]);
    const kept = await backend.owner.client.admin.services.entries({ serviceId: neon });
    expect(kept.entries.map(({ label }) => label)).not.toContain(entry.label);
  });
});
