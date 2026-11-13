import { openComposition, type Account, type Composition } from '@slovo/core';
import type { PackReader } from '@slovo/language-pack/reader';
import { useEffect, useState } from 'react';

import { logError } from './diagnostics/log';
import { deviceNotificationScheduler } from './notifications/device-notifications';
import { activeEditionFiles, editionStrings } from './edition/edition';
import type { LaunchPack } from './content-update/launch-pack';
import { gameModeStrings } from './game/game-modes';
import { openOnce, useOpened, type Opening, type OpeningState, type Source } from './opening';
import { useShell, type DevicePorts } from './shell-value';

/** What the composition opens over. */
interface CompositionSources {
  languagePack: Opening<LaunchPack<PackReader>>;
  /** The device ports, the Edition in effect among them. */
  ports: Opening<DevicePorts>;
  /** The Account, which opens apart (ADR 0037); undefined when the Edition has none. */
  account: Opening<Account> | undefined;
}

async function openOver({
  languagePack,
  ports,
  account,
}: CompositionSources): Promise<Composition> {
  const content = (await languagePack.opened()).reader;
  const composition = await openComposition({
    // Read at each opening, so a reopen opens over the Edition in effect now.
    ...(await ports.opened()),
    content,
    // A new phone's first Cycle opens with the Words whose media the app bundles.
    starterWords: activeEditionFiles.starterWords,
    scheduling: {
      scheduler: deviceNotificationScheduler,
      ellipsis: editionStrings.notificationBody.ellipsis,
      titles: editionStrings.notificationTemplates.titles,
      farewell: editionStrings.notificationTemplates.farewell,
      streakWarning: editionStrings.notificationTemplates.streakWarning,
      goalNotMet: editionStrings.notificationTemplates.goalNotMet,
    },
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

const loading = { status: 'loading' } as const;

/**
 * Reads one thing from the composition, and again when `read` changes, so
 * keep it in a `useCallback`, and each time the source `changes` names tells
 * of a change, so keep that one outside the component. Only the latest read
 * is shown: an earlier one that ends after it is dropped. A read that fails is
 * logged as `failure` and ends failed, with a retry that reads again. The
 * last thing read stays until the next read ends, but not over a composition
 * reopened: what the old one read is loading in the new one.
 */
export function useCompositionRead<T>(
  read: (composition: Composition) => Promise<T>,
  failure: string,
  changes?: (composition: Composition) => Source,
): OpeningState<T> {
  const open = useComposition();
  const [last, setRead] = useState<{ in: Composition; state: OpeningState<T> }>({
    in: open,
    state: loading,
  });
  // A retry counts up, so the effect reads again.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let latest = 0;
    const reread = () => {
      latest += 1;
      const mine = latest;
      read(open).then(
        (value) => {
          if (active && mine === latest) setRead({ in: open, state: { status: 'ready', value } });
        },
        (error: unknown) => {
          logError(failure, error);
          if (!active || mine !== latest) return;
          setRead({
            in: open,
            state: {
              status: 'failed',
              retry() {
                setRead({ in: open, state: loading });
                setAttempt((count) => count + 1);
              },
            },
          });
        },
      );
    };
    reread();
    const stop = changes?.(open).subscribe(reread);
    return () => {
      active = false;
      stop?.();
    };
  }, [open, read, failure, changes, attempt]);
  return last.in === open ? last.state : loading;
}
