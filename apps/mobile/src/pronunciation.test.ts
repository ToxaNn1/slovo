import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPronunciation,
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

const VEREMIIA = 'веремі́я';
const SHPARKYI = 'шпарки́й';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Pronunciation', () => {
  it('speaks the Lemma in the voice of the Edition’s language and shows it playing until done', async () => {
    const fake = fakeSpeech([english, ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    await pronunciation.toggle(VEREMIIA);

    expect(fake.spoken.map(({ options }) => options.language)).toEqual(['uk-UA']);
    expect(pronunciation.stateOf(VEREMIIA)).toBe('playing');

    fake.finish();
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
  });

  it('speaks the Lemma without its Stress marks, which the voices ignore', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    await pronunciation.toggle('за́мо́к');

    expect(fake.playing()).toBe('замок');
  });

  it('stops on a second tap', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    await pronunciation.toggle(VEREMIIA);
    await pronunciation.toggle(VEREMIIA);

    expect(fake.playing()).toBeUndefined();
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(fake.spoken).toHaveLength(1);
  });

  it('stops one Lemma to speak another, and shows only the new one playing', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    await pronunciation.toggle(VEREMIIA);
    await pronunciation.toggle(SHPARKYI);

    expect(fake.playing()).toBe('шпаркий');
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(pronunciation.stateOf(SHPARKYI)).toBe('playing');
  });

  it('tells its listeners when the state changes', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });
    const states: string[] = [];
    const unsubscribe = pronunciation.subscribe(() => {
      states.push(pronunciation.stateOf(VEREMIIA));
    });

    await pronunciation.toggle(VEREMIIA);
    fake.finish();
    unsubscribe();
    await pronunciation.toggle(VEREMIIA);

    expect(states).toEqual(['playing', 'idle']);
  });

  it('returns to idle when the voice fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    await pronunciation.toggle(VEREMIIA);
    fake.fail();

    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
  });

  it('speaks only the last Lemma tapped while the voice list loads', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });
    const releaseVoices = fake.holdVoices();

    const first = pronunciation.toggle(VEREMIIA);
    const second = pronunciation.toggle(SHPARKYI);
    releaseVoices();
    await Promise.all([first, second]);

    expect(fake.spoken.map(({ text }) => text)).toEqual(['шпаркий']);
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(pronunciation.stateOf(SHPARKYI)).toBe('playing');
  });

  describe('the voice of the Edition’s language', () => {
    it('takes a voice of the same language from another region', async () => {
      const fake = fakeSpeech([english, { language: 'pt-PT' }]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'pt-BR' });

      await pronunciation.toggle('saudade');

      expect(fake.spoken.map(({ options }) => options.language)).toEqual(['pt-PT']);
    });

    it('prefers a voice of the Edition’s own region', async () => {
      const fake = fakeSpeech([{ language: 'pt-PT' }, { language: 'pt-BR' }]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'pt-BR' });

      await pronunciation.toggle('saudade');

      expect(fake.spoken.map(({ options }) => options.language)).toEqual(['pt-BR']);
    });

    it('reads language tags written with an underscore or in another case', async () => {
      const fake = fakeSpeech([{ language: 'UK_ua' }]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

      await pronunciation.toggle(VEREMIIA);

      expect(pronunciation.stateOf(VEREMIIA)).toBe('playing');
    });
  });

  describe('without a voice for the Edition’s language', () => {
    it('shows the missing-voice message on the tapped Lemma and says nothing', async () => {
      // "UK" here is a region, not the Ukrainian language.
      const fake = fakeSpeech([english, { language: 'en-UK' }, { language: 'pl-PL' }]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

      await pronunciation.toggle(VEREMIIA);

      expect(pronunciation.stateOf(VEREMIIA)).toBe('no-voice');
      expect(pronunciation.stateOf(SHPARKYI)).toBe('idle');
      expect(fake.spoken).toEqual([]);
    });

    it('shows the message when the device has no voices at all', async () => {
      const fake = fakeSpeech([]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

      await pronunciation.toggle(VEREMIIA);

      expect(pronunciation.stateOf(VEREMIIA)).toBe('no-voice');
    });

    it('hides the message when dismissed', async () => {
      const fake = fakeSpeech([english]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

      await pronunciation.toggle(VEREMIIA);
      pronunciation.dismiss();

      expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    });

    it('speaks once the reader has installed a voice', async () => {
      const fake = fakeSpeech([english]);
      const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

      await pronunciation.toggle(VEREMIIA);
      fake.voices = [english, ukrainian];
      await pronunciation.toggle(VEREMIIA);

      expect(pronunciation.stateOf(VEREMIIA)).toBe('playing');
      expect(fake.playing()).toBe('веремія');
    });
  });

  it('stays idle when the voice list cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = fakeSpeech([ukrainian]);
    fake.speech.getAvailableVoicesAsync = () => Promise.reject(new Error('No speech service'));
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    await pronunciation.toggle(VEREMIIA);

    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
    expect(fake.spoken).toEqual([]);
  });

  it('stops whatever is playing on request', async () => {
    const fake = fakeSpeech([ukrainian]);
    const pronunciation = createPronunciation({ speech: fake.speech, locale: 'uk-UA' });

    await pronunciation.toggle(VEREMIIA);
    await pronunciation.stop();

    expect(fake.playing()).toBeUndefined();
    expect(pronunciation.stateOf(VEREMIIA)).toBe('idle');
  });
});
