/** An Interface sound: a shout, a right answer, a wrong answer or a tap (CONTEXT.md). */
export type InterfaceSound = 'shout' | 'right' | 'wrong' | 'tap';

/** What the device can play. The shell connects it to the device's audio. */
export interface SoundEngine {
  play(sound: InterfaceSound): void;
}

/** The Interface sounds the app plays, every one of them behind the `sounds` switch and «Звуки». */
export interface InterfaceSounds {
  play(sound: InterfaceSound): void;
}

/**
 * The one way the app plays an Interface sound: it asks every time whether
 * the `sounds` Feature Switch is in effect and «Звуки» is on, so a change of
 * either applies to the very next sound (ADR 0070).
 */
export function createInterfaceSounds({
  engine,
  switchedOn,
  setting,
}: {
  engine: SoundEngine;
  /** Whether the `sounds` Feature Switch is in effect right now. */
  switchedOn: () => boolean;
  /** Whether the reader has «Звуки» on right now. */
  setting: () => boolean;
}): InterfaceSounds {
  return {
    play(sound) {
      if (switchedOn() && setting()) engine.play(sound);
    },
  };
}

/** Interface sounds that play nothing: the app's, until a shell gives its own. */
export const silentInterfaceSounds: InterfaceSounds = { play: () => undefined };
