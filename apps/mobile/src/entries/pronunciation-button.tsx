import type { NarratorVoice } from '@slovo/contracts';
import { PronunciationButton, type PronunciationMessage } from '@slovo/ui';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { logError } from '../diagnostics/log';
import { edition } from '../edition/edition';
import { recordingSourceOf } from '../media/recording-source';
import { shellMedia } from '../media/shell-media';
import { useSettings } from '../settings/settings';
import { useShell, type Shell } from '../shell-value';
import { recordingPlayer } from '../sounds/interface-sounds';
import { createPronunciation, type PronunciationState } from './pronunciation';
import { useEditionInEffect } from '../edition/remote-switches';

/** «Звуки» as the cards last drew them. */
let soundsOn = true;

/** `recordedOnly` in effect as the cards last drew them (ADR 0195). */
let recordedOnly = false;

/** The shell the last tap came from, whose Language Pack holds the Recordings, and the voice it read in. */
let tapped: { readonly shell: Shell; readonly voice: string } | undefined;

/**
 * One for the whole app: one Word read at a time, by its Recording (bundled,
 * cached or downloaded at the tap) or, with none, offline or no audio module
 * in the binary, by the device's voice, which never reads while
 * `recordedOnly` is in effect (ADR 0195).
 */
const pronunciation = createPronunciation({
  speech: Speech,
  locale: edition.locale,
  ...(recordingPlayer === undefined
    ? {
        player: { play: () => undefined, stop: () => undefined },
        recordingOf: () => Promise.resolve({ kind: 'missing', reason: 'no-recording' } as const),
      }
    : {
        player: recordingPlayer,
        recordingOf: async (id: string) =>
          tapped === undefined
            ? ({ kind: 'missing', reason: 'no-recording' } as const)
            : recordingSourceOf(await shellMedia(tapped.shell), id, tapped.voice),
      }),
  soundsOn: () => soundsOn,
  recordedOnly: () => recordedOnly,
});

const subscribe = (listener: () => void) => pronunciation.subscribe(listener);

/**
 * The Narrator Voice that reads the Words: the reader's choice while its
 * switch is on in effect, else the Edition's default.
 */
function useNarratorVoice(): NarratorVoice {
  const chosen = useSettings().current.narratorVoice;
  return edition.narratorVoiceOf(
    useEditionInEffect().isFeatureEnabled('narratorVoice') ? chosen : undefined,
  );
}

/**
 * Whether a Word has no Recording to play in this voice, from the Recording
 * rows of the open Language Pack: it has Recordings in other voices only, or
 * none at all. Only while `recordedOnly` is in effect; until the rows are
 * read the button stays enabled (ADR 0195).
 */
function useUnrecorded(id: string, voice: string, only: boolean): boolean {
  const shell = useShell();
  const key = `${id}:${voice}`;
  const [seen, setSeen] = useState<{ readonly key: string; readonly unrecorded: boolean }>();
  useEffect(() => {
    if (!only) return;
    let live = true;
    shellMedia(shell)
      .then((media) => media.ofWord(id, voice))
      .then(
        ({ recording }) => {
          const unrecorded = recording.kind === 'other-voices' || recording.kind === 'absent';
          if (live) setSeen({ key, unrecorded });
        },
        (error: unknown) => {
          logError('Could not read the Recording rows of a Word', error);
        },
      );
    return () => {
      live = false;
    };
  }, [shell, id, voice, key, only]);
  return only && seen?.key === key && seen.unrecorded;
}

/** The message a Pronunciation state opens under the button, if any. */
function messageOf(
  state: PronunciationState,
  voice: NarratorVoice,
): PronunciationMessage | undefined {
  switch (state) {
    case 'idle':
    case 'playing':
      return undefined;
    case 'other-voices':
      return { reason: 'other-voices', voice: voice.name };
    default:
      return { reason: state };
  }
}

const dismiss = () => {
  pronunciation.dismiss();
};

