import type { Edition } from '../edition/edition';
import { createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock } from '../ports';
import type { ActiveDays } from '../progress/active-days';
import type { Badges } from '../progress/badges';
import { totalFor } from '../progress/levels';
import { STREAK_MILESTONES } from '../progress/streak';
import type { XpLog } from '../progress/xp-log';
import type { ShareCardSubject } from './share-card';

/** A progress Share Card's subject: a Level reached, a Badge earned or a Streak milestone. */
export type ProgressShareCard = Extract<
  ShareCardSubject,
  { readonly level: unknown } | { readonly badge: unknown } | { readonly streak: unknown }
>;

/**
 * The progress Share Cards on offer today (ticket #1384): the Level reached
 * today, each Badge earned today and the Streak when today, an Active Day,
 * makes it a milestone, in this order. Each comes on its own local day only.
 * None while the Edition's `progressShareCards` or `xpLog` switch is off.
 */
export interface ProgressShareCards {
  /** The cards on offer, one value until one of them changes. */
  readonly state: readonly ProgressShareCard[];
  /** Calls `listener` after each change of the cards. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** A card's key: what it shows and its day, so two states with the same cards are one. */
function keyOf(card: ProgressShareCard): string {
  if ('level' in card) return `level:${String(card.level.level)}:${card.date}`;
  if ('badge' in card) return `badge:${card.badge.id}:${card.badge.date}`;
  return `streak:${String(card.streak)}:${card.date}`;
}

/** Opens the progress Share Cards over the XP log, the Badges and the Active Days, for the Core composition. */
export function openProgressShareCards({
  edition,
  clock,
  xpLog,
  badges,
  activeDays,
}: {
  edition: Pick<Edition, 'levels' | 'isFeatureEnabled'>;
  clock: Clock;
  xpLog: Pick<XpLog, 'state' | 'reachedOn' | 'subscribe'>;
  badges: Pick<Badges, 'state' | 'subscribe'>;
  activeDays: Pick<ActiveDays, 'days' | 'streak' | 'subscribe'>;
}): ProgressShareCards {
  const subscribers = createSubscribers();

  function stateOf(): readonly ProgressShareCard[] {
    if (!edition.isFeatureEnabled('progressShareCards') || !edition.isFeatureEnabled('xpLog'))
      return [];
    const date = todayKey(clock);
    const { level } = xpLog.state;
    const { streak } = activeDays.streak;
    return [
      ...(level !== undefined &&
      level.level > 0 &&
      xpLog.reachedOn(totalFor(edition.levels, level.level)) === date
        ? [{ level, date }]
        : []),
      ...badges.state.flatMap((badge) => (badge.earned && badge.date === date ? [{ badge }] : [])),
      ...(activeDays.days.has(date) && STREAK_MILESTONES.has(streak) ? [{ streak, date }] : []),
    ];
  }

  const keys = (cards: readonly ProgressShareCard[]) => cards.map(keyOf).join('\n');
  let state = stateOf();

  function follow(): void {
    const next = stateOf();
    if (keys(next) === keys(state)) return;
    state = next;
    subscribers.tell();
  }

  for (const source of [xpLog, badges, activeDays]) source.subscribe(follow);

  return {
    get state() {
      return state;
    },
    subscribe: subscribers.subscribe,
  };
}
