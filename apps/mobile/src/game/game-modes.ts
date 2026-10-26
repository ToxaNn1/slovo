import type { EditionStrings } from '@slovo/contracts';
import type { GameModeOffer } from '@slovo/core';
import type { GameModeCard } from '@slovo/ui';
import type { ComponentProps } from 'react';

/** The Edition's texts of every Game Mode, by mode id. */
type GameModesStrings = EditionStrings['game']['modes'];

/** The Edition's texts of one Game Mode. */
type GameModeStrings = GameModesStrings[string];

/** What a Game Mode's card draws: its Entry kind from the offer, its texts from the Edition. */
export type GameModeCardContent = Omit<ComponentProps<typeof GameModeCard>, 'onPress' | 'testID'>;

/**
 * The Edition's texts of the Game Mode. It throws for a mode the Edition has
 * no texts for, so a mode registered without them never loses its card unseen.
 */
export function gameModeStrings(modes: GameModesStrings, modeId: string): GameModeStrings {
  const strings = modes[modeId];
  if (strings === undefined) {
    throw new Error(`The Edition has no strings for the Game Mode «${modeId}»`);
  }
  return strings;
}

/**
 * The Game Modes whose Rounds the app's screens play. A mode the Core offers
 * gets its card once its screen comes (spec #772), so no card opens a Round
 * the app can't show.
 */
const PLAYED_MODES: ReadonlySet<string> = new Set(['guess-word', 'correction']);

/** The offers of the modes the app plays, in the Core's order. */
export const playedOffers = (offers: readonly GameModeOffer[]): GameModeOffer[] =>
  offers.filter(({ modeId }) => PLAYED_MODES.has(modeId));

/**
 * The card of a Game Mode on offer, in the Edition's texts; a mode still
 * planned can't start yet and says no reason. It throws for a mode without
 * texts, or without a text for the reason it can't start.
 */
export function gameModeCard(offer: GameModeOffer, modes: GameModesStrings): GameModeCardContent {
  const { overline, title, description, sample, refusals } = gameModeStrings(modes, offer.modeId);
  const reason = 'refusal' in offer ? offer.refusal : undefined;
  const refusal = reason === undefined ? undefined : refusals[reason];
  if (reason !== undefined && refusal === undefined) {
    throw new Error(
      `The Edition has no text for why the Game Mode «${offer.modeId}» can't start: «${reason}»`,
    );
  }
  const { canStart, entryKind } = offer;
  return { entryKind, overline, title, description, sample, canStart, refusal };
}
