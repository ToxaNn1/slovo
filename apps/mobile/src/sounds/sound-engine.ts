import type { InterfaceSound, SoundEngine } from '@slovo/core';

/** One loaded sound of `expo-audio`, as far as the engine plays it. */
export interface SoundPlayer {
  play(): void;
  seekTo(seconds: number): Promise<void>;
}

/** The part of `expo-audio` the engine uses. */
export interface AudioModule {
  createAudioPlayer(source: number): SoundPlayer;
  setAudioModeAsync(mode: {
    playsInSilentMode: boolean;
    interruptionMode: 'mixWithOthers';
    shouldPlayInBackground: boolean;
  }): Promise<void>;
}

/** Every Interface sound, so `preload` can load each the Edition has. */
const INTERFACE_SOUNDS: readonly InterfaceSound[] = ['shout', 'right', 'wrong', 'tap'];

/** The device's sound engine, which can also load every player ahead of its first play. */
export interface DeviceSoundEngine extends SoundEngine {
  /** Creates the player of each sound the Edition has, so a first play is not late (27.11 pass). */
  preload(): void;
}

/**
 * The device's audio for the Interface sounds: each sound the Edition brings,
 * loaded ahead by `preload` or else on its first play, and played from its
 * start every time. Interface
 * sounds stay silent with the ring switch off, mix with the reader's music
 * and never play in the background. With no audio module (a binary built
 * before the 1.0 batch) or no file for a sound, it plays nothing; a failure
 * to play is never the reader's problem.
 */
export function createSoundEngine(
  module: AudioModule | undefined,
  sources: Readonly<Partial<Record<InterfaceSound, number>>>,
): DeviceSoundEngine {
  if (module === undefined) return { play: () => undefined, preload: () => undefined };
  const audio = module;
  const players = new Map<InterfaceSound, SoundPlayer>();
  let modeSet = false;

  function playerOf(sound: InterfaceSound): SoundPlayer | undefined {
    const known = players.get(sound);
    if (known !== undefined) return known;
    const source = sources[sound];
    if (source === undefined) return undefined;
    const player = audio.createAudioPlayer(source);
    players.set(sound, player);
    return player;
  }

  /** Mixes with other audio and stays silent under the ring switch, before the first player. */
  function setMode() {
    if (modeSet) return;
    modeSet = true;
    audio
      .setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
      })
      .catch(() => undefined);
  }

  return {
    preload() {
      try {
        setMode();
      } catch {
        // A mode that fails to set leaves the sounds as the system plays them.
      }
      for (const sound of INTERFACE_SOUNDS) {
        try {
          playerOf(sound);
        } catch {
          // A sound that fails to load stays silent, and tries again when played.
        }
      }
    },
    play(sound) {
      try {
        setMode();
        const player = playerOf(sound);
        if (player === undefined) return;
        player.seekTo(0).catch(() => undefined);
        player.play();
      } catch {
        // A sound that fails to play stays silent.
      }
    },
  };
}
