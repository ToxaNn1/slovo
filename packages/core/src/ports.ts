import type { Category, Correction, Word } from '@slovo/contracts';

/**
 * Reads a compiled Language Pack. Each platform supplies an adapter (Node for
 * tests and tooling, expo-sqlite in the mobile shell); the Core only sees this.
 */
export interface ContentReadPort {
  /**
   * Every Category of the pack, with its display name, in the pack's order
   * (the order the Edition declares them in), also one whose Words are all Retired. The pack is the runtime source of
   * Categories, so a content update may add one (ADR 0033).
   */
  listCategories(): Promise<readonly Category[]>;
  /**
   * The ids of the Words that are not retired, in a stable order; only those
   * of the Category when one is given. A Retired Word is left out, so nothing
   * new picks it.
   */
  listWordIds(categoryId?: string): Promise<readonly string[]>;
  /**
   * Every Word that is not retired, in the order of `listWordIds`, read at
   * once, for a feature that needs them all, such as the Game's Distractors.
   */
  listWords(): Promise<readonly Word[]>;
  /** Any Word by id, a Retired Word included, so kept Words stay reachable. */
  getWord(id: string): Promise<Word | undefined>;
  /**
   * The ids of the Corrections that are not retired, in a stable order. A
   * Retired Correction is left out, so nothing new picks it.
   */
  listCorrectionIds(): Promise<readonly string[]>;
  /** Any Correction by id, a Retired Correction included, so kept Corrections stay reachable. */
  getCorrection(id: string): Promise<Correction | undefined>;
  /**
   * The ids of the Words that are not retired and are the standard form for
   * the Correction, in a stable order.
   */
  listLinkedWordIds(correctionId: string): Promise<readonly string[]>;
}

/**
 * Changes to the user state, by key: a value replaces the record, `undefined`
 * deletes it.
 */
export type UserStateChanges = ReadonlyMap<string, string | undefined>;

/**
 * Keeps the user's state on the device as text records by key, in a writable
 * store apart from the read-only Language Pack. Each platform supplies an
 * adapter (in memory for tests, expo-sqlite in the mobile shell); the Core
 * owns the keys, the values and the schema version.
 */
export interface UserStatePort {
  /** The record stored under the key, if any. */
  get(key: string): Promise<string | undefined>;
  /**
   * Every record whose key starts with the prefix, by key, in no set order.
   * The prefix is matched as it is: case counts, and no character is a
   * wildcard.
   */
  list(prefix: string): Promise<ReadonlyMap<string, string>>;
  /** Applies every change at once, or none of them. */
  write(changes: UserStateChanges): Promise<void>;
}

/**
 * The source of the current time and the device's time zone, injected so
 * behaviour stays testable. Local calendar days follow the time zone.
 */
export interface Clock {
  now(): Date;
  /** The IANA name of the current time zone, such as `Europe/Kyiv`. */
  timeZone(): string;
}

/** A source of random numbers in [0, 1), injected so behaviour stays testable. */
export interface Random {
  next(): number;
}

/**
 * Runs something after a delay, in milliseconds, and returns the way to
 * cancel it. The shell gives the real clock; a test gives its own.
 */
export type Schedule = (run: () => void, delay: number) => () => void;

/** Whether the device lets the app notify: the reader allowed it, denied it, or hasn't been asked yet. */
export type NotificationPermission = 'allowed' | 'denied' | 'not-asked';

/**
 * The sound a notification plays: the Edition's own, named by the file the
 * shell bundles, the system default when the Edition has none, or none at all
 * when the reader switched it off.
 */
export type PlannedSound = { readonly file: string } | 'system' | 'silent';

/**
 * One notification of the plan: a Word at a local date and time, floating
 * (ADR 0021). It has no time zone: it comes at that wall-clock time in
 * whatever time zone the device is in when it is due.
 */
export interface PlannedNotification {
  /** The local date, `YYYY-MM-DD`. */
  readonly date: string;
  /** The local time, `HH:MM` on a 24-hour clock. */
  readonly time: string;
  /** The Lemma with its Stress marks. */
  readonly title: string;
  /** The primary Definition, cut short at a word boundary. */
  readonly body: string;
  /** The Word it carries, which a tap opens. */
  readonly wordId: string;
  readonly sound: PlannedSound;
}

/**
 * Schedules the Core's notification plan on the device. The Core plans; the
 * shell implements this port on the platform's notifications (ADR 0021).
 */
export interface NotificationSchedulerPort {
  /** Whether the device lets the app notify. */
  permission(): Promise<NotificationPermission>;
  /** Asks the reader for permission, when it isn't asked yet, and reports it. */
  askPermission(): Promise<NotificationPermission>;
  /**
   * Replaces every pending notification with the plan, so the device holds
   * exactly the Core's plan. An empty plan cancels them all.
   */
  replacePlan(plan: readonly PlannedNotification[]): Promise<void>;
}

export const systemClock: Clock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const systemRandom: Random = { next: () => Math.random() };
