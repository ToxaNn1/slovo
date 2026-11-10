import { ALERT_THRESHOLD_KEYS, type AlertThresholdKey } from '@slovo/contracts/admin-api';
import type { AlertStore, AlertThresholdStore, KeptAlert } from '@slovo/server-core';
import { and, asc, desc, eq, gte, isNull } from 'drizzle-orm';

import type { Database } from '../database/database';
import { alertDigests, alerts, alertThresholds } from '../database/schema';

const isKey = (key: string): key is AlertThresholdKey =>
  (ALERT_THRESHOLD_KEYS as readonly string[]).includes(key);

/** The alerts and digests fired, kept in Postgres. */
export function createAlertStore({ db }: Database): AlertStore {
  const kept = ({ id, at, alert, sentAt }: typeof alerts.$inferSelect): KeptAlert => ({
    id,
    at,
    alert,
    sentAt,
  });
  return {
    async keep(alert, at, key) {
      const [row] = await db
        .insert(alerts)
        .values({ alert, at, key })
        .onConflictDoNothing()
        .returning({ id: alerts.id });
      return row?.id ?? null;
    },
    async markSent(id, at) {
      await db.update(alerts).set({ sentAt: at }).where(eq(alerts.id, id));
    },
    async unsent(since) {
      const rows = await db
        .select()
        .from(alerts)
        .where(and(isNull(alerts.sentAt), gte(alerts.at, since)))
        .orderBy(asc(alerts.id));
      return rows.map(kept);
    },
    async latest(limit) {
      const rows = await db.select().from(alerts).orderBy(desc(alerts.id)).limit(limit);
      return rows.map(kept);
    },
    async digestSent(day) {
      const rows = await db.select().from(alertDigests).where(eq(alertDigests.day, day));
      return rows.length > 0;
    },
    async keepDigest(day, at) {
      await db.insert(alertDigests).values({ day, sentAt: at }).onConflictDoNothing();
    },
  };
}

/** The alert thresholds the owner changed, kept in Postgres. */
export function createAlertThresholdStore({ db }: Database): AlertThresholdStore {
  return {
    async changed() {
      const rows = await db.select().from(alertThresholds);
      const changed: Partial<Record<AlertThresholdKey, number>> = {};
      for (const { key, value } of rows) if (isKey(key)) changed[key] = value;
      return changed;
    },
    async set(key, value) {
      await db
        .insert(alertThresholds)
        .values({ key, value })
        .onConflictDoUpdate({ target: alertThresholds.key, set: { value } });
    },
  };
}
