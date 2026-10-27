import { logError } from '../diagnostics/log';

/** A voice the device can speak with, as `expo-speech` lists it. */
export interface SpeechVoice {
  /** A BCP 47 language tag, e.g. "uk-UA". */
  readonly language: string;
}

/** How a Lemma is spoken, and how the device reports back. */
export interface SpokenLemmaOptions {
  readonly language: string;
  readonly onDone: () => void;
  readonly onStopped: () => void;
  readonly onError: (error: Error) => void;
}

/**
 * The device's speech engine: the slice of `expo-speech` Pronunciation needs.
 * Like the device, it queues what it is asked to say while it speaks, and
 * `stop` ends what it says and drops the queue.
 */
export interface Speech {
  getAvailableVoicesAsync(): Promise<readonly SpeechVoice[]>;
  speak(text: string, options: SpokenLemmaOptions): void;
  stop(): Promise<void>;
}

/**
 * What a Pronunciation button shows for its Lemma: nothing special, the Lemma
 * being spoken, or the message that the device has no voice for the Edition's
 * language.
 */
export type PronunciationState = 'idle' | 'playing' | 'no-voice';

export interface Pronunciation {
  /** Speaks the Lemma, or stops it when it is already being spoken. */
  toggle(lemma: string): Promise<void>;
  stateOf(lemma: string): PronunciationState;
  /** Stops whatever is being spoken. */
  stop(): Promise<void>;
  /** Hides the missing-voice message. */
  dismiss(): void;
  /** Calls the listener after every change of state; returns how to stop. */
  subscribe(listener: () => void): () => void;
}

/** The combining acute accent the Core marks Stress with. The voices skip it. */
const STRESS_MARK = /́/g;

/**
 * Pronunciation: the Lemma read aloud by the device's voice for the Edition's
 * language. One Lemma is spoken at a time. When the device has no voice for
 * the language, the tapped Lemma shows the missing-voice message instead.
 */
export function createPronunciation({
  speech,
  locale,
}: {
  speech: Speech;
  /** The Edition's locale (BCP 47), e.g. "uk-UA". */
  locale: string;
}): Pronunciation {
  const listeners = new Set<() => void>();
  let state: { readonly lemma: string; readonly state: PronunciationState } | undefined;
  /** The utterance whose end clears the playing state; older ones no longer do. */
  let current: object | undefined;
  /** The last tap, so only it speaks when several wait for the voice list. */
  let latestTap: object | undefined;

  function set(next: typeof state) {
    state = next;
    for (const listener of listeners) listener();
  }

  function silence() {
    current = undefined;
    if (state?.state === 'playing') set(undefined);
    return speech.stop();
  }

  return {
    async toggle(lemma) {
      const tap = {};
      latestTap = tap;
      if (state?.lemma === lemma && state.state === 'playing') {
        await silence();
        return;
      }

      let voices: readonly SpeechVoice[];
      try {
        voices = await speech.getAvailableVoicesAsync();
      } catch (error) {
        logError('Could not list the voices for Pronunciation', error);
        return;
      }
      if (latestTap !== tap) return;

      const voice = voiceFor(locale, voices);
      if (voice === undefined) {
        if (state?.state === 'playing') await silence();
        set({ lemma, state: 'no-voice' });
        return;
      }

      // The engine would queue the new Lemma behind the one it is saying.
      if (state?.state === 'playing') await silence();
      const utterance = {};
      current = utterance;
      const finish = () => {
        if (current !== utterance) return;
        current = undefined;
        set(undefined);
      };
      set({ lemma, state: 'playing' });
      speech.speak(lemma.replace(STRESS_MARK, ''), {
        language: voice.language,
        onDone: finish,
        onStopped: finish,
        onError: (error) => {
          logError('Could not pronounce the Lemma', error);
          finish();
        },
      });
    },

    stateOf(lemma) {
      return state?.lemma === lemma ? state.state : 'idle';
    },

    stop: silence,

    dismiss() {
      if (state?.state === 'no-voice') set(undefined);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The language and region subtags of a tag such as "uk-UA" or "uk_ua". */
function subtags(tag: string): readonly string[] {
  return tag.toLowerCase().split(/[-_]/);
}

/** A voice of the locale itself, or else any voice of its language. */
function voiceFor(locale: string, voices: readonly SpeechVoice[]): SpeechVoice | undefined {
  const wanted = subtags(locale).join('-');
  const [language] = subtags(locale);
  return (
    voices.find((voice) => subtags(voice.language).join('-') === wanted) ??
    voices.find((voice) => subtags(voice.language)[0] === language)
  );
}
