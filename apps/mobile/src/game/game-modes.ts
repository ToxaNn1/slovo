import { fill, type EditionStrings } from '@slovo/contracts';
import {
  GAME_HUB_GROUPS,
  GAME_MODE_GROUPS,
  type GameModeOffer,
  type OfferedBest,
  type OfferedGroup,
} from '@slovo/core';
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

/** How the card follows board 06 «Хаб ігор», each behind its own Feature Switch. */
export interface GameModeCardLook {
  /** `gameHubRecord`: the hub line and the record («Рекорд: 12 з 15», «Ще жодної гри»). */
  readonly record?: boolean;
  /** `gameModeToast`: a mode that can't start keeps its look; its tap shows a toast. */
  readonly toast?: boolean;
}

/**
 * The card of a Game Mode on offer, in the Edition's texts: its one line and
 * its mark, the Best result («★ 12») once it has one or «—» before, which
 * VoiceOver reads in words («Найкраще: 12 з 15»); a mode still planned can't start yet and says no
 * reason. With the record, the line is the mode's hub line and the mark the
 * record, read as it stands. With the toast, a mode that can't start looks
 * like one that can. It throws for a mode without texts, or without a text for the
 * reason it can't start.
 */
export function gameModeCard(
  offer: GameModeOffer,
  strings: GameStrings,
  { record = false, toast = false }: GameModeCardLook = {},
): GameModeCardContent {
  const { glyph, title, oneLiner, hubLine, refusals } = gameModeStrings(
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
  const { best } = offer;
  const look = toast
    ? { canStart: true, refusal: undefined }
    : { canStart: offer.canStart, refusal };
  if (record) {
    const mark = recordText(best, strings.hubRow);
    return { glyph, title, line: hubLine ?? oneLiner, ...look, best: mark, bestLabel: mark };
  }
  return {
    glyph,
    title,
    line: oneLiner,
    ...look,
    best:
      best === undefined
        ? strings.hubRow.none
        : fill(strings.hubRow.best, { n: String(best.result) }),
    bestLabel: best === undefined ? undefined : bestText(best, strings.modeBest),
  };
}

/** A mode's record on the hub: out of its Round limit («Рекорд: 12 з 15»), bare without one («Рекорд: 23»), or «Ще жодної гри». */
function recordText(best: OfferedBest | undefined, texts: GameStrings['hubRow']): string {
  if (best === undefined) return texts.never;
  const n = String(best.result);
  return best.of === undefined
    ? fill(texts.recordCount, { n })
    : fill(texts.record, { n, total: String(best.of) });
}

/** The mode a toast sends the reader to while it can start. */
const TOAST_MODE = 'stress';
/** The mode the toast sends the reader to while «Наголос» itself cannot start. */
const FALLBACK_TOAST_MODE = 'pairs';

/**
 * The toast on a tap of a mode that can't start, such as «Пари» ще
 * розминається. Влучай поки в «Наголос»!: it names «Наголос» while it can
 * start; else, in its own words («Спробуй поки „Пари“!»), «Пари» while it can,
 * else the first mode on offer that can (still «Пари» when none can).
 */
export function gameModeToast(
  offer: GameModeOffer,
  offers: readonly GameModeOffer[],
  strings: GameStrings,
): string {
  const startable = offers.filter(({ canStart }) => canStart);
  const titleOf = (modeId: string) => gameModeStrings(strings.modes, modeId).title;
  const mode = titleOf(offer.modeId);
  if (startable.some(({ modeId }) => modeId === TOAST_MODE)) {
    return fill(strings.hubToast, { mode, other: titleOf(TOAST_MODE) });
  }
  const other =
    startable.find(({ modeId }) => modeId === FALLBACK_TOAST_MODE)?.modeId ??
    startable[0]?.modeId ??
    FALLBACK_TOAST_MODE;
  return fill(strings.hubToastFallback, { mode, other: titleOf(other) });
}

/** A mode's Best result: out of its Round limit («Найкраще: 12 з 15»), or bare without one («Найкраще: 23»). */
export function bestText({ result, of }: OfferedBest, texts: GameStrings['modeBest']): string {
  const n = String(result);
  return of === undefined ? fill(texts.count, { n }) : fill(texts.outOf, { n, total: String(of) });
}

/** Every group an offer can name, in the order the mode screen shows them. */
const MODE_SCREEN_GROUPS: readonly OfferedGroup[] = [...GAME_HUB_GROUPS, ...GAME_MODE_GROUPS];

/** A group of the mode screen: its title in the Edition's texts and its modes on offer. */
export interface GameModeGroup {
  readonly title: string;
  readonly offers: readonly GameModeOffer[];
}

/**
 * The modes on offer in the mode screen's groups, each under the group its
 * offer names, the board's five first and then the four of spec #1674, each
 * in their agreed order, and the modes in the order they register; a group
 * with no mode on offer is left out.
 */
export function gameModeGroups(
  offers: readonly GameModeOffer[],
  strings: GameStrings,
): GameModeGroup[] {
  return MODE_SCREEN_GROUPS.map((group) => ({
    title: strings.groups[group],
    offers: offers.filter((offer) => offer.group === group),
  })).filter(({ offers: inGroup }) => inGroup.length > 0);
}
