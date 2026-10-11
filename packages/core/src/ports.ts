import type { Word } from '@slovo/contracts';

/**
 * Reads a compiled Language Pack. Each platform supplies an adapter (Node for
 * tests and tooling, expo-sqlite in the mobile shell); the Core only sees this.
 */
export interface ContentReadPort {
  /** Every Word id in the pack, in a stable order. */
  listWordIds(): Promise<readonly string[]>;
  getWord(id: string): Promise<Word | undefined>;
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
