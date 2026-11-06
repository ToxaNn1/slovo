import type { RecordingPlayer } from '@/entries/pronunciation';

import type { AudioModule } from './sound-engine';

/** One loaded Recording of `expo-audio`, as far as the player plays it. */
export interface RecordingAudioPlayer {
  play(): void;
  pause(): void;
  remove(): void;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: { readonly didJustFinish: boolean }) => void,
  ): unknown;
}

/** The part of `expo-audio` the Recording player uses. */
export interface RecordingAudioModule {
  createAudioPlayer(source: number): RecordingAudioPlayer;
  setAudioModeAsync: AudioModule['setAudioModeAsync'];
}

/**
 * The device's player of Recordings (ADR 0083): one at a time, unloaded when
 * it ends or stops. Like the Interface sounds, it stays silent with the ring
 * switch off, mixes with the reader's music and never plays in the
 * background. With no audio module (a binary built before the 1.0 batch)
 * there is none, and the device voice reads every Word. A Recording that
 * fails to play ends at once.
 */
export function createRecordingPlayer(
  module: RecordingAudioModule | undefined,
): RecordingPlayer | undefined {
  if (module === undefined) return undefined;
  const audio = module;
  let current: RecordingAudioPlayer | undefined;
  let modeSet = false;

  function stop() {
    const playing = current;
    current = undefined;
    try {
      playing?.pause();
      playing?.remove();
    } catch {
      // A player that fails to stop is dropped all the same.
    }
  }

  return {
    play(source, onEnd) {
      stop();
      try {
        if (!modeSet) {
          modeSet = true;
          audio
            .setAudioModeAsync({
              playsInSilentMode: false,
              interruptionMode: 'mixWithOthers',
              shouldPlayInBackground: false,
            })
            .catch(() => undefined);
        }
        const player = audio.createAudioPlayer(source);
        current = player;
        player.addListener('playbackStatusUpdate', (status) => {
          if (!status.didJustFinish || current !== player) return;
          stop();
          onEnd();
        });
        player.play();
      } catch {
        stop();
        onEnd();
      }
    },
    stop,
  };
}
