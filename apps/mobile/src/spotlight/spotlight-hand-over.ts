import type { EditionStrings } from '@slovo/contracts';
import type { Composition } from '@slovo/core';

import { logWarning } from '../diagnostics/log';
import type { ForegroundReports } from '../foreground/foreground-reports';
import type { Opening } from '../opening';
import type { SpotlightIndex } from './spotlight-index';

/**
 * Hands the Core's Spotlight Snapshot to the iPhone search's index (ADR
 * 0057): when the composition opens, each time the app goes to the
 * background, and after each change of Favorites, the Collections or the Word
 * of the Day archive. A reopen of the composition, over a sync's changes or a
 * changed Feature Switch, hands over the snapshot of the one that opened and
 * follows its changes instead, so with `spotlight` off in effect the empty
 * snapshot empties the index. Hand-overs run one after the other, each
 * building its snapshot in its turn, so an older snapshot never lands last;
 * a failed one is logged and the next tries again. Returns the call that
 * stops following the composition; the background stops with `reports`.
 */
export function handOverSpotlight({
  reports,
  composition,
  index,
  strings,
}: {
  reports: ForegroundReports;
  composition: Opening<Composition>;
  index: SpotlightIndex;
  strings: Pick<EditionStrings, 'notificationBody' | 'spotlight'>;
}): () => void {
  let handing = Promise.resolve();
  let stopped = false;

  function handOver(spotlight: Composition['spotlight']): void {
    if (stopped) return;
    handing = handing.then(async () => {
      try {
        await index.replace(await spotlight.snapshot(strings));
      } catch (error) {
        logWarning(
          'Could not hand over the Spotlight Snapshot; the next hand-over tries again',
          error,
        );
      }
    });
  }

  let followed: Composition | undefined;
  let stopFollowing: () => void = () => undefined;

  function follow(open: Composition): void {
    if (stopped || open === followed) return;
    stopFollowing();
    followed = open;
    stopFollowing = open.spotlight.subscribe(() => {
      handOver(open.spotlight);
    });
    handOver(open.spotlight);
  }

  reports.listen(composition, (open, moment) => {
    if (moment === 'launch') follow(open);
    if (moment === 'background') handOver(open.spotlight);
  });
  const stopReopens = composition.subscribe(() => {
    // The launch follows the composition that opened first.
    const { state } = composition;
    if (followed !== undefined && state.status === 'ready') follow(state.value);
  });

  return () => {
    stopped = true;
    stopReopens();
    stopFollowing();
  };
}
