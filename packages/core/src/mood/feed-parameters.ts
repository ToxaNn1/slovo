import type { MixKindWeight, Mood, MoodShift, Rarity, RarityBand } from '@slovo/contracts';

import type { MixKindWeights } from '../entries/mix';

/**
 * Whether a Word of the rarity is in the Mood's rarity band (ADR 0076):
 * `upper` is the Rarity Ceiling's rarity and the one below it, `lower`
 * rarities 1 and 2, `whole` every rarity. The bands clip to the Ceiling, so
 * under «до 2» `lower` is `whole`; a Word above the Ceiling never reaches the
 * Feed, as the Cycle covers none.
 */
export function inRarityBand(rarity: Rarity, band: RarityBand, ceiling: Rarity): boolean {
  switch (band) {
    case 'upper':
      return rarity >= ceiling - 1;
    case 'lower':
      return rarity <= 2;
    case 'whole':
      return true;
  }
}

/** The Mix kind weight a shift takes a weight to: one step, clamped to «Менше»…«Більше». */
const SHIFTED: Readonly<Record<MoodShift, Readonly<Record<MixKindWeight, MixKindWeight>>>> = {
  less: { less: 'less', normal: 'less', more: 'normal' },
  same: { less: 'less', normal: 'normal', more: 'more' },
  more: { less: 'normal', normal: 'more', more: 'more' },
};

/**
 * The reader's Mix kind weights shifted by the Mood (ADR 0076); the weights
 * as they are without a Mood. A kind turned off in the Mix has no Entries in
 * the Cycle, so its weight turns nothing on.
 */
export function shiftedKindWeights(
  weights: MixKindWeights,
  mood: Mood | undefined,
): MixKindWeights {
  if (mood === undefined) return weights;
  const shifted = (kind: keyof MixKindWeights) =>
    SHIFTED[mood.shifts[kind] ?? 'same'][weights[kind]];
  return {
    correction: shifted('correction'),
    idiom: shifted('idiom'),
    synonymRow: shifted('synonymRow'),
    tip: shifted('tip'),
  };
}
