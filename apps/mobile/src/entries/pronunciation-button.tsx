import { PronunciationButton } from '@slovo/ui';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { edition } from '../edition/edition';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { createPronunciation } from './pronunciation';

/** One for the whole app: the device speaks one Lemma at a time. */
const pronunciation = createPronunciation({ speech: Speech, locale: edition.locale });

const subscribe = (listener: () => void) => pronunciation.subscribe(listener);
const dismiss = () => {
  pronunciation.dismiss();
};

/**
 * The Word card's Pronunciation button for a Lemma, read by the device's voice;
 * none while the Pronunciation switch is off in effect, and a Lemma playing
 * when it goes off stops. A Lemma that starts playing is a Pronunciation
 * played for Analytics (ADR 0068).
 */
export function LemmaPronunciation({ lemma, entryId }: { lemma: string; entryId: string }) {
  return useShown().entryButtons.pronunciation ? (
    <PlayingLemma lemma={lemma} entryId={entryId} />
  ) : null;
}

function PlayingLemma({ lemma, entryId }: { lemma: string; entryId: string }) {
  const composition = useShell().composition;
  const state = useSyncExternalStore(subscribe, () => pronunciation.stateOf(lemma));

  // A card that leaves the Feed stops its Lemma and closes its message.
  useEffect(
    () => () => {
      const left = pronunciation.stateOf(lemma);
      if (left === 'playing') void pronunciation.stop();
      if (left === 'no-voice') pronunciation.dismiss();
    },
    [lemma],
  );

  const toggle = useCallback(() => {
    const opened = composition.state;
    if (pronunciation.stateOf(lemma) !== 'playing' && opened.status === 'ready')
      void opened.value.analytics.pronunciationPlayed(entryId);
    void pronunciation.toggle(lemma);
  }, [composition, lemma, entryId]);

  return <PronunciationButton state={state} onPress={toggle} onDismissMessage={dismiss} />;
}
