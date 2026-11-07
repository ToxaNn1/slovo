import type { DailyGoal, XpTable } from '@slovo/contracts';

import { createSubscribers } from '../in-turn';
import { todayBounds, todayKey } from '../local-date';
import type { Clock, Random, UserStateChanges } from '../ports';
import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { History } from '../saved/history';
import type { XpAction, XpAward } from '../game/game-xp';
import type { LocalDate } from '../local-date';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import type { XpRecord } from './records';
import { userStateRecords } from '../user-state-schema';
import { levelOf, type LevelState } from './levels';
import { ACTIVE_DAY_XP } from './streak';

const { xpLog: xpRecords } = userStateRecords;

/** The Daily Goal of a local day and whether the day met it (ADR 0074). */
export interface DailyGoalState {
  /**
   * The Words to See on the day: the last goal set on or before it. A past
   * day before any goal in Words holds the goal in XP of ADR 0066 instead.
   */
  readonly goal: DailyGoal;
  /** Whether the day's Words Seen reached the goal in force at some moment of the day: a day met stays met. */
  readonly met: boolean;
}

/** Today's Daily Goal, with the Words Seen today. */
export interface TodaysDailyGoal extends DailyGoalState {
  /** The Words Seen today, in the clock's time zone. */
  readonly seen: number;
}

/** One local day as the XP log derives it. */
export interface XpDay {
  /** The XP earned on the day. */
  readonly xp: number;
  /** The day's Daily Goal; `null` before the reader set one, or while the Daily Goal is off. */
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
  /** Today's Daily Goal and whether it is met; `null` before the reader set one, or while the Daily Goal is off. */
  readonly dailyGoal: TodaysDailyGoal | null;
}

/** What the XP log holds by local date `YYYY-MM-DD`, for the Active Days and the Streak. */
export interface XpLogDays {
  /** The XP earned on each local date that has any. */
  readonly byDate: ReadonlyMap<string, number>;
  /**
   * The Active Days the log makes (ADR 0074): a day with a Daily Goal once
   * it is met, a day without one with at least 5 XP.
   */
  readonly active: ReadonlySet<string>;
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
  /** The Game Modes with a finished Game right in every Round (ADR 0085). */
  readonly flawless: ReadonlySet<string>;
  /** Each Game answer, right (one that earned XP) or wrong, with its Game Mode, in the order given (ADR 0085). */
  readonly answers: readonly { readonly mode: string; readonly right: boolean }[];
  /** The rarities of the Words with a right Game answer that earned XP. */
  readonly rightRarities: ReadonlySet<number>;
  /** The local dates of the Daily Crosswords solved. */
  readonly crosswords: ReadonlySet<string>;
  /** The Badges earned: the local date each was earned on, by Badge id. */
  readonly badges: ReadonlyMap<string, string>;
  /** The Badges the reader has opened, which ends their «НОВА» mark (ADR 0085), by Badge id. */
  readonly opened: ReadonlySet<string>;
}

/** Records to append for another write, and the step that makes them in memory once written. */
export interface XpLogAppend {
  readonly changes: UserStateChanges;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/** A solved Daily Crossword as its XP log record keeps it (ADR 0087). */
export interface CrosswordSolve {
  readonly solveSeconds: number | undefined;
  readonly hinted: boolean;
}

/**
 * The XP log (ADR 0066): an append-only log of the XP each learning action
 * earned and of the Daily Goals set, kept per Edition, which the total,
 * today's XP and each day's goal state are derived from.
 * The amounts and the Review cap come from the Edition's XP table; the log
 * syncs as a union by record id, so two devices agree and no record doubles.
 * The Daily Crossword of a date earns once, Review answers count up to
 * the cap a day, and a Word Seen for the first time earns once, up to the
 * day's Daily Goal, however many devices' records merge.
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
  /** The record of a Game Round answered wrong in `mode`, for another write; it earns no XP (ADR 0085). */
  answeredWrong(mode: string): XpLogAppend;
  /**
   * The Badge-opened record of a Badge (ADR 0085), for another write. A Badge
   * has one such record by its id, so two devices that open it merge into one.
   */
  open(badge: string): XpLogAppend;
  /** The local date (`YYYY-MM-DD`) the total XP first reached `total`, if it has. */
  reachedOn(total: number): string | undefined;
  /**
   * The Daily Crossword solve of a local date `YYYY-MM-DD`, if it is solved:
   * its Solve time in seconds, if one was kept, and whether the Crossword
   * Hint was used. A solve recorded before them reads as no time and no
   * hint (ADR 0087).
   */
  crosswordSolveOn(date: string): CrosswordSolve | undefined;
  /** Calls `listener` after each change of the XP. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** The XP and the Daily Goal of a local date `YYYY-MM-DD`: a past day keeps the goal it had. */
  dayOf(date: string): XpDay;
  /**
   * Sets the Daily Goal from today on, or turns it off with `null` («Без
   * цілі»): today's goal changes, a day already met stays met, and the
   * earlier days keep theirs. Nothing while the Daily Goal is off.
   */
  setDailyGoal(goal: DailyGoal | null): Promise<void>;
  /**
   * Calls `listener` once when today's Daily Goal becomes met: the
   * celebration's trigger. Returns the call that stops it.
   */
  subscribeGoalMet(listener: () => void): () => void;
}

