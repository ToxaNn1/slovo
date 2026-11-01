import { fill, type EditionStrings } from '@slovo/contracts';
import { GAME_MODE_GROUPS, type GameModeOffer, type OfferedBest } from '@slovo/core';
import type { GameModeCard } from '@slovo/ui';
import type { ComponentProps } from 'react';

/** The Edition's texts of the Game. */
type GameStrings = EditionStrings['game'];

/** The Edition's texts of every Game Mode, by mode id. */
type GameModesStrings = GameStrings['modes'];

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
 * The card of a Game Mode on offer, in the Edition's texts, with its Best
 * result once it has one; a mode still planned can't start yet and says no
 * reason. It throws for a mode without texts, or without a text for the
 * reason it can't start.
 */
export function gameModeCard(offer: GameModeOffer, strings: GameStrings): GameModeCardContent {
  const { overline, title, description, sample, refusals } = gameModeStrings(
    strings.modes,
    offer.modeId,
  );
  const reason = 'refusal' in offer ? offer.refusal : undefined;
  const refusal = reason === undefined ? undefined : refusals[reason];
  if (reason !== undefined && refusal === undefined) {
    throw new Error(
      `The Edition has no text for why the Game Mode «${offer.modeId}» can't start: «${reason}»`,
    );
  }
  const { canStart, entryKind, best } = offer;
  return {
    entryKind,
    overline,
    title,
    description,
    sample,
    canStart,
    refusal,
    best: best === undefined ? undefined : bestText(best, strings.modeBest),
  };
}

/** A mode's Best result: out of its Round limit («Найкраще: 12 з 15»), or bare without one («Найкраще: 23»). */
export function bestText({ result, of }: OfferedBest, texts: GameStrings['modeBest']): string {
  const n = String(result);
  return of === undefined ? fill(texts.count, { n }) : fill(texts.outOf, { n, total: String(of) });
}

/** A group of the mode screen: its title in the Edition's texts and its modes on offer. */
export interface GameModeGroup {
  readonly title: string;
  readonly offers: readonly GameModeOffer[];
}

/**
 * The modes on offer in the mode screen's groups, each under the group its
 * mode declares, the groups in their agreed order and the modes in the order
 * they register; a group with no mode on offer is left out.
 */
export function gameModeGroups(
  offers: readonly GameModeOffer[],
  strings: GameStrings,
): GameModeGroup[] {
  return GAME_MODE_GROUPS.map((group) => ({
    title: strings.groups[group],
    offers: offers.filter((offer) => offer.group === group),
  })).filter(({ offers: inGroup }) => inGroup.length > 0);
}
