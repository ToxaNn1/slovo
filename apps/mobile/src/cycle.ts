import {
  openCycle,
  openWordOfTheDay,
  systemClock,
  systemRandom,
  type Cycle,
  type Entries,
  type WordOfTheDay,
} from '@slovo/core';

import { storedUserState } from './stored-user-state';

/** The Cycle and the Word of the Day that every feature shares. */
export interface SharedCycle {
  readonly cycle: Cycle;
  readonly wordOfTheDay: WordOfTheDay;
}

const opened = new WeakMap<Entries, Promise<SharedCycle>>();

async function openSharedCycle(entries: Entries): Promise<SharedCycle> {
  const userState = await storedUserState();
  const cycle = await openCycle({ entries, userState, random: systemRandom });
  const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock: systemClock });
  return { cycle, wordOfTheDay };
}

/**
 * The Cycle and the Word of the Day over the open Language Pack's Entries,
 * opened once per app session and shared by every feature, since each keeps
 * its state in memory (ADR 0013). An open that failed is tried again on the
 * next call.
 */
export function sharedCycle(entries: Entries): Promise<SharedCycle> {
  let opening = opened.get(entries);
  if (opening === undefined) {
    opening = openSharedCycle(entries).catch((error: unknown) => {
      opened.delete(entries);
      throw error;
    });
    opened.set(entries, opening);
  }
  return opening;
}
