import { ServiceKindSchema, type Service } from '@slovo/contracts/admin-api';
import type { ServiceStore } from '@slovo/server-core';
import { asc } from 'drizzle-orm';

import type { Database } from '../database/database';
import { services } from '../database/schema';

/** The Services in their own table (ADR 0164); a link names the other Service, answered by its id. */
export function createServiceStore({ db }: Database): ServiceStore {
  return {
    async list() {
      const rows = await db.select().from(services).orderBy(asc(services.name));
      const idOf = new Map(rows.map((row) => [row.name, row.id]));
      return rows.map((row): Service => ({
        id: row.id,
        name: row.name,
        kind: ServiceKindSchema.parse(row.kind),
        plan: row.plan,
        monthlyPriceUsdCents: row.monthlyPriceUsdCents,
        billingDay: row.billingDay,
        limits: row.limits,
        position: { x: row.x, y: row.y },
        links: row.links.flatMap(({ to, kind }) => {
          const id = idOf.get(to);
          return id === undefined ? [] : [{ to: id, kind }];
        }),
      }));
    },
  };
}
