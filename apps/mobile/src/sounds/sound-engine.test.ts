import type { InterfaceSound } from '@slovo/core';
import { describe, expect, it, vi } from 'vitest';

import { createSoundEngine, type AudioModule } from './sound-engine';

/** A mocked `expo-audio`, which records each sound it plays by its source. */
function mockAudio({ failToLoad = false } = {}) {
  const played: number[] = [];
  const audio = {
    createAudioPlayer: vi.fn((source: number) => {
      if (failToLoad) throw new Error('no such file');
      return {
        play: () => {
          played.push(source);
        },
        seekTo: () => Promise.resolve(),
      };
    }),
    setAudioModeAsync: vi.fn(() => Promise.resolve()),
  } satisfies AudioModule;
  return { audio, played };
}

const sources: Partial<Record<InterfaceSound, number>> = { shout: 1, right: 2, wrong: 3, tap: 4 };

describe('the sound engine', () => {
  it('plays the file of the asked sound, every time it is asked', () => {
    const { audio, played } = mockAudio();
    const engine = createSoundEngine(audio, sources);

    engine.play('right');
    engine.play('wrong');
    engine.play('right');

    expect(played).toEqual([2, 3, 2]);
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(2);
  });

  it('loads the player of each sound the Edition has ahead, and plays them with no new load', () => {
    const { audio, played } = mockAudio();
    const engine = createSoundEngine(audio, { right: 2, tap: 4 });

    engine.preload();
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(2);
    engine.preload();
    engine.play('tap');
    engine.play('right');

    expect(played).toEqual([4, 2]);
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(2);
  });

  it('tries every file ahead though one does not load, and tries a failed one again when played', () => {
    const { audio } = mockAudio({ failToLoad: true });
    const engine = createSoundEngine(audio, { right: 2, tap: 4 });

    expect(() => {
      engine.preload();
    }).not.toThrow();
    expect(audio.createAudioPlayer.mock.calls).toEqual([[2], [4]]);

    engine.play('tap');

    expect(audio.createAudioPlayer.mock.calls).toEqual([[2], [4], [4]]);
  });

  it('sets the audio mode before it loads the first player ahead', () => {
    const { audio } = mockAudio();
    createSoundEngine(audio, sources).preload();

    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
    const [modeSet] = audio.setAudioModeAsync.mock.invocationCallOrder;
    const [firstLoad] = audio.createAudioPlayer.mock.invocationCallOrder;
    expect(modeSet).toBeLessThan(firstLoad ?? 0);
  });

  it('stays silent with the ring switch off, mixes with other audio and keeps out of the background', () => {
    const { audio } = mockAudio();

    createSoundEngine(audio, sources).play('tap');

    expect(audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
  });

  it('plays nothing for a sound the Edition does not bring', () => {
    const { audio, played } = mockAudio();

    createSoundEngine(audio, { right: 2 }).play('shout');

    expect(played).toEqual([]);
  });

  it('plays nothing, and does not throw, without the audio module', () => {
    expect(() => {
      createSoundEngine(undefined, sources).play('right');
    }).not.toThrow();
  });

  it('does not throw when a sound fails to load', () => {
    const { audio, played } = mockAudio({ failToLoad: true });

    expect(() => {
      createSoundEngine(audio, sources).play('right');
    }).not.toThrow();
    expect(played).toEqual([]);
  });
});
