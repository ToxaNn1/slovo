import { createInterfaceSounds, type SoundEngine } from '@slovo/core';
import { InterfaceSoundsProvider } from '@slovo/ui';
import { useMemo, type ReactNode } from 'react';

import { useEditionInEffect } from '@/edition/remote-switches';
import { useSettings } from '@/settings/settings';

/**
 * The device's audio for the Interface sounds. It plays nothing until the
 * native build adds an audio module (ticket #1466); the Edition's sounds wait
 * in `assets/sounds/`.
 */
export const soundEngine: SoundEngine = { play: () => undefined };

/**
 * The Interface sounds below it, behind the `sounds` switch in effect and
 * «Звуки», for screens drawn under the gate of the Language Pack.
 */
export function InterfaceSoundsInEffect({
  engine,
  children,
}: {
  engine: SoundEngine;
  children: ReactNode;
}) {
  const switchedOn = useEditionInEffect().isFeatureEnabled('sounds');
  const setting = useSettings().current.sounds;
  const sounds = useMemo(
    () => createInterfaceSounds({ engine, switchedOn: () => switchedOn, setting: () => setting }),
    [engine, switchedOn, setting],
  );
  return <InterfaceSoundsProvider sounds={sounds}>{children}</InterfaceSoundsProvider>;
}
