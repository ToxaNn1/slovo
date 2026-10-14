import type { z } from 'zod';

import type { UserStateChanges } from './ports';

/**
 * How a record syncs when sync arrives (ADR 0005). A record without a mark
 * syncs by last write wins, one record at a time.
 * - `device-only`: stays on this device (the notification times).
 * - `union`: the records of every device are all kept (Active Days, so the
 *   Streak derived from them is the same on every device).
 */
export type SyncMark = 'device-only' | 'union';

/** The options of a declared record. */
export interface RecordOptions {
  readonly sync?: SyncMark | undefined;
}

/**
 * One record of the user state: its key, and the schema of the value it
 * holds. Every value is kept as JSON.
 */
export interface UserStateRecord<T> {
  readonly key: string;
  /** How the record syncs; unmarked records sync by last write wins. */
  readonly sync?: SyncMark | undefined;
  /** The value kept as the text, if it is one of the schema. */
  decode(text: string | undefined): T | undefined;
  /** The change that keeps the value in the record, or deletes it for `undefined`. */
  change(value: T | undefined): UserStateChanges;
}

/**
 * Records of one kind, one per id (one per Favorite, say): each under the
 * prefix followed by its id, and each holding a value of the same schema.
 */
export interface UserStateRecords<T> {
  readonly prefix: string;
  /** How every record of the kind syncs; unmarked records sync by last write wins. */
  readonly sync?: SyncMark | undefined;
  /** The record of the id. */
  record(id: string): UserStateRecord<T>;
}

/** Declares the record under the key, holding values of the schema. */
export function declareRecord<T>(
  key: string,
  schema: z.ZodType<T>,
  { sync }: RecordOptions = {},
): UserStateRecord<T> {
  return {
    key,
    sync,
    decode(text) {
      if (text === undefined) return undefined;
      try {
        const parsed = schema.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data : undefined;
      } catch {
        return undefined;
      }
    },
    change: (value) => new Map([[key, value === undefined ? undefined : JSON.stringify(value)]]),
  };
}

/** Declares records of one kind under the prefix, each holding a value of the schema. */
export function declareRecords<T>(
  prefix: string,
  schema: z.ZodType<T>,
  options: RecordOptions = {},
): UserStateRecords<T> {
  return {
    prefix,
    sync: options.sync,
    record: (id) => declareRecord(`${prefix}${id}`, schema, options),
  };
}
