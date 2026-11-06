import { PronunciationButton } from '@slovo/ui';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { activeEditionFiles, edition } from '../edition/edition';
import { useSettings } from '../settings/settings';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { recordingPlayer } from '../sounds/interface-sounds';
import { createPronunciation } from './pronunciation';

/** The Recordings of the default Narrator Voice, by Word id (ADR 0083). */
const recordings = activeEditionFiles.recordings[edition.narratorVoiceOf(undefined).id] ?? {};

/** «Звуки» as the cards last drew them. */
let soundsOn = true;

/**
 * One for the whole app: one Word read at a time, by its Recording or, with
 * none or no audio module in the binary, by the device's voice.
 */
const pronunciation = createPronunciation({
  speech: Speech,
  locale: edition.locale,
  ...(recordingPlayer === undefined
    ? { player: { play: () => undefined, stop: () => undefined }, recordingOf: () => undefined }
    : { player: recordingPlayer, recordingOf: (id: string) => recordings[id] }),
  soundsOn: () => soundsOn,
});

const subscribe = (listener: () => void) => pronunciation.subscribe(listener);
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
  const composition = useShell().composition;
  const sounds = useSettings().current.sounds;
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
    void pronunciation.toggle({ id: entryId, lemma });
  }, [composition, sounds, lemma, entryId]);

  return <PronunciationButton state={state} onPress={toggle} onDismissMessage={dismiss} />;
}
