import { createInterfaceSounds } from '@slovo/core';
import { InterfaceSoundsProvider } from '@slovo/ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { nativeModules } from '@/device/device-native-modules';
import { activeEditionFiles } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { useSettings } from '@/settings/settings';

import { createRecordingPlayer, type RecordingAudioModule } from './recording-player';
import { createSoundEngine, type AudioModule, type DeviceSoundEngine } from './sound-engine';

/**
 * The device's `expo-audio`, or undefined when the installed binary lacks it.
 * The module is required here and nowhere else: a static import would stop
 * the app at start.
 */
const audio = nativeModules.load(
  'audio',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-audio') as AudioModule & RecordingAudioModule,
);

/** The device's audio for the Interface sounds: the active Edition's sounds. */
export const soundEngine: DeviceSoundEngine = createSoundEngine(audio, activeEditionFiles.sounds);

/** The device's player of Recordings, for Pronunciation. */
export const recordingPlayer = createRecordingPlayer(audio);

/**
 * The Interface sounds below it, behind the `sounds` switch in effect and
 * «Звуки», for screens drawn under the gate of the Language Pack.
 */
export function InterfaceSoundsInEffect({
  engine,
  children,
}: {
  engine: DeviceSoundEngine;
  children: ReactNode;
}) {
  const switchedOn = useEditionInEffect().isFeatureEnabled('sounds');
  const setting = useSettings().current.sounds;
  // The players load while the app is idle once sounds are on, not at the first press (27.11 pass).
  useEffect(() => {
    if (!switchedOn || !setting) return undefined;
    const idle = requestIdleCallback(() => {
      engine.preload();
    });
    return () => {
      cancelIdleCallback(idle);
    };
  }, [engine, switchedOn, setting]);
  const sounds = useMemo(
    () => createInterfaceSounds({ engine, switchedOn: () => switchedOn, setting: () => setting }),
    [engine, switchedOn, setting],
  );
  return <InterfaceSoundsProvider sounds={sounds}>{children}</InterfaceSoundsProvider>;
}
