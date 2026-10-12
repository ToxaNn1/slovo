import type { Correction, Word } from '@slovo/contracts';

/**
 * Reads a compiled Language Pack. Each platform supplies an adapter (Node for
 * tests and tooling, expo-sqlite in the mobile shell); the Core only sees this.
 */
export interface ContentReadPort {
  /**
   * The ids of the Words that are not retired, in a stable order. A Retired
   * Word is left out, so nothing new picks it.
   */
  listWordIds(): Promise<readonly string[]>;
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

export const systemClock: Clock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const systemRandom: Random = { next: () => Math.random() };
