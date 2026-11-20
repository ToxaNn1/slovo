import { decorOf, parseLocalDate, type Clock } from '@slovo/core';
import { DecorProvider } from '@slovo/ui';
import type { ReactNode } from 'react';

import { editionDecor, seasonalMotifs } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useTodayKey } from '../foreground/today';
import { useSettings } from '../settings/settings';

/**
 * Gives everything below the Decor of today: the Mascot wears the
 * accessory of the Season or Holiday while «Сезонний декор» and its Feature
 * Switch are on, and the Edition's plain Decor otherwise.
 * It changes at local midnight. Draw it under the gate of the Language Pack.
 */
export function DecorInEffect({ clock, children }: { clock: Clock; children: ReactNode }) {
  const decor = decorOf({
    decor: editionDecor,
    motifs: seasonalMotifs,
    date: parseLocalDate(useTodayKey(clock)),
    edition: useEditionInEffect(),
    settings: useSettings().current,
  });
  return <DecorProvider decor={decor}>{children}</DecorProvider>;
}
