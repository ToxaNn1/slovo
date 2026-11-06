import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPronunciation,
  type RecordingPlayer,
  type Speech,
  type SpeechVoice,
  type SpokenLemmaOptions,
} from './pronunciation';

interface Utterance {
  readonly text: string;
  readonly options: SpokenLemmaOptions;
}

/**
 * A speech engine that behaves like the device's: it queues a Lemma spoken
 * while another plays, and `stop` ends the one playing and drops the queue.
 * Its voice list is whatever the test gives it.
 */
function fakeSpeech(voices: readonly SpeechVoice[]) {
  const queue: Utterance[] = [];
  const spoken: Utterance[] = [];
  let voiceList: Promise<readonly SpeechVoice[]> | undefined;
  const speech: Speech = {
    getAvailableVoicesAsync: () => voiceList ?? Promise.resolve(fake.voices),
    speak(text, options) {
      const utterance = { text, options };
      queue.push(utterance);
      spoken.push(utterance);
    },
    stop() {
      const playing = queue[0];
      queue.length = 0;
      playing?.options.onStopped();
      return Promise.resolve();
    },
  };
  const fake = {
    speech,
    voices,
    /** Everything handed to the engine, in order. */
    spoken,
    /** The text the engine is saying right now. */
    playing: () => queue[0]?.text,
    /** The engine finishes the Lemma it is saying. */
    finish() {
      queue.shift()?.options.onDone();
    },
    /** The engine fails on the Lemma it is saying. */
    fail() {
      queue.shift()?.options.onError(new Error('The voice failed'));
    },
    /** Holds the voice list back until the returned function is called. */
    holdVoices() {
      let release: () => void = () => undefined;
      voiceList = new Promise((resolve) => {
        release = () => {
          resolve(fake.voices);
        };
      });
      return () => {
        voiceList = undefined;
        release();
      };
    },
  };
  return fake;
}

const ukrainian: SpeechVoice = { language: 'uk-UA' };
const english: SpeechVoice = { language: 'en-US' };

/** A Word whose id is its Lemma, as the device-voice tests need no more. */
const word = (lemma: string) => ({ id: lemma, lemma });

/**
 * A Recording player that plays one Recording at a time, like the device's:
 * a new one or `stop` ends the one playing, without its end being reported.
 */
function fakePlayer() {
  let playing: { readonly source: number; readonly onEnd: () => void } | undefined;
  const played: number[] = [];
  const player: RecordingPlayer = {
    play(source, onEnd) {
      playing = { source, onEnd };
      played.push(source);
    },
    stop() {
      playing = undefined;
    },
  };
  return {
    player,
    /** Every Recording handed to the player, in order. */
    played,
    /** The Recording playing right now. */
    playing: () => playing?.source,
    /** The Recording plays to its end. */
    end() {
      const ended = playing;
      playing = undefined;
      ended?.onEnd();
    },
  };
}

/** No Word has a Recording, and «Звуки» are on: only the device voice reads. */
const deviceVoiceOnly = {
  player: fakePlayer().player,
  recordingOf: () => undefined,
  soundsOn: () => true,
};

