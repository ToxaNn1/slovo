import { fill, type EditionStrings } from '@slovo/contracts';
import type { GameModeOffer, OfferedBest } from '@slovo/core';
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
 * The Game Modes whose Rounds the app's screens play. A mode the Core offers
 * gets its card once its screen comes (spec #772), so no card opens a Round
 * the app can't show.
 */
const PLAYED_MODES: ReadonlySet<string> = new Set([
  'guess-word',
  'correction',
  'anglicism',
  'stress',
  'pairs',
  'anagram',
  'by-letters',
  'type-word',
  'idiom-meaning',
  'build-idiom',
  'survival',
]);

/** The offers of the modes the app plays, in the Core's order. */
export const playedOffers = (offers: readonly GameModeOffer[]): GameModeOffer[] =>
  offers.filter(({ modeId }) => PLAYED_MODES.has(modeId));

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
function bestText({ result, of }: OfferedBest, texts: GameStrings['modeBest']): string {
  const n = String(result);
  return of === undefined ? fill(texts.count, { n }) : fill(texts.outOf, { n, total: String(of) });
}

/**
 * The groups of the mode screen in their agreed order, each with its modes
 * in theirs: what a mode trains, then the modes with a Lives, Round or time
 * challenge of their own.
 */
const GAME_MODE_GROUPS: readonly {
  readonly group: keyof GameStrings['groups'];
  readonly modeIds: readonly string[];
}[] = [
  {
    group: 'words',
    modeIds: ['guess-word', 'stress', 'pairs', 'anagram', 'by-letters', 'type-word', 'origin'],
  },
  { group: 'corrections', modeIds: ['correction', 'anglicism'] },
  { group: 'idioms', modeIds: ['idiom-meaning', 'build-idiom'] },
  { group: 'challenge', modeIds: ['survival', 'timed'] },
];

/** A group of the mode screen: its title in the Edition's texts and its modes on offer. */
export interface GameModeGroup {
  readonly title: string;
  readonly offers: readonly GameModeOffer[];
}

/**
 * The modes on offer in the mode screen's groups, the groups and the modes in
 * their agreed order; a group with no mode on offer is left out. It throws
 * for a mode on offer in no group, so a new mode never loses its card unseen.
 */
export function gameModeGroups(
  offers: readonly GameModeOffer[],
  strings: GameStrings,
): GameModeGroup[] {
  const ungrouped = offers.find(
    ({ modeId }) => !GAME_MODE_GROUPS.some(({ modeIds }) => modeIds.includes(modeId)),
  );
  if (ungrouped !== undefined) {
    throw new Error(`The Game Mode «${ungrouped.modeId}» is in no group of the mode screen`);
  }
  return GAME_MODE_GROUPS.map(({ group, modeIds }) => ({
    title: strings.groups[group],
    offers: modeIds.flatMap((id) => offers.filter(({ modeId }) => modeId === id)),
  })).filter(({ offers: inGroup }) => inGroup.length > 0);
}
