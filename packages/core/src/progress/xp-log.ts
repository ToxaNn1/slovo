import type { XpTable } from '@slovo/contracts';

import { createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, Random } from '../ports';
import type { Edition } from '../edition/edition';
import type { XpAction, XpAward } from '../game/game-xp';
import type { LocalDate } from '../local-date';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { userStateRecords, type XpRecord } from '../user-state/user-state-schema';

const { xpLog: xpRecords } = userStateRecords;

/** What the XP log hands over: the XP derived from its records, never stored. */
export interface XpLogState {
  /** All XP ever earned in this Edition. */
  readonly total: number;
  /** The XP earned today, in the clock's time zone. */
  readonly today: number;
}

/**
 * The XP log (ADR 0066): an append-only log of the XP each learning action
 * earned, kept per Edition, which the total and today's XP are derived from.
 * The amounts come from the Edition's XP table; the log syncs as a union by
 * record id, so two devices agree and no record doubles.
 */
export interface XpLog {
  /** The XP as it stands, in memory for the session. */
  readonly state: XpLogState;
  /** The record the action appends, for another write; empty when it earns nothing. */
  award(action: XpAction): XpAward;
  /** Calls `listener` after each change of the XP. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** The award of an action that earns nothing: no change to write, nothing to make in memory. */
const NOTHING_EARNED: XpAward = {
  changes: new Map(),
  amount: 0,
  commit: () => undefined,
};

/** The XP an action earns by the Edition's XP table. */
function amountOf(table: XpTable, action: XpAction): number {
  switch (action.source) {
    case 'game-round':
      return table.round;
    case 'game-finished':
      return action.played > 0 && action.right / action.played >= table.finishedGameShare
        ? table.finishedGame
        : 0;
    case 'game-best':
      return table.bestResult;
  }
}

/** Opens the XP log over the user state, for the Core composition. */
export async function openXpLog({
  edition,
  userState,
  clock,
  random,
  dayTurned,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'xp'>;
  userState: Pick<UserState, 'list'>;
  clock: Clock;
  random: Random;
  dayTurned: Pick<Subject<LocalDate>, 'subscribe'>;
}): Promise<XpLog> {
  const on = edition.isFeatureEnabled('xpLog');
  const records = new Map<string, XpRecord>(on ? await userState.list(xpRecords) : []);
  const subscribers = createSubscribers();
  /** Tells the records of one session apart when the clock and the random source stand still. */
  let sequence = 0;

  function derive(): XpLogState {
    const today = todayKey(clock);
    let total = 0;
    let todays = 0;
    for (const record of records.values()) {
      total += record.amount;
      if (record.date === today) todays += record.amount;
    }
    return { total, today: todays };
  }
  let state = derive();

  function change(): void {
    state = derive();
    subscribers.tell();
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
    const amount = on ? amountOf(edition.xp, action) : 0;
    if (amount === 0) return NOTHING_EARNED;
    const at = clock.now();
    const id = newId(at);
    const record: XpRecord = {
      kind: 'xp',
      date: todayKey(clock),
      at: at.toISOString(),
      source: action.source,
      amount,
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

  dayTurned.subscribe(change);

  return {
    get state() {
      return state;
    },
    award,
    subscribe: subscribers.subscribe,
  };
}