const VEREMIIA = 'веремі́я';
const SHPARKYI = 'шпарки́й';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Pronunciation', () => {
  it('speaks the Lemma in the voice of the Edition’s language and shows it playing until done', async () => {
    const fake = fakeSpeech([english, ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    await pronunciation.toggle(word(VEREMIIA));

    expect(fake.spoken.map(({ options }) => options.language)).toEqual(['uk-UA']);
    expect(pronunciation.stateOf(VEREMIIA)).toBe('playing');

    fake.finish();
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
  });

  it('speaks the Lemma without its Stress marks, which the voices ignore', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    await pronunciation.toggle(word('за́мо́к'));

    expect(fake.playing()).toBe('замок');
  });

  it('stops on a second tap', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    await pronunciation.toggle(word(VEREMIIA));
    await pronunciation.toggle(word(VEREMIIA));

    expect(fake.playing()).toBeUndefined();
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(fake.spoken).toHaveLength(1);
  });

  it('stops one Lemma to speak another, and shows only the new one playing', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    await pronunciation.toggle(word(VEREMIIA));
    await pronunciation.toggle(word(SHPARKYI));

    expect(fake.playing()).toBe('шпаркий');
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(pronunciation.stateOf(SHPARKYI)).toBe('playing');
  });

  it('tells its listeners when the state changes', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });
    const states: string[] = [];
    const unsubscribe = pronunciation.subscribe(() => {
      states.push(pronunciation.stateOf(VEREMIIA));
    });

    await pronunciation.toggle(word(VEREMIIA));
    fake.finish();
    unsubscribe();
    await pronunciation.toggle(word(VEREMIIA));

    expect(states).toEqual(['playing', 'idle']);
  });

  it('returns to idle when the voice fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    await pronunciation.toggle(word(VEREMIIA));
    fake.fail();

    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
  });

  it('speaks only the last Lemma tapped while the voice list loads', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });
    const releaseVoices = fake.holdVoices();

    const first = pronunciation.toggle(word(VEREMIIA));
    const second = pronunciation.toggle(word(SHPARKYI));
    releaseVoices();
    await Promise.all([first, second]);

    expect(fake.spoken.map(({ text }) => text)).toEqual(['шпаркий']);
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(pronunciation.stateOf(SHPARKYI)).toBe('playing');
  });

  describe('the voice of the Edition’s language', () => {
    it('takes a voice of the same language from another region', async () => {
      const fake = fakeSpeech([english, { language: 'pt-PT' }]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'pt-BR',
      });

      await pronunciation.toggle(word('saudade'));

      expect(fake.spoken.map(({ options }) => options.language)).toEqual(['pt-PT']);
    });

    it('prefers a voice of the Edition’s own region', async () => {
      const fake = fakeSpeech([{ language: 'pt-PT' }, { language: 'pt-BR' }]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'pt-BR',
      });

      await pronunciation.toggle(word('saudade'));

      expect(fake.spoken.map(({ options }) => options.language)).toEqual(['pt-BR']);
    });

    it('reads language tags written with an underscore or in another case', async () => {
      const fake = fakeSpeech([{ language: 'UK_ua' }]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'uk-UA',
      });

      await pronunciation.toggle(word(VEREMIIA));

      expect(pronunciation.stateOf(VEREMIIA)).toBe('playing');
    });
  });

  describe('without a voice for the Edition’s language', () => {
    it('shows the missing-voice message on the tapped Lemma and says nothing', async () => {
      // "UK" here is a region, not the Ukrainian language.
      const fake = fakeSpeech([english, { language: 'en-UK' }, { language: 'pl-PL' }]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'uk-UA',
      });

      await pronunciation.toggle(word(VEREMIIA));

      expect(pronunciation.stateOf(VEREMIIA)).toBe('no-voice');
      expect(pronunciation.stateOf(SHPARKYI)).toBe('idle');
      expect(fake.spoken).toEqual([]);
    });

    it('shows the message when the device has no voices at all', async () => {
      const fake = fakeSpeech([]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'uk-UA',
      });

      await pronunciation.toggle(word(VEREMIIA));

      expect(pronunciation.stateOf(VEREMIIA)).toBe('no-voice');
    });

    it('hides the message when dismissed', async () => {
      const fake = fakeSpeech([english]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'uk-UA',
      });

      await pronunciation.toggle(word(VEREMIIA));
      pronunciation.dismiss();

      expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    });

    it('speaks once the reader has installed a voice', async () => {
      const fake = fakeSpeech([english]);
      const pronunciation = createPronunciation({
        ...deviceVoiceOnly,
        speech: fake.speech,
        locale: 'uk-UA',
      });

      await pronunciation.toggle(word(VEREMIIA));
      fake.voices = [english, ukrainian];
      await pronunciation.toggle(word(VEREMIIA));

      expect(pronunciation.stateOf(VEREMIIA)).toBe('playing');
      expect(fake.playing()).toBe('веремія');
    });
  });

  it('stays idle when the voice list cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = fakeSpeech([ukrainian]);
    fake.speech.getAvailableVoicesAsync = () => Promise.reject(new Error('No speech service'));
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    await pronunciation.toggle(word(VEREMIIA));

    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(fake.spoken).toEqual([]);
  });

  it('stops whatever is playing on request', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({
      ...deviceVoiceOnly,
      speech: fake.speech,
      locale: 'uk-UA',
    });

    await pronunciation.toggle(word(VEREMIIA));
    await pronunciation.stop();

    expect(fake.playing()).toBeUndefined();
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
  });

  describe('with Recordings', () => {
    const VEREMIIA_WORD = { id: 'w_0001', lemma: VEREMIIA };
    const SHPARKYI_WORD = { id: 'w_0002', lemma: SHPARKYI };
    const recordings: Readonly<Record<string, number>> = { w_0001: 11, w_0002: 12 };

    function setUp({ voices = [ukrainian], soundsOn = true } = {}) {
      const fake = fakeSpeech(voices);
      const player = fakePlayer();
      let sounds = soundsOn;
      const pronunciation = createPronunciation({
        speech: fake.speech,
        locale: 'uk-UA',
        player: player.player,
        recordingOf: (id) => recordings[id],
        soundsOn: () => sounds,
      });
      return {
        fake,
        player,
        pronunciation,
        turnSoundsOff: () => {
          sounds = false;
        },
      };
    }

    it('plays the Word’s Recording instead of the device voice, playing until it ends', async () => {
      const { fake, player, pronunciation } = setUp();

      await pronunciation.toggle(VEREMIIA_WORD);

      expect(player.playing()).toBe(11);
      expect(fake.spoken).toEqual([]);
      expect(pronunciation.stateOf('w_0001')).toBe('playing');

      player.end();
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
    });

    it('plays the Recording even when the device has no voice for the language', async () => {
      const { player, pronunciation } = setUp({ voices: [english] });

      await pronunciation.toggle(VEREMIIA_WORD);

      expect(player.playing()).toBe(11);
      expect(pronunciation.stateOf('w_0001')).toBe('playing');
    });

    it('speaks a Word without a Recording with the device voice', async () => {
      const { fake, player, pronunciation } = setUp();

      await pronunciation.toggle({ id: 'w_0003', lemma: 'загра́ва' });

      expect(player.played).toEqual([]);
      expect(fake.playing()).toBe('заграва');
      expect(pronunciation.stateOf('w_0003')).toBe('playing');
    });

    it('stops the Recording on a second tap', async () => {
      const { player, pronunciation } = setUp();

      await pronunciation.toggle(VEREMIIA_WORD);
      await pronunciation.toggle(VEREMIIA_WORD);

      expect(player.playing()).toBeUndefined();
      expect(player.played).toEqual([11]);
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
    });

    it('stops one Recording to play another, and shows only the new one playing', async () => {
      const { player, pronunciation } = setUp();

      await pronunciation.toggle(VEREMIIA_WORD);
      await pronunciation.toggle(SHPARKYI_WORD);

      expect(player.playing()).toBe(12);
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
      expect(pronunciation.stateOf('w_0002')).toBe('playing');
    });

    it('stops the device voice to play a Recording, and the Recording to speak', async () => {
      const { fake, player, pronunciation } = setUp();

      await pronunciation.toggle({ id: 'w_0003', lemma: 'загра́ва' });
      await pronunciation.toggle(VEREMIIA_WORD);
      expect(fake.playing()).toBeUndefined();
      expect(player.playing()).toBe(11);
      expect(pronunciation.stateOf('w_0003')).toBe('idle');

      await pronunciation.toggle({ id: 'w_0003', lemma: 'загра́ва' });
      expect(player.playing()).toBeUndefined();
      expect(fake.playing()).toBe('заграва');
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
    });

    it('stays silent with «Звуки» off, Recording or not', async () => {
      const { fake, player, pronunciation } = setUp({ soundsOn: false });

      await pronunciation.toggle(VEREMIIA_WORD);
      await pronunciation.toggle({ id: 'w_0003', lemma: 'загра́ва' });

      expect(player.played).toEqual([]);
      expect(fake.spoken).toEqual([]);
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
      expect(pronunciation.stateOf('w_0003')).toBe('idle');
    });

    it('shows no missing-voice message with «Звуки» off', async () => {
      const { pronunciation } = setUp({ voices: [english], soundsOn: false });

      await pronunciation.toggle({ id: 'w_0003', lemma: 'загра́ва' });

      expect(pronunciation.stateOf('w_0003')).toBe('idle');
    });

    it('stops the Recording on stop', async () => {
      const { player, pronunciation } = setUp();

      await pronunciation.toggle(VEREMIIA_WORD);
      await pronunciation.stop();

      expect(player.playing()).toBeUndefined();
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
    });

    it('stops what plays when a tap comes after «Звуки» go off', async () => {
      const { player, pronunciation, turnSoundsOff } = setUp();

      await pronunciation.toggle(VEREMIIA_WORD);
      turnSoundsOff();
      await pronunciation.toggle(SHPARKYI_WORD);

      expect(player.playing()).toBeUndefined();
      expect(player.played).toEqual([11]);
      expect(pronunciation.stateOf('w_0001')).toBe('idle');
    });

    it('ignores the end of a Recording it already stopped', async () => {
      const { player, pronunciation } = setUp();
      let ended: (() => void) | undefined;
      const play = player.player.play.bind(player.player);
      vi.spyOn(player.player, 'play').mockImplementation((source, onEnd) => {
        ended ??= onEnd;
        play(source, onEnd);
      });

      await pronunciation.toggle(VEREMIIA_WORD);
      await pronunciation.toggle(SHPARKYI_WORD);
      ended?.();

      expect(pronunciation.stateOf('w_0002')).toBe('playing');
    });
  });
});
