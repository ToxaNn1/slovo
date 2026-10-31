import type { MoodChoice } from '@slovo/core';
import { MoodButton, MoodSheet, useReduceMotion, type MoodChip } from '@slovo/ui';
import { useEffect, useRef, useState } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useReplaceOpenEntry } from '../entries/replace-open-entry';
import { useOpenScreen } from '../entries/use-open-screen';
import { useShown } from '../shown-in-effect';

/** The roulette's first pause between two Lemmas; each next one is longer, so it slows down. */
const FIRST_STEP_MS = 60;
/** How much longer each pause is than the one before. */
const STEP_GROWTH_MS = 14;
/** How long the Lemma it lands on stays before the sheet leaves. */
const LANDING_HOLD_MS = 250;

/**
 * When each Lemma of a roulette shows, from the tap, and when it ends: 12
 * Lemmas end at about 1.7 seconds, with the sheet's slide out under 2.
 */
function rouletteTimes(count: number): { shows: readonly number[]; end: number } {
  const shows = [0];
  for (let step = 1; step < count; step += 1) {
    shows.push((shows[step - 1] ?? 0) + FIRST_STEP_MS + (step - 1) * STEP_GROWTH_MS);
  }
  return { shows, end: (shows.at(-1) ?? 0) + LANDING_HOLD_MS };
}

/** The chips of the moods on offer, a mood without an Eligible Word disabled with why. */
function chipsOf(choices: readonly MoodChoice[]): readonly MoodChip[] {
  return choices.map(({ mood, refusal }) => ({
    ...mood,
    disabledHint: refusal === undefined ? undefined : editionStrings.mood.noEligibleWord,
  }));
}

/**
 * «Слово під настрій» (ADR 0054): the 🎲 of the «Головна» header and the
 * sheet of mood chips it opens, while moods are on in effect. A chip runs the
 * roulette of its Lemmas, then the sheet leaves and the card of the Word it
 * landed on opens, which makes nothing Seen. Under Reduce Motion the card
 * opens straight away. Closing the sheet stops the roulette. With
 * `replaceOpenEntry` on in effect, the card takes the place of the one the
 * roulette opened before, so «Назад» returns to «Головна».
 */
export function MoodButtonAndSheet() {
  const shown = useShown().moods;
  const composition = useComposition();
  const reduceMotion = useReduceMotion();
  const openScreen = useOpenScreen();
  const replaceOpenEntry = useReplaceOpenEntry();
  const replaces = useEditionInEffect().isFeatureEnabled('replaceOpenEntry');
  const [open, setOpen] = useState(false);
  const [chips, setChips] = useState<readonly MoodChip[]>([]);
  const [lemma, setLemma] = useState<string>();
  /** The Word the roulette landed on, opened once the sheet has left. */
  const landed = useRef<string | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stopRoulette = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => stopRoulette, []);

  if (!shown) return null;

  const land = (wordId: string) => {
    landed.current = wordId;
    setOpen(false);
  };
  const choose = async (moodId: string) => {
    if (lemma !== undefined) return;
    const roulette = await composition.moodDraw.draw(moodId);
    // The Mix changed while the sheet was open: offer the moods as they are now.
    if (roulette === undefined) {
      setChips(chipsOf(await composition.moodDraw.moods()));
      return;
    }
    if (reduceMotion) {
      land(roulette.wordId);
      return;
    }
    const { shows, end } = rouletteTimes(roulette.lemmas.length);
    setLemma(roulette.lemmas[0]);
    timers.current = [
      ...roulette.lemmas.slice(1).map((next, index) =>
        setTimeout(
          () => {
            setLemma(next);
          },
          shows[index + 1],
        ),
      ),
      setTimeout(() => {
        land(roulette.wordId);
      }, end),
    ];
  };

  return (
    <>
      <MoodButton
        onPress={() => {
          void composition.moodDraw.moods().then((choices) => {
            setChips(chipsOf(choices));
            setOpen(true);
          });
        }}
      />
      <MoodSheet
        visible={open}
        moods={chips}
        roulette={lemma}
        onChoose={(moodId) => {
          void choose(moodId);
        }}
        onClose={() => {
          stopRoulette();
          setOpen(false);
        }}
        onDismissed={() => {
          setLemma(undefined);
          const wordId = landed.current;
          landed.current = undefined;
          if (wordId === undefined) return;
          const link = `/mood/${wordId}`;
          if (replaces) replaceOpenEntry(link);
          else openScreen(link);
        }}
      />
    </>
  );
}
