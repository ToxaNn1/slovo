import { PronunciationButton } from '@slovo/ui';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { edition } from '../edition/edition';
import { recordingSourceOf } from '../media/recording-source';
import { shellMedia } from '../media/shell-media';
import { useSettings } from '../settings/settings';
import { useShell, type Shell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { recordingPlayer } from '../sounds/interface-sounds';
import { createPronunciation } from './pronunciation';

/** «Звуки» as the cards last drew them. */
let soundsOn = true;

/** The shell the last tap came from, whose Language Pack holds the Recordings, and the voice it read in. */
let tapped: { readonly shell: Shell; readonly voice: string } | undefined;

/**
 * One for the whole app: one Word read at a time, by its Recording (bundled,
 * cached or downloaded at the tap) or, with none, offline or no audio module
 * in the binary, by the device's voice.
 */
const pronunciation = createPronunciation({
  speech: Speech,
  locale: edition.locale,
  ...(recordingPlayer === undefined
    ? {
        player: { play: () => undefined, stop: () => undefined },
        recordingOf: () => Promise.resolve(undefined),
      }
    : {
        player: recordingPlayer,
        recordingOf: async (id: string) =>
          tapped === undefined
            ? undefined
            : recordingSourceOf(await shellMedia(tapped.shell), id, tapped.voice),
      }),
  soundsOn: () => soundsOn,
});

const subscribe = (listener: () => void) => pronunciation.subscribe(listener);

/**
 * The id of the Narrator Voice that reads the Words: the reader's choice
 * while its switch is on in effect, else the Edition's default (ADR 0083).
 */
function useNarratorVoice(): string {
  const chosen = useSettings().current.narratorVoice;
  return edition.narratorVoiceOf(useShown().narratorVoiceSetting ? chosen : undefined).id;
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
  return useShown().entryButtons.pronunciation ? (
    <PlayingLemma lemma={lemma} entryId={entryId} />
  ) : null;
}

function PlayingLemma({ lemma, entryId }: { lemma: string; entryId: string }) {
  const shell = useShell();
  const composition = shell.composition;
  const sounds = useSettings().current.sounds;
  const voice = useNarratorVoice();
  const state = useSyncExternalStore(subscribe, () => pronunciation.stateOf(entryId));

  useEffect(() => {
    soundsOn = sounds;
    if (!sounds && pronunciation.stateOf(entryId) === 'playing') void pronunciation.stop();
  }, [sounds, entryId]);

  // A card that leaves the Feed stops its Word and closes its message.
  useEffect(
    () => () => {
      const left = pronunciation.stateOf(entryId);
      if (left === 'playing') void pronunciation.stop();
      if (left === 'no-voice') pronunciation.dismiss();
    },
    [entryId],
  );

  const toggle = useCallback(() => {
    const opened = composition.state;
    if (sounds && pronunciation.stateOf(entryId) !== 'playing' && opened.status === 'ready')
      void opened.value.analytics.pronunciationPlayed(entryId);
    tapped = { shell, voice };
    void pronunciation.toggle({ id: entryId, lemma });
  }, [shell, composition, sounds, voice, lemma, entryId]);

  return <PronunciationButton state={state} onPress={toggle} onDismissMessage={dismiss} />;
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

  // «Звуки» going off stop the sample, as they stop a card's Word.
  useEffect(() => {
    soundsOn = sounds;
    if (!sounds && pronunciation.stateOf(word) === 'playing') void pronunciation.stop();
  }, [sounds, word]);

  useEffect(
    () => () => {
      const left = pronunciation.stateOf(word);
      if (left === 'playing') void pronunciation.stop();
      if (left === 'no-voice') pronunciation.dismiss();
    },
    [word],
  );

  const read = useCallback(
    async (reader: string, fromStart: boolean) => {
      soundsOn = sounds;
      tapped = { shell, voice: reader };
      if (fromStart) await pronunciation.stop();
      await pronunciation.toggle({ id: word, lemma: syllables.join('') });
    },
    [shell, sounds, word, syllables],
  );

  return {
    playing: state === 'playing',
    toggle: () => void read(voice, false),
    readIn: (chosen) => void read(chosen, true),
  };
}
