import type { DailyGoal, XpTable } from '@slovo/contracts';

import { createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, Random, UserStateChanges } from '../ports';
import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { XpAction, XpAward } from '../game/game-xp';
import type { LocalDate } from '../local-date';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords, type XpRecord } from '../user-state/user-state-schema';
import { levelOf, type LevelState } from './levels';

const { xpLog: xpRecords } = userStateRecords;

/** The Daily Goal of a local day and whether the day met it (ADR 0066). */
export interface DailyGoalState {
  readonly goal: DailyGoal;
  /** Whether the day's XP reached the goal in force at some moment of the day: a day met stays met. */
  readonly met: boolean;
}

/** One local day as the XP log derives it. */
export interface XpDay {
  /** The XP earned on the day. */
  readonly xp: number;
  /** The day's Daily Goal; `null` while the Daily Goal is off. */
  readonly dailyGoal: DailyGoalState | null;
}

/** What the XP log hands over: the XP derived from its records, never stored. */
export interface XpLogState {
  /** All XP ever earned in this Edition. */
  readonly total: number;
  /** The XP earned today, in the clock's time zone. */
  readonly today: number;
  /** The Level the total reaches, while the Edition's `levels` Feature Switch is on (ADR 0066). */
  readonly level: LevelState | undefined;
  /** Today's Daily Goal and whether it is met; `null` while the Daily Goal is off. */
  readonly dailyGoal: DailyGoalState | null;
}

/** What the XP log holds by local date `YYYY-MM-DD`, for the Active Days and the Streak. */
export interface XpLogDays {
  /** The XP earned on each local date that has any. */
  readonly byDate: ReadonlyMap<string, number>;
  /** The missed local dates a consumed Streak freeze covers. */
  readonly frozen: ReadonlySet<string>;
  /** The Breaks started: the length in days by the local date each starts on. */
  readonly breaks: ReadonlyMap<string, number>;
}

/** What the XP log holds for the Badges (ADR 0066), derived from its records. */
export interface XpLogMilestones {
  /** The Game Modes with a win: a finished Game with at least half the answers right, which earned XP. */
  readonly wins: ReadonlySet<string>;
  /** The right Game answers that earned XP, by Game Mode. */
  readonly rightByMode: ReadonlyMap<string, number>;
  /** The rarities of the Words with a right Game answer that earned XP. */
  readonly rightRarities: ReadonlySet<number>;
  /** The local dates of the Daily Crosswords solved. */
  readonly crosswords: ReadonlySet<string>;
  /** The Badges earned: the local date each was earned on, by Badge id. */
  readonly badges: ReadonlyMap<string, string>;
}

