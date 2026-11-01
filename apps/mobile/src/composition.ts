import {
  openComposition,
  systemRandom,
  type Account,
  type Composition,
  type TrackedUserState,
} from '@slovo/core';
import type { PackReader } from '@slovo/language-pack/reader';
import { systemSchedule } from '@slovo/ui';
import { useEffect, useState } from 'react';

import { deviceAnalytics } from './analytics/posthog-analytics';
import { backend } from './api';
import { deviceClock } from './device/device-clock';
import { logError } from './diagnostics/log';
import { deviceNotificationScheduler } from './notifications/device-notifications';
import { editionStrings } from './edition/edition';
import type { LaunchPack } from './content-update/launch-pack';
import { gameModeStrings } from './game/game-modes';
import { openOnce, useOpened, type Opening } from './opening';
import { useShell, type EditionSwitches } from './shell-value';

/** What the composition opens over. */
interface CompositionSources {
  languagePack: Opening<LaunchPack<PackReader>>;
  remoteSwitches: Opening<EditionSwitches>;
  userState: Opening<TrackedUserState>;
  /** The Account, which opens apart (ADR 0037); undefined when the Edition has none. */
  account: Opening<Account> | undefined;
}

async function openOver({
  languagePack,
  remoteSwitches,
  userState,
  account,
}: CompositionSources): Promise<Composition> {
  const content = (await languagePack.opened()).reader;
  const composition = await openComposition({
    content,
    crossword: content,
    edition: (await remoteSwitches.opened()).edition,
    userState: await userState.opened(),
    clock: deviceClock,
    random: systemRandom,
    schedule: systemSchedule,
    analytics: deviceAnalytics,
    scheduling: {
      scheduler: deviceNotificationScheduler,
      ellipsis: editionStrings.notificationBody.ellipsis,
      titles: editionStrings.notificationTemplates.titles,
      farewell: editionStrings.notificationTemplates.farewell,
      streakWarning: editionStrings.notificationTemplates.streakWarning,
      goalNotMet: editionStrings.notificationTemplates.goalNotMet,
    },
    backend,
    // Until the Account is open the reader counts as signed in, so no offer to save comes too early.
    signedIn: () =>
      account === undefined
        ? false
        : account.state.status !== 'ready' || account.state.value.state.status === 'signed-in',
  });
  // The modes on offer stay the same for the session: one without its strings fails here, at launch.
  for (const { modeId } of composition.game.state.modes) {
    gameModeStrings(editionStrings.game.modes, modeId);
  }
  return composition;
}

/**
 * The Core composition over the Language Pack and the Edition as the app runs
 * it, opened once per app run and shared by every screen, since its Cycle and
 * Word of the Day keep their state in memory (ADR 0013, 0018). Every screen
 * sees the same state, so a retry from its gate opens it again for all. It
 * reopens when an effective value of a Feature Switch changes (ADR 0040) or a
 * sync changed the user state, and the composition it replaced closes, so
 * what still holds that one, such as a Feed effect's cleanup, changes
 * nothing; an undo toast undoes in the composition open at the tap (ADR 0018).
 */
export function compositionOpening(sources: CompositionSources): Opening<Composition> {
  return openOnce(() => openOver(sources), {
    onError(error) {
      logError('Could not open the Core composition', error);
    },
    close(old) {
      // It never rejects.
      void old.close();
    },
  });
}

/** The Core composition of the app run, for a screen drawn under its gate (`Opened`). */
export function useComposition(): Composition {
  return useOpened(useShell().composition);
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
        logError(failure, error);
      },
    );
    return () => {
      active = false;
    };
  }, [open, read, failure, enabled]);
  return value;
}
