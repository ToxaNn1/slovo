import { logError } from '../diagnostics/log';
import type { RecordingLookup } from '../media/recording-source';
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
 * Why a tap read nothing, which the button's message says: the Word has no
 * Recording and the device no voice for the Edition's language; or, with
 * `recordedOnly` on, the Word has Recordings but none in the chosen Narrator
 * Voice, none at all, or one not cached while offline (ADR 0195).
 */
export type PronunciationMessageReason = 'no-voice' | 'other-voices' | 'no-recording' | 'offline';

/**
 * What a Pronunciation button shows for its Word: nothing special, the Word
 * being read, or the message why a tap read nothing.
 */
export type PronunciationState = 'idle' | 'playing' | PronunciationMessageReason;

export interface Pronunciation {
  /**
   * Reads the Word, or stops it when it is already being read. `onPlayed`
   * runs once the Word starts playing, never for a tap that ends silent.
   */
  toggle(word: PronouncedWord, onPlayed?: () => void): Promise<void>;
  /** The state of the Word with this id. */
  stateOf(id: string): PronunciationState;
  /** Stops whatever is being read. */
  stop(): Promise<void>;
  /** Hides the message. */
  dismiss(): void;
  /**
   * The Word with this id left the screen: it stops when it is being read or
   * waits to be, and its message hides.
   */
  leave(id: string): void;
  /** Calls the listener after every change of state; returns how to stop. */
  subscribe(listener: () => void): () => void;
}

/** The combining acute accent the Core marks Stress with. The voices skip it. */
const STRESS_MARK = /́/g;

/**
 * Pronunciation: the Word read aloud by its Recording in the
 * Narrator Voice, or by the device's voice for the Edition's language when it
 * has none. One Word is read at a time, and nothing with «Звуки» off. When
 * the Word has no Recording and the device no voice for the language, the
 * tapped Word shows the missing-voice message instead. With `recordedOnly`
 * on the device voice never reads: a Word without a Recording to play shows
 * why (ADR 0195).
 */
export function createPronunciation({
  speech,
  locale,
  player,
  recordingOf,
  soundsOn,
  recordedOnly,
}: {
  speech: Speech;
  /** The Edition's locale (BCP 47), e.g. "uk-UA". */
  locale: string;
  player: RecordingPlayer;
  /** The Recording of the Word with this id in the Narrator Voice, or why it has none; it may download first. */
  recordingOf: (id: string) => Promise<RecordingLookup>;
  /** Whether «Звуки» are on now. */
  soundsOn: () => boolean;
  /** Whether `recordedOnly` is in effect now. */
  recordedOnly: () => boolean;
}): Pronunciation {
  const listeners = new Set<() => void>();
  let state: { readonly id: string; readonly state: PronunciationState } | undefined;
  /** The reading whose end clears the playing state; older ones no longer do. */
  let current: object | undefined;
  /**
   * The last tap, so only it speaks when several wait for the voice list or a
   * Recording; none once a stop drops it.
   */
  let latestTap: { readonly id: string } | undefined;

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

  /** Stops whatever is read, and drops the tap that waits to read. */
  function stop() {
    latestTap = undefined;
    return silence();
  }

  function dismiss() {
    if (state !== undefined && state.state !== 'playing') set(undefined);
  }

  /** Marks the Word playing; the returned function ends this reading alone. */
  function start(id: string, onPlayed: () => void): () => void {
    const reading = {};
    current = reading;
    set({ id, state: 'playing' });
    onPlayed();
    return () => {
      if (current !== reading) return;
      current = undefined;
      set(undefined);
    };
  }

  return {
    async toggle({ id, lemma }, onPlayed = () => undefined) {
      if ((state?.id === id && state.state === 'playing') || !soundsOn()) {
        await stop();
        return;
      }
      const tap = { id };
      latestTap = tap;
      /** Whether this tap still reads: no later tap or stop came, and «Звуки» stay on. */
      const stillAsked = () => latestTap === tap && soundsOn();

      let recording: RecordingLookup;
      try {
        recording = await recordingOf(id);
      } catch (error) {
        logError('Could not find the Recording for Pronunciation', error);
        recording = { kind: 'missing', reason: 'no-recording' };
      }
      // A later tap or a stop came while the Recording was found.
      if (!stillAsked()) return;
      if (recording.kind === 'found' || recordedOnly()) {
        if (state?.state === 'playing') {
          await silence();
          // A later tap or a stop came while the voice stopped.
          if (!stillAsked()) return;
        }
        if (recording.kind === 'found') player.play(recording.source, start(id, onPlayed));
        else set({ id, state: recording.reason });
        return;
      }

      let voices: readonly SpeechVoice[];
      try {
        voices = await speech.getAvailableVoicesAsync();
      } catch (error) {
        logError('Could not list the voices for Pronunciation', error);
        return;
      }
      if (!stillAsked()) return;

      const voice = voiceFor(locale, voices);
      if (voice === undefined) {
        if (state?.state === 'playing') {
          await silence();
          if (!stillAsked()) return;
        }
        set({ id, state: 'no-voice' });
        return;
      }

      // The engine would queue the new Lemma behind the one it is saying.
      if (state?.state === 'playing') {
        await silence();
        // A later tap or a stop came while the voice stopped.
        if (!stillAsked()) return;
      }
      const finish = start(id, onPlayed);
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

    stop,

    dismiss,

    leave(id) {
      if (latestTap?.id === id || (state?.id === id && state.state === 'playing')) void stop();
      if (state?.id === id) dismiss();
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
