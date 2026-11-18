import type { Badge, BadgeCondition } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Knowledge } from '../knowledge/knowledge';
import { dayNumber, parseLocalDate } from '../local-date';
import type { UserState } from '../user-state/user-state';
import type { ActiveDays } from './active-days';
import type { XpLog, XpLogMilestones } from './xp-log';

/** How far a Badge's condition has come at its best: `current` of `target`, `current` never above it. */
export interface BadgeProgress {
  readonly current: number;
  readonly target: number;
}

/**
 * One Badge as the badges screen shows it, with its Badge family: earned on its
 * local date, new («НОВА») until the reader opens it (ADR 0085), or not yet,
 * with its progress.
 */
export type BadgeState = Pick<Badge, 'id' | 'name' | 'symbol' | 'family' | 'condition'> &
  (
    | { readonly earned: true; readonly date: string; readonly isNew: boolean }
    | { readonly earned: false; readonly progress: BadgeProgress }
  );

/**
 * The Badges (ADR 0066): the Edition's choice from the Core's catalogue of
 * conditions, evaluated against the XP log, the confirmed Entries and the
 * Streak after each change of them. A Badge whose condition is met is earned
 * with a record in the XP log, which keeps its date, syncs through the
 * Account, is never removed and gives no XP. Nothing with the `badges` or the
 * `xpLog` Feature Switch off; the Level Badges only with `levels` on.
 */
export interface Badges {
  /** The Badges in the Edition's order, earned or with their progress. */
  readonly state: readonly BadgeState[];
  /**
   * Marks an earned Badge opened, its sheet or its stamp seen, with a record
   * in the XP log that ends its «НОВА» mark on every device (ADR 0085).
   * Nothing for a Badge not earned or already opened.
   */
  open(badge: string): Promise<void>;
  /** Calls `listener` after each change of the Badges. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Calls `listener` with each Badge a learning action earns, once its record
   * is written: the celebration's trigger. A Badge earned as the Badges open,
   * as after a sync, is in `state` from the start and told to no one. Returns
   * the call that stops it.
   */
  onEarned(listener: (badge: BadgeState) => void): () => void;
}

/** What a condition reaches at its best, out of `target`. */
interface Reach {
  readonly best: number;
  readonly target: number;
}

/** The longest run of days in a row of the local dates. */
function longestRunOf(dates: ReadonlySet<string>): number {
  const numbers = [...dates].map((date) => dayNumber(parseLocalDate(date))).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let last = Number.NaN;
  for (const day of numbers) {
    run = day === last + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = day;
  }
  return longest;
}

/**
 * The longest run of right answers in a row in the modes: a wrong answer in
 * the modes breaks a run, an answer in another mode neither adds to it nor
 * breaks it.
 */
