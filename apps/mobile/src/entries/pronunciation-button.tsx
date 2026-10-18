import { PronunciationButton } from '@slovo/ui';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { edition } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { entryButtonsOf } from './entry-buttons';
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
 * when it goes off stops.
 */
export function LemmaPronunciation({ lemma }: { lemma: string }) {
  return entryButtonsOf(useEditionInEffect()).pronunciation ? <PlayingLemma lemma={lemma} /> : null;
}

function PlayingLemma({ lemma }: { lemma: string }) {
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
    void pronunciation.toggle(lemma);
  }, [lemma]);

  return <PronunciationButton state={state} onPress={toggle} onDismissMessage={dismiss} />;
}
