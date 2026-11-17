import { describe, expect, it, vi } from 'vitest';

import { signedInAdmin, testApp } from '../test-support';

/** A Власник signed in at the moment, the backend's clock frozen there. */
async function ownerAt(iso: string) {
  vi.setSystemTime(new Date(iso));
  return signedInAdmin(testApp(), 'owner');
}

type Owner = Awaited<ReturnType<typeof ownerAt>>;

async function costsAt(iso: string) {
  return (await (await ownerAt(iso)).client.admin.services.list()).costs;
}

async function price(
  owner: Owner,
  name: string,
  monthlyPriceUsdCents: number | null,
  billingDay: number | null,
) {
  const { services } = await owner.client.admin.services.list();
  const service = services.find((each) => each.name === name);
  if (service === undefined) throw new Error(`No Service ${name}`);
  await owner.client.admin.services.editMoney({
    id: service.id,
    plan: null,
    monthlyPriceUsdCents,
    billingDay,
    reason: 'the invoices',
  });
  return service.id;
}

describe('«Сервіси»: the monthly total and the next charge', () => {
  it('sums the prices and finds the next charge by the Kyiv day, across month and year ends', async () => {
    expect(await costsAt('2026-12-31T12:00:00Z')).toEqual({
      monthlyTotalUsdCents: 0,
      nextCharge: null,
    });

    const owner = await ownerAt('2026-12-31T12:00:00Z');
    const neon = await price(owner, 'Neon', 1900, 1);
    // Past December's 31st, the 1st is next year's.
    expect(await costsAt('2026-12-31T12:00:00Z')).toEqual({
      monthlyTotalUsdCents: 1900,
      nextCharge: { on: '2027-01-01', amountUsdCents: 1900, serviceIds: [neon] },
    });

    const github = await price(owner, 'GitHub', 400, 31);
    const railway = await price(owner, 'Railway', 500, 30);
    // A price with no billing day counts in the total alone; a free Service charges nothing.
    await price(owner, 'Cloudflare', 2000, null);
    await price(owner, 'Sentry', 0, 12);

    // February has no 30th or 31st: both charge on its last day.
    expect(await costsAt('2027-02-10T10:00:00Z')).toEqual({
      monthlyTotalUsdCents: 4800,
      nextCharge: { on: '2027-02-28', amountUsdCents: 900, serviceIds: [github, railway] },
    });
    // 23:30 in Kyiv is still the 28th: the charge is today.
    expect((await costsAt('2027-02-28T21:30:00Z')).nextCharge?.on).toBe('2027-02-28');
    // 00:30 in Kyiv is the 1st of March already.
    expect(await costsAt('2027-02-28T22:30:00Z')).toEqual({
      monthlyTotalUsdCents: 4800,
      nextCharge: { on: '2027-03-01', amountUsdCents: 1900, serviceIds: [neon] },
    });
    // April has 30 days: Railway charges on the 30th, GitHub on the 30th too.
    expect((await costsAt('2027-04-02T09:00:00Z')).nextCharge).toEqual({
      on: '2027-04-30',
      amountUsdCents: 900,
      serviceIds: [github, railway],
    });
    // Past the 30th of May, GitHub's 31st comes before June's 1st.
    expect((await costsAt('2027-05-30T22:00:00Z')).nextCharge).toEqual({
      on: '2027-05-31',
      amountUsdCents: 400,
      serviceIds: [github],
    });
  });
});
