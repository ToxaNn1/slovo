import { useOfflinePlate } from '@slovo/ui';

import { useEditionInEffect } from './remote-switches';

/**
 * Shows the offline plate «Немає з’єднання. Спробуй пізніше.» while the
 * `offlinePlate` Feature Switch is on in effect (ADR 0158); `undefined` while
 * it is off, so the caller says it the way it did before, in its toast or line.
 */
export function useOfflineNotice(): (() => void) | undefined {
  const show = useOfflinePlate();
  return useEditionInEffect().isFeatureEnabled('offlinePlate') ? show : undefined;
}