/** Records to append for another write, and the step that makes them in memory once written. */
export interface XpLogAppend {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/**
 * The XP log (ADR 0066): an append-only log of the XP each learning action
 * earned and of the Daily Goals set, kept per Edition, which the total,
 * today's XP and each day's goal state are derived from.
 * The amounts and the Review cap come from the Edition's XP table; the log
 * syncs as a union by record id, so two devices agree and no record doubles.
 * The Daily Crossword of a date earns once, and Review answers count up to
 * the cap a day, however many devices' records merge.
 */
export interface XpLog {
  /** The XP as it stands, in memory for the session. */
  readonly state: XpLogState;
  /** The XP and the freezes by local date, in memory for the session. */
  readonly days: XpLogDays;
  /** The record the action appends, for another write; empty when it earns nothing. */
  award(action: XpAction): XpAward;
  /**
   * The freeze-consumed records that cover the missed local dates, for another
   * write. A date has one such record by its id, so two devices that cover the
   * same day merge into one.
   */
  freeze(dates: readonly string[]): XpLogAppend;
  /**
   * The Break-started record of a Break of `days` from today, for another
   * write. A date has one such record by its id, so two devices that start a
   * Break on the same day merge into one.
   */
  startBreak(days: number): XpLogAppend;
  /** What the Badges are evaluated against, in memory for the session. */
  readonly milestones: XpLogMilestones;
  /**
   * The Badge-earned records of the Badges, for another write. A Badge has one
   * such record by its id, so two devices that earn it merge into one, and an
   * earned Badge is never earned again or removed.
   */
  earn(badges: readonly string[]): XpLogAppend;
  /** The local date (`YYYY-MM-DD`) the total XP first reached `total`, if it has. */
  reachedOn(total: number): string | undefined;
  /** Calls `listener` after each change of the XP. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** The XP and the Daily Goal of a local date `YYYY-MM-DD`: a past day keeps the goal it had. */
  dayOf(date: string): XpDay;
  /**
   * Sets the Daily Goal from today on: today's goal changes, a day already
   * met stays met, and the earlier days keep theirs. Nothing while the Daily
   * Goal is off.
   */
  setDailyGoal(goal: DailyGoal): Promise<void>;
  /**
   * Calls `listener` once when today's Daily Goal becomes met: the
   * celebration's trigger. Returns the call that stops it.
   */
  subscribeGoalMet(listener: () => void): () => void;
}

/** The award of an action that earns nothing: no change to write, nothing to make in memory. */
const NOTHING_EARNED: XpAward = {
  changes: new Map(),
  amount: 0,
  commit: () => undefined,
};

/**
 * The XP an action earns by the Edition's XP table, with the Review XP
 * already earned today, which the table's daily cap bounds.
 */
function amountOf(table: XpTable, action: XpAction, reviewToday: number): number {
  switch (action.source) {
    case 'game-round':
      return table.round;
    case 'game-finished':
      return action.played > 0 && action.right / action.played >= table.finishedGameShare
        ? table.finishedGame
        : 0;
    case 'game-best':
      return table.bestResult;
    case 'daily-crossword':
      return table.dailyCrossword;
    case 'review-answer':
      return Math.max(0, Math.min(table.reviewAnswer, table.reviewDailyCap - reviewToday));
    case 'quick-question':
      return table.quickQuestion;
  }
}

/**
 * The id of the action's record. The Daily Crossword of a date has one, so
 * two devices that solve it merge into one record; any other action's id is
 * new, made by `newId`.
 */
const fixedIdOf = (action: XpAction): string | undefined =>
  action.source === 'daily-crossword' ? `daily-crossword-${action.date}` : undefined;

/** Opens the XP log over the user state, for the Core composition. */
export async function openXpLog({
  edition,
  userState,
  clock,
  random,
  dayTurned,
  analytics,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'xp' | 'levels' | 'userSettingDefaults'>;
  userState: Pick<UserState, 'list' | 'write'>;
  clock: Clock;
  random: Random;
  dayTurned: Pick<Subject<LocalDate>, 'subscribe'>;
  /** Where the Level's and the Daily Goal's events go (ADR 0068). */
  analytics: Pick<Analytics, 'track'>;
}): Promise<XpLog> {
  const on = edition.isFeatureEnabled('xpLog');
  const levelsOn = on && edition.isFeatureEnabled('levels');
  const goalOn = on && edition.isFeatureEnabled('dailyGoal');
  const records = new Map<string, XpRecord>(on ? await userState.list(xpRecords) : []);
  const subscribers = createSubscribers();
  const goalMetSubscribers = createSubscribers();
  /** Tells the records of one session apart when the clock and the random source stand still. */
  let sequence = 0;

  /** The amount a record counts for: Review XP counts up to the daily cap of its date. */
  function counted(record: Extract<XpRecord, { kind: 'xp' }>, review: Map<string, number>): number {
    if (record.source !== 'review-answer') return record.amount;
    const before = review.get(record.date) ?? 0;
    const amount = Math.max(0, Math.min(record.amount, edition.xp.reviewDailyCap - before));
    review.set(record.date, before + amount);
    return amount;
  }

  function dayOf(date: string): XpDay {
    // The goal in force when the day starts: the last one set before it, else the Edition's default.
    let before: Extract<XpRecord, { kind: 'daily-goal' }> | undefined;
    const ofDay: XpRecord[] = [];
    for (const record of records.values()) {
      if (record.date === date) ofDay.push(record);
      else if (
        record.kind === 'daily-goal' &&
        record.date < date &&
        (before === undefined ||
          record.date > before.date ||
          (record.date === before.date && record.at > before.at))
      )
        before = record;
    }
    let goal = before?.goal ?? edition.userSettingDefaults.dailyGoal;
    let xp = 0;
    let met = false;
    const review = new Map<string, number>();
    // In time order, the day is met once its XP reaches the goal in force at that moment.
    for (const record of ofDay.sort((one, other) => (one.at < other.at ? -1 : 1))) {
      if (record.kind === 'xp') xp += counted(record, review);
      else if (record.kind === 'daily-goal') goal = record.goal;
      if (xp >= goal) met = true;
    }
    return { xp, dailyGoal: goalOn ? { goal, met } : null };
  }

  function derive(): XpLogDays & {
    date: string;
    state: XpLogState;
    reviewToday: number;
    milestones: XpLogMilestones;
  } {
    const date = todayKey(clock);
    let total = 0;
    const byDate = new Map<string, number>();
    const frozen = new Set<string>();
    const breaks = new Map<string, number>();
    /** The Review XP of each date, which counts up to the daily cap even as two devices' logs merge. */
    const review = new Map<string, number>();
    const wins = new Set<string>();
    const rightByMode = new Map<string, number>();
    const rightRarities = new Set<number>();
    const crosswords = new Set<string>();
    const badges = new Map<string, string>();
    for (const record of records.values()) {
      switch (record.kind) {
        case 'badge':
          badges.set(record.badge, record.date);
          break;
        case 'freeze':
          frozen.add(record.date);
          break;
        case 'break':
          breaks.set(record.date, Math.max(breaks.get(record.date) ?? 0, record.days));
          break;
        case 'daily-goal':
          break;
        case 'xp': {
          const { source, mode, rarity } = record;
          if (source === 'game-finished' && mode !== undefined) wins.add(mode);
          if (source === 'game-round' && mode !== undefined) {
            rightByMode.set(mode, (rightByMode.get(mode) ?? 0) + 1);
          }
          if (source === 'game-round' && rarity !== undefined) rightRarities.add(rarity);
          if (source === 'daily-crossword') crosswords.add(record.date);
          const amount = counted(record, review);
          total += amount;
          byDate.set(record.date, (byDate.get(record.date) ?? 0) + amount);
        }
      }
    }
    const { xp, dailyGoal } = dayOf(date);
    return {
      date,
      state: {
        total,
        today: xp,
        dailyGoal,
        level: levelsOn ? levelOf(edition.levels, total) : undefined,
      },
      reviewToday: review.get(date) ?? 0,
      byDate,
      frozen,
      breaks,
      milestones: { wins, rightByMode, rightRarities, crosswords, badges },
    };
  }
  let derived = derive();

  function change(): void {
    const wasMet = derived.state.dailyGoal?.met === true;
    const previousDate = derived.date;
    const before = derived.state.level?.level;
    derived = derive();
    const { state } = derived;
    const after = state.level?.level;
    if (before !== undefined && after !== undefined && after > before) {
      void analytics.track('levelReached', { level: after });
    }
    subscribers.tell();
    if (state.dailyGoal?.met === true && !wasMet && derived.date === previousDate) {
      goalMetSubscribers.tell();
      void analytics.track('dailyGoalMet', { goal: state.dailyGoal.goal }).catch(() => undefined);
    }
  }

  function reachedOn(total: number): string | undefined {
    let sum = 0;
    const inTime = [...records.values()].sort((a, b) => a.at.localeCompare(b.at));
    for (const record of inTime) {
      if (record.kind !== 'xp') continue;
      sum += record.amount;
      if (sum >= total) return record.date;
    }
    return undefined;
  }

  /** An id no other device makes: the instant, a random part and this session's count. */
  function newId(at: Date): string {
    const randomPart = Math.floor(random.next() * 36 ** 8)
      .toString(36)
      .padStart(8, '0');
    sequence += 1;
    return `${at.getTime().toString(36)}-${randomPart}-${sequence.toString(36)}`;
  }

  function award(action: XpAction): XpAward {
    const fixedId = fixedIdOf(action);
    if (!on || (fixedId !== undefined && records.has(fixedId))) return NOTHING_EARNED;
    const amount = amountOf(edition.xp, action, derived.reviewToday);
    if (amount === 0) return NOTHING_EARNED;
    const at = clock.now();
    const id = fixedId ?? newId(at);
    const record: XpRecord = {
      kind: 'xp',
      date: todayKey(clock),
      at: at.toISOString(),
      source: action.source,
      amount,
      ...(action.source === 'game-round' || action.source === 'game-finished'
        ? { mode: action.mode }
        : {}),
      ...(action.source === 'game-round' && action.rarity !== undefined
        ? { rarity: action.rarity }
        : {}),
    };
    return {
      changes: xpRecords.record(id).change(record),
      amount,
      commit() {
        records.set(id, record);
        change();
      },
    };
  }

  function freeze(dates: readonly string[]): XpLogAppend {
    const at = clock.now().toISOString();
    const added = new Map<string, XpRecord>(
      dates.map((date) => [`freeze-${date}`, { kind: 'freeze', date, at }]),
    );
    return {
      changes: new Map(
        [...added].flatMap(([id, record]) => [...xpRecords.record(id).change(record)]),
      ),
      commit() {
        if (added.size === 0) return;
        for (const [id, record] of added) records.set(id, record);
        change();
      },
    };
  }

  function earn(badges: readonly string[]): XpLogAppend {
    const date = todayKey(clock);
    const at = clock.now().toISOString();
    const added = new Map<string, XpRecord>(
      badges.map((badge) => [`badge-${badge}`, { kind: 'badge', date, at, badge }]),
    );
    return {
      changes: new Map(
        [...added].flatMap(([id, record]) => [...xpRecords.record(id).change(record)]),
      ),
      commit() {
        if (added.size === 0) return;
        for (const [id, record] of added) records.set(id, record);
        change();
      },
    };
  }

  function startBreak(days: number): XpLogAppend {
    const date = todayKey(clock);
    const id = `break-${date}`;
    const record: XpRecord = { kind: 'break', date, at: clock.now().toISOString(), days };
    return {
      changes: xpRecords.record(id).change(record),
      commit() {
        records.set(id, record);
        change();
      },
    };
  }

  async function setDailyGoal(goal: DailyGoal): Promise<void> {
    if (!goalOn) return;
    const at = clock.now();
    const id = newId(at);
    const record: XpRecord = {
      kind: 'daily-goal',
      date: todayKey(clock),
      at: at.toISOString(),
      goal,
    };
    await userState.write(xpRecords.record(id).change(record));
    records.set(id, record);
    change();
    await analytics.track('dailyGoalChanged', { goal }).catch(() => undefined);
  }

  dayTurned.subscribe(change);

  return {
    get state() {
      return derived.state;
    },
    get days() {
      return derived;
    },
    get milestones() {
      return derived.milestones;
    },
    award,
    earn,
    freeze,
    startBreak,
    reachedOn,
    subscribe: subscribers.subscribe,
    dayOf,
    setDailyGoal,
    subscribeGoalMet: goalMetSubscribers.subscribe,
  };
}