function bestRunOf(answers: XpLogMilestones['answers'], modes: readonly string[]): number {
  let current = 0;
  let best = 0;
  for (const { mode, right } of answers) {
    if (!modes.includes(mode)) continue;
    current = right ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** Opens the Badges over the XP log, the Knowledge Marks and the Active Days, for the Core composition. */
export async function openBadges({
  edition,
  userState,
  xpLog,
  knowledge,
  activeDays,
  analytics,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'badges'>;
  userState: Pick<UserState, 'write'>;
  xpLog: Pick<XpLog, 'state' | 'milestones' | 'earn' | 'open' | 'subscribe' | 'resetMarker'>;
  knowledge: Pick<Knowledge, 'state' | 'confirmedAfter' | 'subscribe'>;
  activeDays: Pick<ActiveDays, 'streak' | 'subscribe'>;
  analytics: Pick<Analytics, 'track'>;
}): Promise<Badges> {
  const on = edition.isFeatureEnabled('badges');
  // A Daily Crossword Badge goes with the Daily Crossword, earned or not (ADR 0176).
  const crosswordOn = edition.isFeatureEnabled('dailyCrossword');
  const subscribers = createSubscribers();
  const earnedSubscribers = createSubscribers<BadgeState>();
  const inTurn = createInTurn();

  /** What the condition reaches; nothing for a Level Badge with Levels off. */
  function reachOf(condition: BadgeCondition, milestones: XpLogMilestones): Reach | undefined {
    const once = (met: boolean): Reach => ({ best: met ? 1 : 0, target: 1 });
    switch (condition.kind) {
      case 'streak': {
        return { best: activeDays.streak.bestStreak, target: condition.days };
      }
      case 'confirmedEntries': {
        // After a Progress reset only the Entries confirmed since count (ADR 0133).
        const marker = xpLog.resetMarker;
        const total =
          marker === undefined
            ? knowledge.state.confirmed.total
            : knowledge.confirmedAfter(marker.at);
        return { best: total, target: condition.entries };
      }
      case 'gameWin':
        return once(condition.modes.some((mode) => milestones.wins.has(mode)));
      case 'dailyCrosswordRun':
        return { best: longestRunOf(milestones.crosswords), target: condition.days };
      case 'rightAnswers': {
        const right = condition.modes.reduce(
          (sum, mode) => sum + (milestones.rightByMode.get(mode) ?? 0),
          0,
        );
        return { best: right, target: condition.count };
      }
      case 'rightOnRarity':
        return once(milestones.rightRarities.has(condition.rarity));
      case 'level': {
        const level = xpLog.state.level?.level;
        return level === undefined ? undefined : { best: level, target: condition.level };
      }
      case 'flawlessGame':
        return once(condition.modes.some((mode) => milestones.flawless.has(mode)));
      case 'rightRun':
        return { best: bestRunOf(milestones.answers, condition.modes), target: condition.count };
    }
  }

  function derive(): { state: readonly BadgeState[]; due: readonly string[] } {
    if (!on) return { state: [], due: [] };
    const { milestones } = xpLog;
    const state: BadgeState[] = [];
    const due: string[] = [];
    for (const { id, name, symbol, family, condition } of edition.badges) {
      if (condition.kind === 'dailyCrosswordRun' && !crosswordOn) continue;
      const date = milestones.badges.get(id);
      if (date !== undefined) {
        const isNew = !milestones.opened.has(id);
        state.push({ id, name, symbol, family, condition, earned: true, date, isNew });
        continue;
      }
      const reach = reachOf(condition, milestones);
      if (reach === undefined) continue;
      if (reach.best >= reach.target) due.push(id);
      // The progress is the best reach, the one that earns the Badge (ADR 0188).
      const progress = { current: Math.min(reach.best, reach.target), target: reach.target };
      state.push({ id, name, symbol, family, condition, earned: false, progress });
    }
    return { state, due };
  }

  let state = derive().state;

  /** Earns every Badge whose condition is met, in one write, then tells the subscribers and each Badge earned. */
  async function check(): Promise<void> {
    const { due } = derive();
    if (due.length > 0) {
      const append = xpLog.earn(due);
      await userState.write(append.changes);
      append.commit();
      for (const badge of due)
        void analytics.track('badgeEarned', { badge }).catch(() => undefined);
    }
    state = derive().state;
    subscribers.tell();
    for (const badge of state)
      if (badge.earned && due.includes(badge.id)) earnedSubscribers.tell(badge);
  }

  const checkInTurn = () => {
    inTurn(check).catch(() => undefined);
  };
  if (on) {
    xpLog.subscribe(checkInTurn);
    knowledge.subscribe(checkInTurn);
    activeDays.subscribe(checkInTurn);
    await inTurn(check).catch(() => undefined);
  }

  /** Writes the Badge-opened record of an earned, new Badge; the XP log's change re-derives the state. */
  async function open(badge: string): Promise<void> {
    const shown = state.find(({ id }) => id === badge);
    if (shown === undefined || !shown.earned || !shown.isNew) return;
    const append = xpLog.open(badge);
    await userState.write(append.changes);
    append.commit();
    state = derive().state;
  }

  return {
    get state() {
      return state;
    },
    open: (badge) => inTurn(() => open(badge)),
    subscribe: subscribers.subscribe,
    onEarned: earnedSubscribers.subscribe,
  };
}