/** The award of an action that earns nothing: no change to write, nothing to make in memory. */
type WordGoalRecord = Extract<XpRecord, { kind: 'word-goal' }>;

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

/** The id of the Daily Crossword's record of a date: one solve a day. */
const crosswordIdOf = (date: string) => `daily-crossword-${date}`;

/**
 * The id of the action's record. The Daily Crossword of a date has one, and
 * so has the Review answer of an Entry on `today`, so a second award is
 * refused, after a restart too, and two devices' awards merge into one
 * record; any other action's id is new, made by `newId`.
 */
function fixedIdOf(action: XpAction, today: string): string | undefined {
  if (action.source === 'daily-crossword') return crosswordIdOf(action.date);
  if (action.source === 'review-answer') return `review-answer-${today}-${action.entryId}`;
  return undefined;
}

/** Opens the XP log over the user state, for the Core composition. */
export async function openXpLog({
  edition,
  userState,
  clock,
  random,
  dayTurned,
  analytics,
  history,
  isFirstCycle,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'xp' | 'levels'>;
  userState: Pick<UserState, 'list' | 'write'>;
  /** The Entries Seen, whose Words today count toward the Daily Goal. */
  history: Pick<History, 'list' | 'subscribe'>;
  /** Whether a Word Seen now may be Seen for the first time: only in the first Cycle. */
  isFirstCycle: () => boolean;
  clock: Clock;
  random: Random;
  dayTurned: Pick<Subject<LocalDate>, 'subscribe'>;
  /** Where the Level's and the Daily Goal's events go (ADR 0068). */
  analytics: Pick<Analytics, 'track'>;
}): Promise<XpLog> {
  const on = edition.isFeatureEnabled('xpLog');
  const levelsOn = on && edition.isFeatureEnabled('levels');
  const goalOn = on && edition.isFeatureEnabled('dailyGoal');
  const seenWordOn = goalOn && edition.isFeatureEnabled('seenWordXp');
  const records = new Map<string, XpRecord>(on ? await userState.list(xpRecords) : []);
  /** The `word-goal` records by date and instant, so a goal is looked up among them and not in the whole log; made anew after one is added. */
  let wordGoals: WordGoalRecord[] | undefined;
  function wordGoalsInOrder(): readonly WordGoalRecord[] {
    wordGoals ??= [...records.values()]
      .filter((record): record is WordGoalRecord => record.kind === 'word-goal')
      .sort((one, other) =>
        one.date === other.date
          ? one.at.localeCompare(other.at)
          : one.date.localeCompare(other.date),
      );
    return wordGoals;
  }
  /** Keeps a record in the log, and forgets the goals' order when it is a goal. */
  function keep(id: string, record: XpRecord): void {
    records.set(id, record);
    if (record.kind === 'word-goal') wordGoals = undefined;
  }
  const subscribers = createSubscribers();
  const goalMetSubscribers = createSubscribers();
  /** Tells the records of one session apart when the clock and the random source stand still. */
  let sequence = 0;

  /**
   * Counts records in turn: Review XP up to the daily cap of its date, and
   * the Seen-Word records up to the Daily Goal in Words of its date, also as
   * two devices' logs merge. `reviewXpOf` is the Review XP counted on a date
   * so far, `seenWordsOf` the Seen-Word records.
   */
  function counter() {
    const reviewXp = new Map<string, number>();
    const seenWords = new Map<string, number>();
    const goals = new Map<string, DailyGoal | undefined>();
    function goalAsCap(date: string): number {
      if (!goals.has(date)) goals.set(date, goalOf(date));
      return goals.get(date) ?? Infinity;
    }
    return {
      count: ({ source, date, amount }: Extract<XpRecord, { kind: 'xp' }>): number => {
        if (source === 'seen-word') {
          const before = seenWords.get(date) ?? 0;
          if (before >= goalAsCap(date)) return 0;
          seenWords.set(date, before + 1);
          return amount;
        }
        if (source !== 'review-answer') return amount;
        const before = reviewXp.get(date) ?? 0;
        const counted = Math.max(0, Math.min(amount, edition.xp.reviewDailyCap - before));
        reviewXp.set(date, before + counted);
        return counted;
      },
      reviewXpOf: (date: string) => reviewXp.get(date) ?? 0,
      seenWordsOf: (date: string) => seenWords.get(date) ?? 0,
    };
  }

  /** The goal in force on a local date: the last `word-goal` set on or before it, unless that one turned it off. */
  function goalOf(date: string): DailyGoal | undefined {
    if (!goalOn) return undefined;
    let last: WordGoalRecord | undefined;
    for (const record of wordGoalsInOrder()) {
      if (record.date > date) break;
      last = record;
    }
    return last?.goal ?? undefined;
  }

  const metId = (date: string) => `goal-met-${date}`;

  function dailyGoalOf(date: string): DailyGoalState | null {
    const goal = goalOf(date);
    return goal === undefined ? null : { goal, met: records.has(metId(date)) };
  }

  /** Whether a `word-goal` record, «Без цілі» included, was set on or before the local date. */
  const wordGoalSetBy = (date: string) => {
    const first = wordGoalsInOrder()[0];
    return first !== undefined && first.date <= date;
  };

  /**
   * A past day with no goal in Words but a goal in XP from before Words
   * counted (ADR 0074): met, as it was then, once the day's XP reached the
   * goal in force at that moment, the last `daily-goal` set before the day
   * or that day. `undefined` without such a goal.
   */
  function xpGoalOf(
    date: string,
    ofDay: readonly XpRecord[],
    count: (record: Extract<XpRecord, { kind: 'xp' }>) => number,
  ): DailyGoalState | undefined {
    let before: Extract<XpRecord, { kind: 'daily-goal' }> | undefined;
    for (const record of records.values()) {
      if (
        record.kind === 'daily-goal' &&
        record.date < date &&
        (before === undefined ||
          record.date > before.date ||
          (record.date === before.date && record.at > before.at))
      )
        before = record;
    }
    let goal = before?.goal;
    let xp = 0;
    let met = false;
    for (const record of ofDay) {
      if (record.kind === 'xp') xp += count(record);
      else if (record.kind === 'daily-goal') goal = record.goal;
      if (goal !== undefined && xp >= goal) met = true;
    }
    return goal === undefined ? undefined : { goal, met };
  }

  function dayOf(date: string): XpDay {
    const { count } = counter();
    const ofDay = [...records.values()]
      .filter((record) => record.date === date)
      .sort((one, other) => (one.at < other.at ? -1 : 1));
    const dailyGoal =
      goalOn && date < todayKey(clock) && !wordGoalSetBy(date)
        ? (xpGoalOf(date, ofDay, counter().count) ?? null)
        : dailyGoalOf(date);
    let xp = 0;
    for (const record of ofDay) if (record.kind === 'xp') xp += count(record);
    return { xp, dailyGoal };
  }

  /**
   * The Words Seen today. History is newest first, so the count stops at the
   * first Entry Seen before today; an Entry ahead of today, after the clock
   * moved back, is not today's.
   */
  function seenToday(): number {
    const { start, end } = todayBounds(clock);
    let seen = 0;
    for (const { seenAt, row } of history.list) {
      const time = seenAt.getTime();
      if (time < start) break;
      if (time < end && row.kind === 'word') seen += 1;
    }
    return seen;
  }

  function derive(): XpLogDays & {
    date: string;
    state: XpLogState;
    reviewToday: number;
    /** Today's Seen-Word records counted toward today's goal. */
    seenWordsCounted: number;
    milestones: XpLogMilestones;
  } {
    const date = todayKey(clock);
    let total = 0;
    const byDate = new Map<string, number>();
    const frozen = new Set<string>();
    const breaks = new Map<string, number>();
    /** The Review and Seen-Word XP of each date, which count up to their caps even as two devices' logs merge. */
    const { count, reviewXpOf, seenWordsOf } = counter();
    const wins = new Set<string>();
    const rightByMode = new Map<string, number>();
    const flawless = new Set<string>();
    const answered: { at: string; id: string; mode: string; right: boolean }[] = [];
    const rightRarities = new Set<number>();
    const crosswords = new Set<string>();
    const badges = new Map<string, string>();
    const opened = new Set<string>();
    for (const [id, record] of records) {
      switch (record.kind) {
        case 'wrong-answer':
          answered.push({ at: record.at, id, mode: record.mode, right: false });
          break;
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
        case 'word-goal':
        case 'goal-met':
          break;
        case 'badge-opened':
          opened.add(record.badge);
          break;
        case 'xp': {
          const { source, mode, rarity, right, played } = record;
          if (source === 'game-finished' && mode !== undefined) {
            wins.add(mode);
            if (played !== undefined && played > 0 && right === played) flawless.add(mode);
          }
          if (source === 'game-round' && mode !== undefined) {
            rightByMode.set(mode, (rightByMode.get(mode) ?? 0) + 1);
            answered.push({ at: record.at, id, mode, right: true });
          }
          if (source === 'game-round' && rarity !== undefined) rightRarities.add(rarity);
          if (source === 'daily-crossword') crosswords.add(record.date);
          const amount = count(record);
          total += amount;
          byDate.set(record.date, (byDate.get(record.date) ?? 0) + amount);
        }
      }
    }
    const active = new Set<string>();
    for (const [day, xp] of byDate) {
      if (goalOf(day) === undefined ? xp >= ACTIVE_DAY_XP : records.has(metId(day)))
        active.add(day);
    }
    for (const record of records.values()) {
      // A day met stays met whatever goal is set later, «Без цілі» included.
      if (record.kind === 'goal-met') active.add(record.date);
    }
    const { xp, dailyGoal } = dayOf(date);
    return {
      date,
      state: {
        total,
        today: xp,
        dailyGoal: dailyGoal === null ? null : { ...dailyGoal, seen: seenToday() },
        level: levelsOn ? levelOf(edition.levels, total) : undefined,
      },
      reviewToday: reviewXpOf(date),
      seenWordsCounted: seenWordsOf(date),
      byDate,
      active,
      frozen,
      breaks,
      milestones: {
        wins,
        rightByMode,
        flawless,
        answers: answered
          .sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1))
          .map(({ mode, right }) => ({ mode, right })),
        rightRarities,
        crosswords,
        badges,
        opened,
      },
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
      void analytics.track('levelReached', { level: after }).catch(() => undefined);
    }
    subscribers.tell();
    if (state.dailyGoal?.met === true && !wasMet && derived.date === previousDate) {
      goalMetSubscribers.tell();
      void analytics.track('dailyGoalMet', { goal: state.dailyGoal.goal }).catch(() => undefined);
    }
  }

  function crosswordSolveOn(date: string): CrosswordSolve | undefined {
    const record = records.get(crosswordIdOf(date));
    if (record?.kind !== 'xp' || record.source !== 'daily-crossword') return undefined;
    return { solveSeconds: record.solveSeconds, hinted: record.hinted ?? false };
  }

  function reachedOn(total: number): string | undefined {
    let sum = 0;
    // Each record counts what `derive` counts it, so a Review answer past the cap reaches nothing.
    const { count } = counter();
    const inTime = [...records.values()].sort((a, b) => a.at.localeCompare(b.at));
    for (const record of inTime) {
      if (record.kind !== 'xp') continue;
      sum += count(record);
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
    const fixedId = fixedIdOf(action, todayKey(clock));
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
      ...(action.source === 'game-finished' ? { right: action.right, played: action.played } : {}),
      ...(action.source === 'daily-crossword' && action.solveSeconds !== undefined
        ? { solveSeconds: action.solveSeconds }
        : {}),
      ...(action.source === 'daily-crossword' && action.hinted !== undefined
        ? { hinted: action.hinted }
        : {}),
    };
    return {
      changes: xpRecords.record(id).change(record),
      amount,
      commit() {
        keep(id, record);
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
        for (const [id, record] of added) keep(id, record);
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
        for (const [id, record] of added) keep(id, record);
        change();
      },
    };
  }

  function answeredWrong(mode: string): XpLogAppend {
    if (!on) return NOTHING_EARNED;
    const at = clock.now();
    // No draw from `random`: a wrong answer leaves the Game's own draws as they were.
    sequence += 1;
    const id = `${at.getTime().toString(36)}-wrong-${sequence.toString(36)}`;
    const record: XpRecord = {
      kind: 'wrong-answer',
      date: todayKey(clock),
      at: at.toISOString(),
      mode,
    };
    return {
      changes: xpRecords.record(id).change(record),
      commit() {
        records.set(id, record);
        change();
      },
    };
  }

  function open(badge: string): XpLogAppend {
    const id = `badge-opened-${badge}`;
    const record: XpRecord = {
      kind: 'badge-opened',
      date: todayKey(clock),
      at: clock.now().toISOString(),
      badge,
    };
    return {
      changes: xpRecords.record(id).change(record),
      commit() {
        records.set(id, record);
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
        keep(id, record);
        change();
      },
    };
  }

  /** The goal-met record of today, when today's Words Seen reach `goal` and today is not met yet. */
  function metToday(goal: DailyGoal | undefined): Map<string, XpRecord> {
    const date = todayKey(clock);
    if (goal === undefined || records.has(metId(date)) || seenToday() < goal) return new Map();
    return new Map([[metId(date), { kind: 'goal-met', date, at: clock.now().toISOString() }]]);
  }

  async function write(added: ReadonlyMap<string, XpRecord>): Promise<void> {
    await userState.write(
      new Map([...added].flatMap(([id, record]) => [...xpRecords.record(id).change(record)])),
    );
    for (const [id, record] of added) keep(id, record);
    change();
  }

  async function setDailyGoal(goal: DailyGoal | null): Promise<void> {
    if (!goalOn) return;
    const at = clock.now();
    const record: XpRecord = {
      kind: 'word-goal',
      date: todayKey(clock),
      at: at.toISOString(),
      goal,
    };
    await write(new Map([[newId(at), record], ...metToday(goal ?? undefined)]));
    await analytics.track('dailyGoalChanged', { goal }).catch(() => undefined);
  }

  /** The Entries in History so far, also those cleared since: a Word among them is not Seen for the first time. */
  const inHistory = new Set(history.list.map(({ entryId }) => entryId));
  const seenWordId = (entryId: string) => `seen-word-${entryId}`;

  /**
   * The Seen-Word records of the Words that joined History today for the
   * first time: in the first Cycle, never in History, never earned on any
   * device, while today's Seen-Word records are fewer than today's goal in Words.
   */
  function seenWordsToday(goal: DailyGoal | undefined): Map<string, XpRecord> {
    const { start, end } = todayBounds(clock);
    const added = new Map<string, XpRecord>();
    let counted = derived.seenWordsCounted;
    for (const { entryId, seenAt, row } of history.list) {
      if (inHistory.has(entryId)) continue;
      const time = seenAt.getTime();
      if (
        !seenWordOn ||
        goal === undefined ||
        row.kind !== 'word' ||
        time < start ||
        time >= end ||
        !isFirstCycle() ||
        records.has(seenWordId(entryId)) ||
        counted >= goal
      )
        continue;
      counted += 1;
      added.set(seenWordId(entryId), {
        kind: 'xp',
        date: todayKey(clock),
        at: clock.now().toISOString(),
        source: 'seen-word',
        amount: edition.xp.seenWord,
      });
    }
    return added;
  }

  /**
   * Appends the Seen-Word XP of the Words Seen and meets today's goal once
   * the Words Seen reach it; one write at a time, so each records once. A
   * change while a write runs is taken up after it.
   */
  let meeting: Promise<void> | undefined;
  let changedMeanwhile = false;
  function meetGoal(): void {
    if (meeting !== undefined) {
      changedMeanwhile = true;
      return;
    }
    const goal = goalOf(todayKey(clock));
    const added = new Map([...seenWordsToday(goal), ...metToday(goal)]);
    // Marked once written, so the Words of a write that fails are taken up again.
    const taken = history.list.map(({ entryId }) => entryId);
    const markSeen = () => {
      for (const entryId of taken) inHistory.add(entryId);
    };
    if (added.size === 0) {
      markSeen();
      change();
      return;
    }
    meeting = write(added)
      .then(markSeen)
      .catch(() => undefined)
      .finally(() => {
        meeting = undefined;
        if (!changedMeanwhile) return;
        changedMeanwhile = false;
        meetGoal();
      });
  }

  history.subscribe(meetGoal);
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
    answeredWrong,
    earn,
    open,
    freeze,
    startBreak,
    reachedOn,
    crosswordSolveOn,
    subscribe: subscribers.subscribe,
    dayOf,
    setDailyGoal,
    subscribeGoalMet: goalMetSubscribers.subscribe,
  };
}
