import type { WidgetSnapshot } from '@slovo/contracts';
import type { Composition, Sync } from '@slovo/core';

import type { ForegroundReports } from '../foreground/foreground-reports';
import type { Opening } from '../opening';

/**
 * Lets the Sync module follow the app's moments (ADR 0036): it syncs at the
 * launch and on each return to the foreground, and waits while the app is in
 * the background. Sync opens apart from the composition and nothing waits
 * for it: the report tells it its moments once it is open, and the launch of
 * everything else has long begun. When a sync changed the user state, the
 * shell reopens what keeps it in memory, with `reopen`, which never rejects.
 */
export function syncInBackground({
  reports,
  sync,
  reopen,
}: {
  reports: Pick<ForegroundReports, 'listen'>;
  sync: Opening<Sync>;
  reopen: () => Promise<void>;
}): void {
  reports.listen(sync, (opened, moment) => {
    switch (moment) {
      case 'launch':
        opened.onUserStateChange(() => {
          void reopen();
        });
        opened.foreground();
        break;
      case 'return':
        opened.foreground();
        break;
      case 'background':
        opened.background();
        break;
      case 'new-day':
        break;
    }
  });
}

/**
 * Reopens what reads the user state in memory, the settings and the
 * composition, over what a sync merged into it, and does what the launch did:
 * the composition makes the notification plan as it opens, and the Widget
 * Snapshot is written from the composition that opened. A reopen that fails
 * keeps the old value and is reported by its opening; the next sync tries
 * again.
 */
export function reopenAfterSync({
  settings,
  composition,
  writeWidgetSnapshot,
}: {
  settings: Pick<Opening<unknown>, 'reopen'>;
  composition: Opening<Composition>;
  writeWidgetSnapshot: (snapshot: () => Promise<WidgetSnapshot>) => void;
}): () => Promise<void> {
  return async () => {
    await Promise.all([settings.reopen(), composition.reopen()]);
    const { state } = composition;
    if (state.status === 'ready') writeWidgetSnapshot(() => state.value.widget.snapshot());
  };
}