/**
 * The Word card's Pronunciation button for a Word, read by its Recording or
 * the device's voice; none while the Pronunciation switch is off in effect,
 * and a Word playing when it goes off stops, as when «Звуки» go off. A Word
 * that starts playing is a Pronunciation played for Analytics (ADR 0068).
 */
export function LemmaPronunciation({ lemma, entryId }: { lemma: string; entryId: string }) {
  return useEditionInEffect().isFeatureEnabled('pronunciation') ? (
    <PlayingLemma lemma={lemma} entryId={entryId} />
  ) : null;
}

/**
 * Stops the Word with this id when «Звуки» go off, and when it leaves the
 * screen, such as a card leaving the Feed, which also closes its message.
 */
function useStopsWhenGone(id: string, sounds: boolean) {
  useEffect(() => {
    soundsOn = sounds;
    if (!sounds && pronunciation.stateOf(id) === 'playing') void pronunciation.stop();
  }, [sounds, id]);

  useEffect(
    () => () => {
      const left = pronunciation.stateOf(id);
      if (left === 'playing') void pronunciation.stop();
      else if (left !== 'idle') pronunciation.dismiss();
    },
    [id],
  );
}

function PlayingLemma({ lemma, entryId }: { lemma: string; entryId: string }) {
  const shell = useShell();
  const composition = shell.composition;
  const sounds = useSettings().current.sounds;
  const voice = useNarratorVoice();
  const only = useEditionInEffect().isFeatureEnabled('recordedOnly');
  const unrecorded = useUnrecorded(entryId, voice.id, only);
  const state = useSyncExternalStore(subscribe, () => pronunciation.stateOf(entryId));

  useStopsWhenGone(entryId, sounds);

  const toggle = useCallback(() => {
    const opened = composition.state;
    if (
      sounds &&
      !unrecorded &&
      pronunciation.stateOf(entryId) !== 'playing' &&
      opened.status === 'ready'
    )
      void opened.value.analytics.pronunciationPlayed(entryId);
    recordedOnly = only;
    tapped = { shell, voice: voice.id };
    void pronunciation.toggle({ id: entryId, lemma });
  }, [shell, composition, sounds, unrecorded, only, voice, lemma, entryId]);

  return (
    <PronunciationButton
      state={state === 'playing' ? 'playing' : unrecorded ? 'unavailable' : 'idle'}
      message={messageOf(state, voice)}
      onPress={toggle}
      onDismissMessage={dismiss}
    />
  );
}

/** What the voice screen needs to read the sample Word. */
export interface SampleReading {
  /** Whether the chosen voice reads the sample Word now. */
  readonly playing: boolean;
  /** Reads the sample Word in the chosen voice, or stops it while it reads. */
  readonly toggle: () => void;
  /** Reads the sample Word from its start in the voice with this id, just chosen. */
  readonly readIn: (voice: string) => void;
}

/**
 * The sample Word of the voice screen, read by the Narrator Voice's
 * Recording like a card's Word; it stops when the screen closes or «Звуки»
 * go off.
 */
export function useSampleReading(): SampleReading {
  const shell = useShell();
  const sounds = useSettings().current.sounds;
  const voice = useNarratorVoice();
  const { word, syllables } = edition.narratorVoiceSample;
  const state = useSyncExternalStore(subscribe, () => pronunciation.stateOf(word));

  useStopsWhenGone(word, sounds);

  const only = useEditionInEffect().isFeatureEnabled('recordedOnly');
  const read = useCallback(
    async (reader: string, fromStart: boolean) => {
      soundsOn = sounds;
      recordedOnly = only;
      tapped = { shell, voice: reader };
      if (fromStart) await pronunciation.stop();
      await pronunciation.toggle({ id: word, lemma: syllables.join('') });
    },
    [shell, sounds, only, word, syllables],
  );

  return {
    playing: state === 'playing',
    toggle: () => void read(voice.id, false),
    readIn: (chosen) => void read(chosen, true),
  };
}
