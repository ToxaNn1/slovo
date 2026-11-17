import { randomUUID } from 'node:crypto';

import type { Service } from '@slovo/contracts/admin-api';
import { describe, expect, it } from 'vitest';

import { adminHeaders, signedInAdmin, testApp } from '../test-support';

/** A backend whose admin is on, with a signed-in Власник. */
async function ownerOn() {
  const backend = testApp();
  return { ...backend, owner: await signedInAdmin(backend, 'owner') };
}

type Owner = Awaited<ReturnType<typeof ownerOn>>['owner'];

async function serviceNamed(owner: Owner, name: string): Promise<Service> {
  const { services } = await owner.client.admin.services.list();
  const service = services.find((each) => each.name === name);
  if (service === undefined) throw new Error(`No Service ${name}`);
  return service;
}

const newestAction = async (owner: Owner) => (await owner.client.admin.actions({})).actions[0];

describe("«Сервіси»: a Service's money and a new Service", () => {
  it("sets a Service's plan, price and billing day with a reason, the Action log naming the changed fields", async () => {
    const { owner } = await ownerOn();
    const neon = await serviceNamed(owner, 'Neon');

    const first = await owner.client.admin.services.editMoney({
      id: neon.id,
      plan: 'Launch',
      monthlyPriceUsdCents: 1900,
      billingDay: 5,
      reason: 'the invoice of November',
    });

    expect(first.changed).toEqual(['plan', 'monthlyPriceUsdCents', 'billingDay']);
    expect(first.service).toMatchObject({
      plan: 'Launch',
      monthlyPriceUsdCents: 1900,
      billingDay: 5,
    });
    expect(await serviceNamed(owner, 'Neon')).toEqual(first.service);
    expect(await newestAction(owner)).toMatchObject({
      who: { kind: 'admin-user', email: owner.email },
      what: 'service.money.edit',
      before: { name: 'Neon', plan: null, monthlyPriceUsdCents: null, billingDay: null },
      after: { name: 'Neon', plan: 'Launch', monthlyPriceUsdCents: 1900, billingDay: 5 },
      reason: 'the invoice of November',
    });

    const second = await owner.client.admin.services.editMoney({
      id: neon.id,
      plan: 'Launch',
      monthlyPriceUsdCents: 2500,
      billingDay: 5,
      reason: 'the price went up',
    });
    expect(second.changed).toEqual(['monthlyPriceUsdCents']);
    const row = await newestAction(owner);
    expect(row?.before).toEqual({ name: 'Neon', monthlyPriceUsdCents: 1900 });
    expect(row?.after).toEqual({ name: 'Neon', monthlyPriceUsdCents: 2500 });

    // The same fields again change nothing and leave no row.
    const rows = (await owner.client.admin.actions({})).actions.length;
    const same = await owner.client.admin.services.editMoney({
      id: neon.id,
      plan: 'Launch',
      monthlyPriceUsdCents: 2500,
      billingDay: 5,
      reason: 'a second look',
    });
    expect(same.changed).toEqual([]);
    expect((await owner.client.admin.actions({})).actions).toHaveLength(rows);
  });

  it('refuses a write with no reason, a bad billing day or an unknown id', async () => {
    const { owner } = await ownerOn();
    const sentry = await serviceNamed(owner, 'Sentry');
    const money = { plan: null, monthlyPriceUsdCents: null, billingDay: null };
    const edit = (input: Record<string, unknown>) =>
      owner.client.admin.services.editMoney({ id: sentry.id, ...money, reason: 'r', ...input });

    await expect(edit({ reason: '  ' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(edit({ reason: undefined })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(edit({ billingDay: 32 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(edit({ monthlyPriceUsdCents: -1 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(edit({ id: randomUUID() })).rejects.toMatchObject({
      code: 'CONFLICT',
      data: { refusal: 'unknown' },
    });
    const add = (input: Record<string, unknown>) =>
      owner.client.admin.services.add({
        name: 'Hetzner',
        kind: 'metered',
        ...money,
        reason: 'r',
        ...input,
      });
    await expect(add({ reason: undefined })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(add({ name: ' ' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('adds a Service at a free place on the canvas, once per name', async () => {
    const { owner } = await ownerOn();
    const before = (await owner.client.admin.services.list()).services;

    const { service } = await owner.client.admin.services.add({
      name: 'Hetzner',
      kind: 'metered',
      plan: 'CX22',
      monthlyPriceUsdCents: 450,
      billingDay: 31,
      reason: 'a box for the backups',
    });

    expect(service).toMatchObject({
      name: 'Hetzner',
      kind: 'metered',
      plan: 'CX22',
      monthlyPriceUsdCents: 450,
      billingDay: 31,
      limits: [],
      links: [],
    });
    const after = (await owner.client.admin.services.list()).services;
    expect(after).toHaveLength(before.length + 1);
    expect(after).toContainEqual(service);
    const apart = (a: Service, b: Service) =>
      a.position.x + 230 <= b.position.x ||
      b.position.x + 230 <= a.position.x ||
      a.position.y + 115 <= b.position.y ||
      b.position.y + 115 <= a.position.y;
    for (const other of before) expect(apart(service, other)).toBe(true);
    expect(await newestAction(owner)).toMatchObject({
      what: 'service.add',
      before: null,
      after: {
        name: 'Hetzner',
        kind: 'metered',
        plan: 'CX22',
        monthlyPriceUsdCents: 450,
        billingDay: 31,
      },
      reason: 'a box for the backups',
    });

    const next = await owner.client.admin.services.add({
      name: 'Backblaze',
      kind: 'metered',
      plan: null,
      monthlyPriceUsdCents: null,
      billingDay: null,
      reason: 'the backups themselves',
    });
    expect(apart(next.service, service)).toBe(true);

    await expect(
      owner.client.admin.services.add({
        name: 'Hetzner',
        kind: 'cron',
        plan: null,
        monthlyPriceUsdCents: null,
        billingDay: null,
        reason: 'again',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', data: { refusal: 'name-taken' } });
  });

  it('refuses an Адмін and an Агент every write, which changes nothing', async () => {
    const backend = await ownerOn();
    const admin = await signedInAdmin(backend, 'admin');
    const { token } = await backend.owner.client.admin.issueAgentToken({
      name: `agent-${randomUUID().slice(0, 8)}`,
      reason: 'content batches',
    });
    const zoho = await serviceNamed(backend.owner, 'Zoho Mail');
    const edit = {
      id: zoho.id,
      plan: 'Mail Lite',
      monthlyPriceUsdCents: 100,
      billingDay: 3,
      reason: 'try',
    };
    const add = {
      name: 'Fly',
      kind: 'metered',
      plan: null,
      monthlyPriceUsdCents: null,
      billingDay: null,
      reason: 'try',
    } as const;

    await expect(admin.client.admin.services.editMoney(edit)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(admin.client.admin.services.add(add)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const agentHeaders = {
      ...adminHeaders(),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const agentEdit = await backend.request(`/v1/admin/services/${zoho.id}/money`, {
      method: 'PUT',
      headers: agentHeaders,
      body: JSON.stringify(edit),
    });
    expect(agentEdit.status).toBe(403);
    const agentAdd = await backend.request('/v1/admin/services', {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify(add),
    });
    expect(agentAdd.status).toBe(403);

    expect(await serviceNamed(backend.owner, 'Zoho Mail')).toEqual(zoho);
    expect(
      (await backend.owner.client.admin.services.list()).services.map(({ name }) => name),
    ).not.toContain('Fly');
  });
});
