import { useEditionInEffect } from './edition/remote-switches';
import { useMixState } from './mix/mix';
import { useSettings } from './settings/settings';
import { shownOf, type Shown } from './shown';

/**
 * What the reader is shown, for a screen drawn over the composition. It draws
 * again when a Feature Switch in effect, a setting or the Mix changes.
 */
export function useShown(): Shown {
  return shownOf({
    edition: useEditionInEffect(),
    settings: useSettings().current,
    mix: useMixState(),
  });
}
