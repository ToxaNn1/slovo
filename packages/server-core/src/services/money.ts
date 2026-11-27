import type { ActionKey } from '@slovo/contracts';
import {
  SERVICE_BLOCK,
  SERVICE_MONEY_FIELDS,
  type Service,
  type ServiceCosts,
  type ServiceMoneyField,
} from '@slovo/contracts/admin-api';

import type { AccessWrite, AdminAccess } from '../admin/admin-access';
import type { Clock, Json } from '../ports';
import type { ServiceStore } from './services';

/** The money fields of a Service the Власник enters by hand. */
export type ServiceMoney = Pick<Service, ServiceMoneyField>;

/** A Service as the Власник adds it: its links and limits come later. */
export type NewService = Pick<Service, 'name' | 'kind'> & ServiceMoney;

/** Where a Service's money and a new Service are written. */
export interface ServiceMoneyStore {
  /** Adds a Service with no limits and no links at the place; `taken` when a Service has the name. */
  add(service: NewService & Pick<Service, 'position'>): Promise<Service | 'taken'>;
  /** Sets a Service's money fields; `undefined` for an id with no Service. */
  setMoney(id: string, money: ServiceMoney): Promise<Service | undefined>;
}

/** What SLOVO pays for its Services, and the Власник's writes of it, each in the Action log. */
export interface ServiceMoneyBook {
  /** The monthly total and the next charge of the Services, by the clock's Kyiv day. */
  costs(services: readonly Service[]): ServiceCosts;
  add(
    service: NewService,
    write: AccessWrite,
  ): Promise<{ ok: true; service: Service } | { ok: false; reason: 'name-taken' }>;
  editMoney(
    id: string,
    money: ServiceMoney,
    write: AccessWrite,
  ): Promise<
    { ok: true; service: Service; changed: ServiceMoneyField[] } | { ok: false; reason: 'unknown' }
  >;
}

export function createServiceMoneyBook({
  services,
  store,
  clock,
  admin,
}: {
  services: ServiceStore;
  store: ServiceMoneyStore;
  clock: Clock;
  admin: Pick<AdminAccess, 'log'>;
}): ServiceMoneyBook {
  const logBy = ({ who, reason }: AccessWrite, what: ActionKey, before: Json, after: Json) =>
    admin.log({ who, what, before, after, reason, editionId: null, batchId: null });

  return {
    costs: (list) => costsOn(list, kyivDayOf(clock.now())),

    async add(service, write) {
      const position = freePlace(await services.list());
      const added = await store.add({ ...service, position });
      if (added === 'taken') return { ok: false, reason: 'name-taken' };
      const { name, kind, plan, monthlyPriceUsdCents, billingDay } = service;
      await logBy(write, 'service.add', null, {
        name,
        kind,
        plan,
        monthlyPriceUsdCents,
        billingDay,
      });
      return { ok: true, service: added };
    },

    async editMoney(id, money, write) {
      const before = (await services.list()).find((service) => service.id === id);
      if (before === undefined) return { ok: false, reason: 'unknown' };
      const changed = SERVICE_MONEY_FIELDS.filter((field) => before[field] !== money[field]);
      const service = changed.length === 0 ? before : await store.setMoney(id, money);
      if (service === undefined) return { ok: false, reason: 'unknown' };
      if (changed.length > 0) {
        // The row names the Service and holds the changed fields alone.
        const fieldsOf = (of: ServiceMoney): Json => ({
          name: service.name,
          ...Object.fromEntries(changed.map((field) => [field, of[field]])),
        });
        await logBy(write, 'service.money.edit', fieldsOf(before), fieldsOf(money));
      }
      return { ok: true, service, changed };
    },
  };
}

/** A calendar day: its year, month (1–12) and day of the month. */
interface Day {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const KYIV_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function kyivDayOf(at: Date): Day {
  const [year, month, day] = KYIV_DAY.format(at).split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The day a Service of the billing day charges on in the month: the month's last day when it has fewer. */
const chargeIn = (year: number, month: number, billingDay: number): Day => ({
  year,
  month,
  day: Math.min(billingDay, daysIn(year, month)),
});

/** The first day from `today` on, today included, a Service of the billing day charges on. */
function nextChargeDay(today: Day, billingDay: number): Day {
  const thisMonth = chargeIn(today.year, today.month, billingDay);
  if (thisMonth.day >= today.day) return thisMonth;
  return today.month === 12
    ? chargeIn(today.year + 1, 1, billingDay)
    : chargeIn(today.year, today.month + 1, billingDay);
}

const isoOf = ({ year, month, day }: Day) =>
  `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** The Kyiv day `YYYY-MM-DD` of the time. */
export const kyivDateOf = (at: Date): string => isoOf(kyivDayOf(at));

function costsOn(services: readonly Service[], today: Day): ServiceCosts {
  const monthlyTotalUsdCents = services.reduce(
    (sum, { monthlyPriceUsdCents }) => sum + (monthlyPriceUsdCents ?? 0),
    0,
  );
  const charges = services.flatMap(({ id, monthlyPriceUsdCents, billingDay }) =>
    monthlyPriceUsdCents === null || monthlyPriceUsdCents === 0 || billingDay === null
      ? []
      : [{ id, amount: monthlyPriceUsdCents, on: isoOf(nextChargeDay(today, billingDay)) }],
  );
  const on = charges.map((charge) => charge.on).sort()[0];
  if (on === undefined) return { monthlyTotalUsdCents, nextCharge: null };
  const that = charges.filter((charge) => charge.on === on);
  return {
    monthlyTotalUsdCents,
    nextCharge: {
      on,
      amountUsdCents: that.reduce((sum, { amount }) => sum + amount, 0),
      serviceIds: that.map(({ id }) => id),
    },
  };
}

/** The canvas's columns and rows of places a new Service may take, in CSS pixels. */
const PLACES = { left: 40, top: 40, columns: 4, across: 300, down: 140 } as const;
/** The room kept clear around a block. */
const GAP = 20;

/** The first place on the grid, row by row, whose block overlaps no Service's. */
function freePlace(services: readonly Service[]): Service['position'] {
  const overlaps = (x: number, y: number) =>
    services.some(
      ({ position }) =>
        x < position.x + SERVICE_BLOCK.width + GAP &&
        position.x < x + SERVICE_BLOCK.width + GAP &&
        y < position.y + SERVICE_BLOCK.height + GAP &&
        position.y < y + SERVICE_BLOCK.height + GAP,
    );
  for (let row = 0; ; row += 1) {
    for (let column = 0; column < PLACES.columns; column += 1) {
      const x = PLACES.left + column * PLACES.across;
      const y = PLACES.top + row * PLACES.down;
      if (!overlaps(x, y)) return { x, y };
    }
  }
}
