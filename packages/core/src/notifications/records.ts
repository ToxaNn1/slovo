import { NotificationTimesSchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord, declareRecords } from '../user-state/user-state-record';

/** The records of the notifications. */
export const notificationRecords = {
  /**
   * The user's notification times, local times `HH:MM`. Without the record,
   * the Edition's default times; an empty list is a record of its own, so no
   * times never falls back to the defaults.
   */
  notificationTimes: declareRecord('notifications.times', NotificationTimesSchema, {
    sync: 'device-only',
  }),
  /** Whether notifications play their sound; without the record, they do. */
  notificationSound: declareRecord('notifications.sound', z.boolean(), { sync: 'device-only' }),
  /**
   * The planned notifications, one record per notification, by its local date
   * and local time joined with a `T` (`2026-10-14T09:00`): the id of its Word.
   * A Word with such a record is Reserved; Reserved is never stored on its own.
   */
  notificationPlan: declareRecords('notifications.plan.', z.string().min(1), {
    sync: 'device-only',
  }),
  /**
   * The title templates of the notifications (ADR 0054), by their index in
   * the Edition's list: `last`, the template of the last notification that
   * came, and `planned`, each planned notification's, by the id of its plan
   * record. The plan reads them so no template comes twice in a row.
   */
  notificationTitles: declareRecord(
    'notifications.titles',
    z.strictObject({
      last: z.number().int().nonnegative().optional(),
      planned: z.record(z.string(), z.number().int().nonnegative()),
    }),
    { sync: 'device-only' },
  ),
  /**
   * How far the Feed has asked for permission to notify (ADR 0067): the local
   * date `YYYY-MM-DD` the explainer was first offered, then the date of its
   * one re-ask. It stays on the device, like the permission it asks for; a
   * new key needs no migration, since without it nothing was offered.
   */
  notificationAsk: declareRecord(
    'notifications.ask',
    z.discriminatedUnion('step', [
      z.object({ step: z.literal('explainer'), date: z.string() }),
      z.object({ step: z.literal('reask'), date: z.string() }),
    ]),
    { sync: 'device-only' },
  ),
};
