import type { CrosswordDay, EntryKind } from '@slovo/contracts';
import {
  changesOfFacts,
  dateKeyOf,
  localDateAfter,
  localDayOf,
  totalFor,
  type Clock,
  type ContentReadPort,
  type Edition,
  type UserStateFact,
  type UserStateFacts,
  type UserStatePort,
} from '@slovo/core';

// Development tooling only (spec #1551): the app requires this module inside a
// `__DEV__` branch, so a production bundle holds none of it.

/** The names of the test states, each a link `<scheme>://dev/state/<name>`. */
export const testStateNames = [
  'fresh',
  'day-3-streak',
  'streak-lost',
  'streak-frozen',
  'level-up',
  'level-7',
  'all-badges',
  'no-badges',
  'reviews-due',
  'cycle-end',
  'weekly-recap',
  'empty-saved',
  'full-saved',
  'crossword-solved',
  'crossword-7-in-a-row',
] as const;

export type TestStateName = (typeof testStateNames)[number];

export function isTestStateName(name: string): name is TestStateName {
  return testStateNames.some((each) => each === name);
}

const testStateLink = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/*dev\/state(?:\/([^/?#]*))?\/?(?:[?#].*)?$/i;

/**
 * What a link names: a test state (`<scheme>://dev/state/<name>`), a name
 * that is none (`unknown`, the bare `dev/state` included), or nothing when
 * it is no test state link.
 */
export function testStateOf(
  path: string,
): { readonly name: TestStateName } | 'unknown' | undefined {
  const match = testStateLink.exec(path);
  if (match === null) return undefined;
  const name = match[1] ?? '';
  return isTestStateName(name) ? { name } : 'unknown';
}

/** What a test state is built from: the time, the Edition and its content. */
export interface TestStateSources {
  readonly clock: Clock;
  readonly edition: Pick<Edition, 'levels' | 'badges'>;
  readonly content: Pick<ContentReadPort, 'listIds'>;
  readonly crossword: { crosswordDay(date: string): Promise<CrosswordDay | undefined> };
}

type XpRecord = UserStateFact<'xpLog'>[string];
type KnowledgeRecord = UserStateFact<'knowledge'>[string];

