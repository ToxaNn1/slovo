import { PronunciationButton } from '@slovo/ui';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { Media } from '@slovo/core';

import { edition } from '../edition/edition';
import { openDeviceMedia } from '../media/device-media';
import { recordingSourceOf } from '../media/recording-source';
import { useSettings } from '../settings/settings';
import { useShell, type Shell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { recordingPlayer } from '../sounds/interface-sounds';
import { createPronunciation } from './pronunciation';

/** «Звуки» as the cards last drew them. */
let soundsOn = true;

/** The id of the Narrator Voice the last tap read in (ADR 0083). */
let narratorVoice = edition.narratorVoiceOf(undefined).id;

/** The shell the last tap came from, whose Language Pack holds the Recordings. */
let tappedShell: Shell | undefined;

/** The Core media of each content store, opened at the first tap over it. */
const mediaOfStore = new WeakMap<object, Media<number>>();

/** The Core media of the tapped shell's Language Pack, in the Narrator Voice of the last tap. */
async function shellMedia(shell: Shell): Promise<Media<number>> {
  const [{ store }, { edition: inEffect }] = await Promise.all([
    shell.languagePack.opened(),
    shell.remoteSwitches.opened(),
  ]);
  let media = mediaOfStore.get(store);
  if (media === undefined) {
    media = openDeviceMedia({ store, edition: inEffect, voice: () => narratorVoice });
    mediaOfStore.set(store, media);
  }
  return media;
}

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
          tappedShell === undefined
            ? undefined
            : recordingSourceOf(await shellMedia(tappedShell), id),
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
    narratorVoice = voice;
    tappedShell = shell;
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
      narratorVoice = reader;
      tappedShell = shell;
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
