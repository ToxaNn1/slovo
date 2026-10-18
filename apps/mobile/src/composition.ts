import { openComposition, systemRandom, type Composition } from '@slovo/core';
import type { PackReader } from '@slovo/language-pack/reader';
import { systemSchedule } from '@slovo/ui';
import { useEffect, useState } from 'react';

import { deviceClock } from './device/device-clock';
import { deviceNotificationScheduler } from './notifications/device-notifications';
import { editionStrings } from './edition/edition';
import { languagePackOpening } from './edition/language-pack';
import { remoteSwitchesOpening } from './edition/remote-switches';
import { gameModeStrings } from './game/game-modes';
import { openOnce, useOpened } from './opening';
import { storedUserState } from './user-state/stored-user-state';

async function openOver(content: PackReader): Promise<Composition> {
  const composition = await openComposition({
    content,
    edition: (await remoteSwitchesOpening.opened()).edition,
    userState: await storedUserState.opened(),
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

/**
 * The Core composition over the Language Pack and the Edition as the app runs
 * it, opened once per app run and
 * shared by every screen, since its Cycle and Word of the Day keep their state
 * in memory (ADR 0013, 0018). Every screen sees the same state, so a retry
 * from its gate opens it again for all. It reopens when an effective value of
 * a Feature Switch changes (ADR 0040).
 */
export const compositionOpening = openOnce(
  async () => openOver((await languagePackOpening.opened()).reader),
  {
    onError(error) {
      console.error('Could not open the Core composition', error);
    },
  },
);

/** The Core composition of the app run, for a screen drawn under its gate (`Opened`). */
export function useComposition(): Composition {
  return useOpened(compositionOpening);
}

/**
 * Reads one thing from the composition, and again when `read` changes, so
 * keep it in a `useCallback`. Nothing is read while `enabled` is false; a read
 * that fails is logged as `failure`. The last thing read stays until the next
 * one arrives.
 */
export function useCompositionRead<T>(
  read: (composition: Composition) => Promise<T>,
  failure: string,
  enabled = true,
): T | undefined {
  const open = useComposition();
  const [value, setValue] = useState<T>();
  useEffect(() => {
    if (!enabled) return;
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
