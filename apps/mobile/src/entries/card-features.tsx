import { CardFeaturesProvider, type CardFeatures } from '@slovo/ui';
import type { ReactNode } from 'react';

import { useEditionInEffect } from '@/edition/remote-switches';
import { wordOfTheDayFontFamily } from '@/edition/reported-edition';
import { useShown } from '@/shown-in-effect';

/**
 * Where Entry cards are drawn: the Feed, a Category's or a Curated
 * Collection's Feed, or the Entry screen.
 */
export type CardPlace = 'feed' | 'listFeed' | 'entry';

/**
 * The features of every Entry card under it, set once by the screen from what
 * is shown in effect: Self-check in both Feeds, never on the Entry screen; the
 * Word of the Day's calligraphic Lemma in the Feed alone; the falling Stress,
 * the «Джерело» tab and the «Винятки» tab wherever their Feature Switches are on.
 */
export function ShownCardFeatures({ place, children }: { place: CardPlace; children: ReactNode }) {
  return <CardFeaturesProvider value={useCardFeatures(place)}>{children}</CardFeaturesProvider>;
}

function useCardFeatures(place: CardPlace): CardFeatures {
  const edition = useEditionInEffect();
  const { selfCheck } = useShown();
  return {
    selfCheck: place !== 'entry' && selfCheck,
    stressFalls: edition.isFeatureEnabled('stressAnimation'),
    wordOfTheDayFont:
      place === 'feed' && edition.isFeatureEnabled('calligraphy')
        ? wordOfTheDayFontFamily
        : undefined,
    sourceTab: edition.isFeatureEnabled('sourceTab'),
    tipExceptions: edition.isFeatureEnabled('tipExceptions'),
  };
}
