import { logError } from '../diagnostics/log';
import type { RecordingSource } from '../media/recording-source';
import type { RecordingPlayer } from '../sounds/recording-player';

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

/** The Word a Pronunciation button reads: its id finds its Recording. */
export interface PronouncedWord {
  readonly id: string;
  readonly lemma: string;
}

/**
 * What a Pronunciation button shows for its Word: nothing special, the Word
 * being read, or the message that the Word has no Recording and the device no
 * voice for the Edition's language.
 */
export type PronunciationState = 'idle' | 'playing' | 'no-voice';

export interface Pronunciation {
  /** Reads the Word, or stops it when it is already being read. */
  toggle(word: PronouncedWord): Promise<void>;
  /** The state of the Word with this id. */
  stateOf(id: string): PronunciationState;
  /** Stops whatever is being read. */
  stop(): Promise<void>;
  /** Hides the missing-voice message. */
  dismiss(): void;
  /** Calls the listener after every change of state; returns how to stop. */
  subscribe(listener: () => void): () => void;
}

/** The combining acute accent the Core marks Stress with. The voices skip it. */
const STRESS_MARK = /́/g;

/**
 * Pronunciation (ADR 0083): the Word read aloud by its Recording in the
 * Narrator Voice, or by the device's voice for the Edition's language when it
 * has none. One Word is read at a time, and nothing with «Звуки» off. When
 * the Word has no Recording and the device no voice for the language, the
 * tapped Word shows the missing-voice message instead.
 */
export function createPronunciation({
  speech,
  locale,
  player,
  recordingOf,
  soundsOn,
}: {
  speech: Speech;
  /** The Edition's locale (BCP 47), e.g. "uk-UA". */
  locale: string;
  player: RecordingPlayer;
  /** The Recording of the Word with this id in the Narrator Voice, if it has one; it may download first. */
  recordingOf: (id: string) => Promise<RecordingSource | undefined>;
  /** Whether «Звуки» are on now. */
  soundsOn: () => boolean;
}): Pronunciation {
  const listeners = new Set<() => void>();
  let state: { readonly id: string; readonly state: PronunciationState } | undefined;
  /** The reading whose end clears the playing state; older ones no longer do. */
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
    player.stop();
    return speech.stop();
  }

  /** Marks the Word playing; the returned function ends this reading alone. */
  function start(id: string): () => void {
    const reading = {};
    current = reading;
    set({ id, state: 'playing' });
    return () => {
      if (current !== reading) return;
      current = undefined;
      set(undefined);
    };
  }

  return {
    async toggle({ id, lemma }) {
      const tap = {};
      latestTap = tap;
      if ((state?.id === id && state.state === 'playing') || !soundsOn()) {
        await silence();
        return;
      }

      let recording: RecordingSource | undefined;
      try {
        recording = await recordingOf(id);
      } catch (error) {
        // The device voice reads a Word whose Recording cannot be found.
        logError('Could not find the Recording for Pronunciation', error);
      }
      // A later tap came while the Recording was found; it reads instead.
      if (latestTap !== tap) return;
      if (recording !== undefined) {
        if (state?.state === 'playing') {
          await silence();
          // A later tap came while the voice stopped; it reads instead.
          if (latestTap !== tap) return;
        }
        player.play(recording, start(id));
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
        if (state?.state === 'playing') {
          await silence();
          if (latestTap !== tap) return;
        }
        set({ id, state: 'no-voice' });
        return;
      }

      // The engine would queue the new Lemma behind the one it is saying.
      if (state?.state === 'playing') {
        await silence();
        // A later tap came while the voice stopped; it reads instead.
        if (latestTap !== tap) return;
      }
      const finish = start(id);
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

    stateOf(id) {
      return state?.id === id ? state.state : 'idle';
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
