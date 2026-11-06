import { describe, expect, it, vi } from 'vitest';

import { createRecordingPlayer, type RecordingAudioModule } from './recording-player';

/** A mocked `expo-audio`: each player it makes, with what happened to it. */
function mockAudio({ failToLoad = false } = {}) {
  const players: {
    readonly source: number;
    playing: boolean;
    removed: boolean;
    finish: () => void;
  }[] = [];
  const audio = {
    createAudioPlayer: vi.fn((source: number) => {
      if (failToLoad) throw new Error('no such file');
      const made = { source, playing: false, removed: false, finish: () => undefined };
      players.push(made);
      return {
        play: () => {
          made.playing = true;
        },
        pause: () => {
          made.playing = false;
        },
        remove: () => {
          made.removed = true;
        },
        addListener: (
          _event: 'playbackStatusUpdate',
          listener: (status: { didJustFinish: boolean }) => void,
        ) => {
          made.finish = () => {
            made.playing = false;
            listener({ didJustFinish: true });
          };
        },
      };
    }),
    setAudioModeAsync: vi.fn(() => Promise.resolve()),
  } satisfies RecordingAudioModule;
  return { audio, players };
}

describe('the Recording player', () => {
  it('is missing without the audio module', () => {
    expect(createRecordingPlayer(undefined)).toBeUndefined();
  });

  it('plays a Recording, stays silent with the ring switch off, and reports its end once', () => {
    const { audio, players } = mockAudio();
    const onEnd = vi.fn();

    createRecordingPlayer(audio)?.play(7, onEnd);

    expect(players.map(({ source, playing }) => ({ source, playing }))).toEqual([
      { source: 7, playing: true },
    ]);
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: false, shouldPlayInBackground: false }),
    );
    expect(onEnd).not.toHaveBeenCalled();
    players[0]?.finish();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(players[0]?.removed).toBe(true);
  });

  it('stops the Recording playing without reporting its end', () => {
    const { audio, players } = mockAudio();
    const onEnd = vi.fn();
    const player = createRecordingPlayer(audio);

    player?.play(7, onEnd);
    player?.stop();

    expect(players[0]).toMatchObject({ playing: false, removed: true });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('plays one Recording at a time', () => {
    const { audio, players } = mockAudio();
    const player = createRecordingPlayer(audio);

    player?.play(7, () => undefined);
    player?.play(8, () => undefined);

    expect(players.map(({ source, playing }) => ({ source, playing }))).toEqual([
      { source: 7, playing: false },
      { source: 8, playing: true },
    ]);
  });

  it('reports a Recording that fails to play as ended', () => {
    const { audio } = mockAudio({ failToLoad: true });
    const onEnd = vi.fn();

    createRecordingPlayer(audio)?.play(7, onEnd);

    expect(onEnd).toHaveBeenCalledOnce();
  });
});
