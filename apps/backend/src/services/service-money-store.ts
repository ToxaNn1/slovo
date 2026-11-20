import type { ServiceMoneyStore } from '@slovo/server-core';
import { eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { services } from '../database/schema';
import { createServiceStore } from './service-store';

/** A Service's money and a new Service, written to the Services table. */
export function createServiceMoneyStore(database: Database): ServiceMoneyStore {
  const { db } = database;
  const read = createServiceStore(database);
  const serviceOf = async (id: string) => (await read.list()).find((service) => service.id === id);

  return {
    async add({ name, kind, plan, monthlyPriceUsdCents, billingDay, position }) {
      const [row] = await db
        .insert(services)
        .values({
          name,
          kind,
          plan,
          monthlyPriceUsdCents,
          billingDay,
          x: position.x,
          y: position.y,
        })
        .onConflictDoNothing({ target: services.name })
        .returning({ id: services.id });
      if (row === undefined) return 'taken';
      const added = await serviceOf(row.id);
      if (added === undefined) throw new Error(`The Service ${name} is not read back once added`);
      return added;
    },

    async setMoney(id, { plan, monthlyPriceUsdCents, billingDay }) {
      const [row] = await db
        .update(services)
        .set({ plan, monthlyPriceUsdCents, billingDay })
        .where(eq(services.id, id))
        .returning({ id: services.id });
      return row === undefined ? undefined : serviceOf(row.id);
    },
  };
}
