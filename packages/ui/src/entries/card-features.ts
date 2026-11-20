import { createContext, useContext } from 'react';

/**
 * The features an Entry card is drawn with, which the screen sets once for
 * every card under it from what is shown in effect. Each is off unless the
 * screen turns it on.
 */
export interface CardFeatures {
  /**
   * Self-check applies to the card: until the reader reveals it, a Word card
   * shows only its Lemma, part of speech and Category, a Correction card only
   * its non-standard form, an Idiom card only its expression and its chip, a
   * Synonym Row card only its dominant and its chip, a Tip card only its
   * title, its chip and its non-standard form, and the Knowledge Mark buttons
   * in the card's actions are inactive. The reveal resets once the card leaves
   * the screen. The Entry screen's details have no Self-check.
   */
  readonly selfCheck: boolean;
  /** The falling Stress of a Word card, while the Edition's `stressAnimation` is on in effect. */
  readonly stressFalls: boolean;
  /**
   * The Edition's calligraphic font family, which the Lemma on the card of
   * the Word of the Day is set in while the Edition's `calligraphy` is on in
   * effect. Any other card keeps the Word font.
   */
  readonly wordOfTheDayFont: string | undefined;
  /**
   * The tabbed card's last tab «Джерело» names the Entry's sources, which
   * leave its other tabs, while the Edition's `sourceTab` is on in effect.
   */
  readonly sourceTab: boolean;
  /** A tabbed Tip card with exceptions gets the tab «Винятки», while the Edition's `tipExceptions` is on in effect. */
  readonly tipExceptions: boolean;
}

/** An Entry card with none of its features: a bare card. */
export const noCardFeatures: CardFeatures = {
  selfCheck: false,
  stressFalls: false,
  wordOfTheDayFont: undefined,
  sourceTab: false,
  tipExceptions: false,
};

const CardFeaturesContext = createContext<CardFeatures>(noCardFeatures);

/** Sets the features of every Entry card under it. */
export const CardFeaturesProvider = CardFeaturesContext.Provider;

/** The features of the Entry card this is in; none outside a `CardFeaturesProvider`. */
export function useCardFeatures(): CardFeatures {
  return useContext(CardFeaturesContext);
}
