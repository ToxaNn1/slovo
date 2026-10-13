import { openComposition, systemRandom, type Composition } from '@slovo/core';
import { createPackReader } from '@slovo/language-pack/reader';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { deviceClock } from './device-clock';
import { edition } from './edition';
import { storedUserState } from './stored-user-state';

export type CompositionState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'failed';
      /** Tries to open the composition again. */
      readonly retry: () => void;
    }
  | { readonly status: 'ready'; readonly composition: Composition };

async function openOver(db: SQLiteDatabase): Promise<Composition> {
  return openComposition({
    content: createPackReader(db),
    edition,
    userState: await storedUserState(),
    clock: deviceClock,
    random: systemRandom,
  });
}

/** The opening of the composition over one Language Pack, which every screen shares. */
interface Opening {
  readonly state: () => CompositionState;
  readonly subscribe: (listener: () => void) => () => void;
}

const loading: CompositionState = { status: 'loading' };

/** Opens the composition over the Language Pack, and again on a retry after a failure. */
function startOpening(db: SQLiteDatabase): Opening {
  let state = loading;
  const listeners = new Set<() => void>();

  function change(changed: CompositionState): void {
    state = changed;
    for (const listener of listeners) listener();
  }

  function open(): void {
    openOver(db).then(
      (composition) => {
        change({ status: 'ready', composition });
      },
      (error: unknown) => {
        console.error('Could not open the Core composition', error);
        change({
          status: 'failed',
          retry() {
            change(loading);
            open();
          },
        });
      },
    );
  }

  open();
  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const openings = new WeakMap<SQLiteDatabase, Opening>();

/**
 * The Core composition over the open Language Pack, opened once per app
 * session and shared by every screen, since its Cycle and Word of the Day
 * keep their state in memory (ADR 0013, 0018). Every screen sees the same
 * state, so a retry from any of them opens it again for all.
 */
function openingOver(db: SQLiteDatabase): Opening {
  let opening = openings.get(db);
  if (opening === undefined) {
    opening = startOpening(db);
    openings.set(db, opening);
  }
  return opening;
}

/** The Core composition of the app session, once it is open. */
export function useComposition(): CompositionState {
  const opening = openingOver(useSQLiteContext());
  return useSyncExternalStore(opening.subscribe, opening.state);
}
