import { createInterfaceSounds, type SoundEngine } from '@slovo/core';
import { InterfaceSoundsProvider } from '@slovo/ui';
import { useMemo, type ReactNode } from 'react';

import { nativeModules } from '@/device/device-native-modules';
import { activeEditionFiles } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { useSettings } from '@/settings/settings';

import { createSoundEngine, type AudioModule } from './sound-engine';

/**
 * The device's audio for the Interface sounds: `expo-audio` playing the
 * active Edition's sounds, or nothing when the installed binary lacks it. The
 * module is required here and nowhere else: a static import would stop the
 * app at start.
 */
export const soundEngine: SoundEngine = createSoundEngine(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nativeModules.load('audio', () => require('expo-audio') as AudioModule),
  activeEditionFiles.sounds,
);

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
