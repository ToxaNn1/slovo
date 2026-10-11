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
  getCorrection(id: string): Promise<Correction | undefined>;
  /**
   * The ids of the Words that are not retired and are the standard form for
   * the Correction, in a stable order.
   */
  listLinkedWordIds(correctionId: string): Promise<readonly string[]>;
}

/** The source of the current time, injected so behaviour stays testable. */
export interface Clock {
  now(): Date;
}

/** A source of random numbers in [0, 1), injected so behaviour stays testable. */
export interface Random {
  next(): number;
}

export const systemClock: Clock = { now: () => new Date() };

export const systemRandom: Random = { next: () => Math.random() };
