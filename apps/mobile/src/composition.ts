import { openComposition, systemRandom, type Composition } from '@slovo/core';
import { createPackReader } from '@slovo/language-pack/reader';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

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

const opened = new WeakMap<SQLiteDatabase, Promise<Composition>>();

async function openOver(db: SQLiteDatabase): Promise<Composition> {
  return openComposition({
    content: createPackReader(db),
    edition,
    userState: await storedUserState(),
    clock: deviceClock,
    random: systemRandom,
  });
}

/**
 * The Core composition over the open Language Pack, opened once per app
 * session and shared by every screen, since its Cycle and Word of the Day
 * keep their state in memory (ADR 0013, 0018). An open that failed is tried
 * again on the next call.
 */
function compositionOver(db: SQLiteDatabase): Promise<Composition> {
  let opening = opened.get(db);
  if (opening === undefined) {
    opening = openOver(db).catch((error: unknown) => {
      opened.delete(db);
      throw error;
    });
    opened.set(db, opening);
  }
  return opening;
}

/** The Core composition of the app session, once it is open. */
export function useComposition(): CompositionState {
  const db = useSQLiteContext();
  const [composition, setComposition] = useState<Composition>();
  const [failed, setFailed] = useState(false);
  /** Counts the tries to open the composition, so a retry opens it again. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    compositionOver(db).then(
      (open) => {
        if (active) setComposition(open);
      },
      (error: unknown) => {
        console.error('Could not open the Core composition', error);
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [db, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);

  if (failed) return { status: 'failed', retry };
  if (composition === undefined) return { status: 'loading' };
  return { status: 'ready', composition };
}