const ENTRY_KINDS: readonly EntryKind[] = ['word', 'correction', 'idiom', 'synonymRow', 'tip'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The days, instants and record builders of one test state, all from the clock. */
function calendarOf(clock: Clock) {
  const now = clock.now();
  const today = localDayOf(now, clock).date;
  /** The local date `days` before today, `YYYY-MM-DD`. */
  const date = (days: number) => dateKeyOf(localDateAfter(today, -days));
  /** The instant `days` before now. */
  const at = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  /** XP records of the reader's learning `days` ago, enough for an Active Day. */
  function activeDay(days: number): Record<string, XpRecord> {
    const records: Record<string, XpRecord> = {};
    for (const n of [1, 2, 3]) {
      records[`dev-${date(days)}-${String(n)}`] = {
        kind: 'xp',
        date: date(days),
        at: at(days),
        source: 'quick-question',
        amount: 2,
      };
    }
    return records;
  }
  /** Active Days from `from` days ago up to `to` days ago. */
  function activeDays(from: number, to = 0): Record<string, XpRecord> {
    let records: Record<string, XpRecord> = {};
    for (let days = from; days >= to; days -= 1) records = { ...records, ...activeDay(days) };
    return records;
  }
  /** An XP record of `amount` from Game Rounds `days` ago, under its own id. */
  function xp(id: string, days: number, amount: number): Record<string, XpRecord> {
    return {
      [`dev-${id}`]: { kind: 'xp', date: date(days), at: at(days), source: 'game-round', amount },
    };
  }
  /** The XP record of the Daily Crossword solved `days` ago. */
  function crosswordSolved(days: number): Record<string, XpRecord> {
    return {
      [`dev-crossword-${date(days)}`]: {
        kind: 'xp',
        date: date(days),
        at: at(days),
        source: 'daily-crossword',
        amount: 15,
      },
    };
  }
  /** An Unknown mark set `days` ago, due for Review on `reviewIn` days from today (negative: past). */
  function unknown(days: number, reviewIn: number): KnowledgeRecord {
    return {
      mark: 'unknown',
      step: 1,
      reviewDay: date(-reviewIn),
      learned: false,
      markedAt: at(days),
    };
  }
  return { today: date(0), date, at, activeDays, xp, crosswordSolved, unknown };
}

type Calendar = ReturnType<typeof calendarOf>;

/** The reader past the onboarding a month ago, as every state but `fresh` is. */
function onboarded({ date, at }: Calendar): UserStateFacts {
  return { onboardingFinished: at(30), firstWeekFrom: date(30) };
}

/** Each id with the same value. */
function each<T>(ids: readonly string[], value: (id: string, index: number) => T) {
  return Object.fromEntries(ids.map((id, index) => [id, value(id, index)]));
}

/** Today's Daily Crossword with every word's letters in its cells, when the pack has the day. */
async function solvedGrid({ crossword }: TestStateSources, today: string): Promise<UserStateFacts> {
  const day = await crossword.crosswordDay(today);
  if (day === undefined) return {};
  const letters: Record<string, string> = {};
  for (const { answer, row, column, direction } of day.words) {
    Array.from(answer).forEach((letter, index) => {
      const place = direction === 'across' ? [row, column + index] : [row + index, column];
      letters[place.join(',')] = letter;
    });
  }
  return { crosswordProgress: { date: today, letters } };
}

/** The ids of every Entry of the content, Words first. */
async function entryIds({ content }: TestStateSources) {
  const words = await content.listIds('word');
  const all = (await Promise.all(ENTRY_KINDS.map((kind) => content.listIds(kind)))).flat();
  return { words, all };
}

/** The Saved tab full: Favorites, Learning, History and four Collections. */
function fullSaved(calendar: Calendar, words: readonly string[]): UserStateFacts {
  const { at, unknown } = calendar;
  const favorites = words.slice(0, 12);
  const learning = words.slice(12, 18);
  const history = words.slice(0, 30);
  const collections = ['Улюблені', 'На каву', 'Діалекти', 'Для листів'];
  const collectionEntries: Record<string, string> = {};
  collections.forEach((_, index) => {
    for (const id of words.slice(index * 5, index * 5 + 5)) {
      collectionEntries[`dev${String(index + 1)}.${id}`] = at(index + 1);
    }
  });
  return {
    favorites: each(favorites, (_, index) => at(index + 1)),
    knowledge: each(learning, (_, index) => unknown(index + 2, 5)),
    history: each(history, (_, index) => ({ seenAt: at(index / 4), wordOfTheDay: index === 0 })),
    collections: each(
      collections.map((_, index) => `dev${String(index + 1)}`),
      (_, index) => ({ name: collections[index] ?? '', createdAt: at(10 + index) }),
    ),
    collectionEntries,
  };
}

/** The user state each test state holds. */
async function factsOf(name: TestStateName, sources: TestStateSources): Promise<UserStateFacts> {
  const calendar = calendarOf(sources.clock);
  const { date, at, activeDays, xp, crosswordSolved, unknown, today } = calendar;
  const base = onboarded(calendar);
  const { levels, badges } = sources.edition;
  switch (name) {
    case 'fresh':
      return {};
    case 'empty-saved':
      return base;
    case 'day-3-streak':
      return { ...base, xpLog: activeDays(2) };
    case 'streak-lost':
      // Ten missed days: more than the Streak freezes a reader holds can cover.
      return { ...base, xpLog: activeDays(20, 11) };
    case 'streak-frozen':
      return {
        ...base,
        xpLog: {
          ...activeDays(6, 2),
          [`dev-freeze-${date(1)}`]: { kind: 'freeze', date: date(1), at: at(0) },
        },
      };
    case 'level-up':
      // One XP short of Level 2 with today's and yesterday's 12 XP: the next right answer reaches it.
      return {
        ...base,
        xpLog: { ...activeDays(1), ...xp('level-up', 2, totalFor(levels, 2) - 12 - 1) },
      };
    case 'level-7':
      return { ...base, xpLog: { ...activeDays(4), ...xp('level-7', 5, totalFor(levels, 7)) } };
    case 'all-badges':
      return {
        ...base,
        xpLog: {
          ...activeDays(2),
          ...each(
            badges.map(({ id }) => `dev-badge-${id}`),
            (_, index): XpRecord => ({
              kind: 'badge',
              date: date(index + 1),
              at: at(index + 1),
              badge: badges[index]?.id ?? '',
            }),
          ),
        },
      };
    case 'no-badges':
      // Two Active Days and less XP than Level 1: no Badge's condition is met.
      return { ...base, xpLog: activeDays(1) };
    case 'reviews-due': {
      const { words } = await entryIds(sources);
      const due = words.slice(0, 5);
      return {
        ...base,
        xpLog: activeDays(2),
        knowledge: each(due, () => unknown(2, -1)),
        history: each(due, () => ({ seenAt: at(2), wordOfTheDay: false })),
      };
    }
    case 'cycle-end': {
      // Every Entry Seen in the Cycle but the first Word, so it ends after one more card.
      const { all, words } = await entryIds(sources);
      const left = words[0];
      return {
        ...base,
        cycle: { id: 1, seed: 0 },
        seen: each(
          all.filter((id) => id !== left),
          () => 1,
        ),
      };
    }
    case 'weekly-recap': {
      // A week of reading before this one; the Weekly Recap shows on a local Monday.
      const { words } = await entryIds(sources);
      const week = words.slice(0, 7);
      return {
        ...base,
        xpLog: activeDays(7, 1),
        favorites: each(week.slice(0, 3), (_, index) => at(index + 2)),
        knowledge: each(week.slice(3), (_, index): KnowledgeRecord => ({
          mark: 'known',
          step: null,
          reviewDay: null,
          learned: false,
          markedAt: at(index + 2),
        })),
        history: each(week, (_, index) => ({ seenAt: at(index + 1), wordOfTheDay: false })),
      };
    }
    case 'full-saved': {
      const { words } = await entryIds(sources);
      return { ...base, xpLog: activeDays(2), ...fullSaved(calendar, words) };
    }
    case 'crossword-solved':
      return {
        ...base,
        xpLog: { ...activeDays(2), ...crosswordSolved(0) },
        ...(await solvedGrid(sources, today)),
      };
    case 'crossword-7-in-a-row': {
      let solved: Record<string, XpRecord> = {};
      for (let days = 6; days >= 0; days -= 1) solved = { ...solved, ...crosswordSolved(days) };
      return {
        ...base,
        xpLog: { ...activeDays(6), ...solved },
        ...(await solvedGrid(sources, today)),
      };
    }
  }
}

/** The records a test state leaves as they are: the schema version and the installed marker. */
const KEPT_KEYS: ReadonlySet<string> = new Set(['schema.version', 'app.installed']);

/**
 * Replaces every record of the stored user state with the test state's, the
 * schema version and the installed marker aside, as kept from before: nothing
 * of it waits to sync. The app reloads after it, so nothing open holds the
 * records it replaced.
 */
export async function loadTestState(
  name: TestStateName,
  port: UserStatePort,
  sources: TestStateSources,
): Promise<void> {
  const changes = new Map<string, string | undefined>();
  for (const key of (await port.list('')).keys()) {
    if (!KEPT_KEYS.has(key)) changes.set(key, undefined);
  }
  for (const [key, text] of changesOfFacts(await factsOf(name, sources))) changes.set(key, text);
  await port.write(changes);
}
