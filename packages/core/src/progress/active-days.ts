import type { Analytics } from '../analytics/analytics';
import { createInTurn, createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, UserStateChanges } from '../ports';
import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import {
  ACTIVE_DAY_XP,
  BREAK_DAYS_AT_MOST,
  breakStateOn,
  deriveStreak,
  type BreakState,
  type DerivedStreak,
  type StreakState,
} from './streak';
import type { XpLog } from './xp-log';

const { activeDays: activeDayRecords, streakBrokenReported } = userStateRecords;

/** Lets an Analytics event go; a failure is lost, since Analytics never stands in the reader's way. */
const emit = (event: Promise<void>) => void event.catch(() => undefined);

/**
 * The change the day change makes of today, for a caller to make in one write
 * with its own, and the step that makes it in memory once they are written
 * (ADR 0013).
 */
export interface ActiveDayChange {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/**
 * The Active Days, the local dates `YYYY-MM-DD` with at least 5 XP from
 * learning actions in the XP log, and the days recorded before it, when
 * opening the app made one (ADR 0066), with the Streak derived from them.
 * With the XP log off, opening the app still records the day, as before 1.0.
 */
export interface ActiveDays {
  /** The Active Days as they stand, in memory for the session. */
  readonly days: ReadonlySet<string>;
  /** The Streak, the Best Streak and the freezes held, derived on today's local date. */
  readonly streak: StreakState;
  /** Whether the reader can start a Break today, derived on today's local date. */
  readonly streakBreak: BreakState;
  /**
   * Starts a Break of `days`, 1 to 7, from today, appends its record and
   * emits «Break started». Refused, with nothing written, unless the Break is
   * `available`. Resolves whether it started.
   */
  startBreak(days: number): Promise<boolean>;
  /**
   * Makes today's change, then makes it in memory: covers the missed days up
   * to yesterday with held freezes, and with the XP log off records today. The
   * subscribers hear of it even when the write fails, so Progress counts back
   * from yesterday until today is kept.
   */
  recordToday(): Promise<void>;
  /** Today's change for another write; none once there is nothing to write. */
  todayChange(): ActiveDayChange;
  /** Calls `listener` after each change of the days. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Opens the Active Days over the user state and the XP log, for the Core composition. */
export async function openActiveDays({
  edition,
  userState,
  clock,
  xpLog,
  analytics,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: UserState;
  clock: Clock;
  xpLog: Pick<XpLog, 'days' | 'freeze' | 'startBreak' | 'subscribe'>;
  analytics: Pick<Analytics, 'track'>;
}): Promise<ActiveDays> {
  const xpOn = edition.isFeatureEnabled('xpLog');
  const recorded = new Set((await userState.list(activeDayRecords)).keys());
  let reported = await userState.read(streakBrokenReported);
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  function daysOf(): ReadonlySet<string> {
    const days = new Set(recorded);
    for (const [date, xp] of xpLog.days.byDate) if (xp >= ACTIVE_DAY_XP) days.add(date);
    return days;
  }
  let days = daysOf();

  const derive = (): DerivedStreak =>
    deriveStreak({
      activeDays: days,
      frozen: xpLog.days.frozen,
      breaks: xpLog.days.breaks,
      today: todayKey(clock),
      freezes: xpOn && edition.isFeatureEnabled('streakFreezes'),
    });

  function tell(): void {
    days = daysOf();
    subscribers.tell();
  }
  xpLog.subscribe(tell);

  function todayChange(): ActiveDayChange {
    const today = todayKey(clock);
    const record = !xpOn && !recorded.has(today);
    const { toFreeze, broken, freezesHeld } = derive();
    const freeze = xpLog.freeze(toFreeze);
    const report = broken !== undefined && broken.lastDay !== reported ? broken : undefined;
    return {
      changes: new Map([
        ...(record ? activeDayRecords.record(today).change(true) : []),
        ...freeze.changes,
        ...(report === undefined ? [] : streakBrokenReported.change(report.lastDay)),
      ]),
      commit() {
        if (record) recorded.add(today);
        freeze.commit();
        toFreeze.forEach(() => {
          emit(analytics.track('freezeUsed', { freezesHeld }));
        });
        if (report !== undefined) {
          reported = report.lastDay;
          emit(analytics.track('streakBroken', { streak: report.streak }));
        }
        tell();
      },
    };
  }

  async function recordToday(): Promise<void> {
    const change = todayChange();
    try {
      if (change.changes.size > 0) await userState.write(change.changes);
    } catch (error) {
      subscribers.tell();
      throw error;
    }
    change.commit();
  }

  const breakOn = xpOn && edition.isFeatureEnabled('streakBreak');
  const streakBreak = (): BreakState =>
    breakOn ? breakStateOn(todayKey(clock), xpLog.days.breaks) : { kind: 'off' };

  async function startBreak(days: number): Promise<boolean> {
    const allowed = Number.isInteger(days) && days >= 1 && days <= BREAK_DAYS_AT_MOST;
    if (!allowed || streakBreak().kind !== 'available') return false;
    const append = xpLog.startBreak(days);
    await userState.write(append.changes);
    append.commit();
    emit(analytics.track('breakStarted', { days }));
    return true;
  }

  return {
    get days() {
      return days;
    },
    get streak() {
      const { streak, bestStreak, freezesHeld } = derive();
      return { streak, bestStreak, freezesHeld };
    },
    get streakBreak() {
      return streakBreak();
    },
    startBreak: (days) => inTurn(() => startBreak(days)),
    recordToday: () => inTurn(recordToday),
    todayChange,
    subscribe: subscribers.subscribe,
  };
}
