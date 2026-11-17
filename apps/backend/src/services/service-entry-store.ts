import { ServiceEntryTypeSchema } from '@slovo/contracts/admin-api';
import type { ServiceEntryStore, StoredEntryValue, StoredServiceEntry } from '@slovo/server-core';
import { asc, eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { serviceEntries, services } from '../database/schema';

type Row = typeof serviceEntries.$inferSelect;

/** An entry of the table; the table's check keeps exactly one of its two values. */
function entryOf({ id, serviceId, type, label, note, openValue, sealedValue }: Row) {
  const value: StoredEntryValue | undefined =
    openValue !== null
      ? { kind: 'open', value: openValue }
      : sealedValue !== null
        ? { kind: 'sealed', sealed: sealedValue }
        : undefined;
  if (value === undefined) throw new Error(`the Service entry ${id} has no value`);
  return {
    id,
    serviceId,
    type: ServiceEntryTypeSchema.parse(type),
    label,
    note,
    value,
  } satisfies StoredServiceEntry;
}

/** The columns of an entry's value. */
const valueColumns = (value: StoredEntryValue) =>
  value.kind === 'open'
    ? { openValue: value.value, sealedValue: null }
    : { openValue: null, sealedValue: value.sealed };

/** The Service entries in their own table (ADR 0164). */
export function createServiceEntryStore({ db }: Database): ServiceEntryStore {
  return {
    async serviceName(serviceId) {
      const [service] = await db
        .select({ name: services.name })
        .from(services)
        .where(eq(services.id, serviceId));
      return service?.name;
    },

    async list(serviceId) {
      const rows = await db
        .select()
        .from(serviceEntries)
        .where(eq(serviceEntries.serviceId, serviceId))
        .orderBy(asc(serviceEntries.type), asc(serviceEntries.label), asc(serviceEntries.id));
      return rows.map(entryOf);
    },

    async get(id) {
      const [row] = await db.select().from(serviceEntries).where(eq(serviceEntries.id, id));
      return row === undefined ? undefined : entryOf(row);
    },

    async add({ value, ...entry }) {
      const [row] = await db
        .insert(serviceEntries)
        .values({ ...entry, ...valueColumns(value) })
        .returning();
      if (row === undefined) throw new Error('the Service entry was not added');
      return entryOf(row);
    },

    async update({ id, label, note, value }) {
      await db
        .update(serviceEntries)
        .set({ label, note, ...valueColumns(value) })
        .where(eq(serviceEntries.id, id));
    },

    async remove(id) {
      await db.delete(serviceEntries).where(eq(serviceEntries.id, id));
    },
  };
}
