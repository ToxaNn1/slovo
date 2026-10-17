import { openComposition, systemRandom, type Composition } from '@slovo/core';
import { systemSchedule } from '@slovo/ui';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { deviceClock } from './device/device-clock';
import { deviceNotificationScheduler } from './notifications/device-notifications';
import { edition, editionStrings } from './edition/edition';
import { openedPack } from './edition/opened-pack';
import { gameModeStrings } from './game/game-modes';
import { storedUserState } from './user-state/stored-user-state';

export type CompositionState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'failed';
      /** Tries to open the composition again. */
      readonly retry: () => void;
    }
  | { readonly status: 'ready'; readonly composition: Composition };

async function openOver(db: SQLiteDatabase): Promise<Composition> {
  const composition = await openComposition({
    content: openedPack(db),
    edition,
    userState: await storedUserState(),
    clock: deviceClock,
    random: systemRandom,
    schedule: systemSchedule,
    scheduling: {
      scheduler: deviceNotificationScheduler,
      ellipsis: editionStrings.notificationBody.ellipsis,
    },
  });
  // The modes on offer stay the same for the session: one without its strings fails here, at launch.
  for (const { modeId } of composition.game.state.modes) {
    gameModeStrings(editionStrings.game.modes, modeId);
  }
  return composition;
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

/** A Core module of the composition, which tells its listeners when it changes. */
interface Subscribable {
  subscribe(listener: () => void): () => void;
}

/** One module of the composition, once it is open; `select` names it. */
export function useModule<M>(select: (composition: Composition) => M): M | undefined {
  const composition = useComposition();
  return composition.status === 'ready' ? select(composition.composition) : undefined;
}

const unsubscribed = () => undefined;

/**
 * Reads a snapshot of one Core module of the composition and keeps the screen
 * subscribed to it. Until the composition is open the snapshot is `fallback`,
 * which must be one stable value (a shared empty array, not a new one per
 * call), or the store would read a change on every render.
 */
export function useComposed<M extends Subscribable, T>(
  select: (composition: Composition) => M,
  snapshot: (source: M) => T,
  fallback: T,
): T {
  const source = useModule(select);
  const subscribe = useCallback(
    (listener: () => void) => source?.subscribe(listener) ?? unsubscribed,
    [source],
  );
  return useSyncExternalStore(subscribe, () =>
    source === undefined ? fallback : snapshot(source),
  );
}

/**
 * Reads one thing from the composition once it is open, and again when `read`
 * changes, so keep it in a `useCallback`. Nothing is read while `enabled` is
 * false; a read that fails is logged as `failure`. The last thing read stays
 * until the next one arrives.
 */
export function useOpenedRead<T>(
  read: (composition: Composition) => Promise<T>,
  failure: string,
  enabled = true,
): T | undefined {
  const open = useModule((composition) => composition);
  const [value, setValue] = useState<T>();
  useEffect(() => {
    if (!enabled || open === undefined) return;
    let active = true;
    read(open).then(
      (result) => {
        if (active) setValue(result);
      },
      (error: unknown) => {
        console.error(failure, error);
      },
    );
    return () => {
      active = false;
    };
  }, [open, read, failure, enabled]);
  return value;
}
