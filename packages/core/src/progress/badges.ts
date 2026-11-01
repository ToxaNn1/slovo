import type { Badge, BadgeCondition } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import { createInTurn, createSubscribers } from '../in-turn';
import type { Knowledge } from '../knowledge/knowledge';
import { dayNumber, parseLocalDate, todayKey } from '../local-date';
import type { Clock } from '../ports';
import type { UserState } from '../user-state/user-state';
import type { ActiveDays } from './active-days';
import type { XpLog, XpLogMilestones } from './xp-log';

/** How far a Badge's condition has come: `current` of `target`, `current` never above it. */
export interface BadgeProgress {
  readonly current: number;
  readonly target: number;
}

/** One Badge as the badges screen shows it: earned on its local date, or not yet, with its progress. */
export type BadgeState = Pick<Badge, 'id' | 'name' | 'condition'> &
  (
    | { readonly earned: true; readonly date: string }
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
  /** Calls `listener` after each change of the Badges. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** What a condition reaches now (`current`) and at its best (`best`), out of `target`. */
interface Reach {
  readonly current: number;
  readonly best: number;
  readonly target: number;
}

/** The days in a row ending today or yesterday, and the longest run, of the local dates. */
function runsOf(dates: ReadonlySet<string>, today: string): { current: number; longest: number } {
  const numbers = [...dates].map((date) => dayNumber(parseLocalDate(date))).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let last = Number.NaN;
  for (const day of numbers) {
    run = day === last + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = day;
  }
  const todayNumber = dayNumber(parseLocalDate(today));
  return { current: last >= todayNumber - 1 ? run : 0, longest };
}

/** Opens the Badges over the XP log, the Knowledge Marks and the Active Days, for the Core composition. */
export async function openBadges({
  edition,
  userState,
  clock,
  xpLog,
  knowledge,
  activeDays,
  analytics,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'badges'>;
  userState: Pick<UserState, 'write'>;
  clock: Clock;
  xpLog: Pick<XpLog, 'state' | 'milestones' | 'earn' | 'subscribe'>;
  knowledge: Pick<Knowledge, 'state' | 'subscribe'>;
  activeDays: Pick<ActiveDays, 'streak' | 'subscribe'>;
  analytics: Pick<Analytics, 'track'>;
}): Promise<Badges> {
  const on = edition.isFeatureEnabled('xpLog') && edition.isFeatureEnabled('badges');
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  /** What the condition reaches; nothing for a Level Badge with Levels off. */
  function reachOf(condition: BadgeCondition, milestones: XpLogMilestones): Reach | undefined {
    const once = (met: boolean): Reach => ({ current: met ? 1 : 0, best: met ? 1 : 0, target: 1 });
    switch (condition.kind) {
      case 'streak': {
        const { streak, bestStreak } = activeDays.streak;
        return { current: streak, best: bestStreak, target: condition.days };
      }
      case 'confirmedEntries': {
        const { total } = knowledge.state.confirmed;
        return { current: total, best: total, target: condition.entries };
      }
      case 'gameWin':
        return once(condition.modes.some((mode) => milestones.wins.has(mode)));
      case 'dailyCrosswordRun': {
        const { current, longest } = runsOf(milestones.crosswords, todayKey(clock));
        return { current, best: longest, target: condition.days };
      }
      case 'rightAnswers': {
        const right = condition.modes.reduce(
          (sum, mode) => sum + (milestones.rightByMode.get(mode) ?? 0),
          0,
        );
        return { current: right, best: right, target: condition.count };
      }
      case 'rightOnRarity':
        return once(milestones.rightRarities.has(condition.rarity));
      case 'level': {
        const level = xpLog.state.level?.level;
        return level === undefined
          ? undefined
          : { current: level, best: level, target: condition.level };
      }
    }
  }

  function derive(): { state: readonly BadgeState[]; due: readonly string[] } {
    if (!on) return { state: [], due: [] };
    const { milestones } = xpLog;
    const state: BadgeState[] = [];
    const due: string[] = [];
    for (const { id, name, condition } of edition.badges) {
      const date = milestones.badges.get(id);
      if (date !== undefined) {
        state.push({ id, name, condition, earned: true, date });
        continue;
      }
      const reach = reachOf(condition, milestones);
      if (reach === undefined) continue;
      if (reach.best >= reach.target) due.push(id);
      const progress = { current: Math.min(reach.current, reach.target), target: reach.target };
      state.push({ id, name, condition, earned: false, progress });
    }
    return { state, due };
  }

  let state = derive().state;

  /** Earns every Badge whose condition is met, in one write, then tells the subscribers. */
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

  return {
    get state() {
      return state;
    },
    subscribe: subscribers.subscribe,
  };
}
