import type { EntryKind } from '@slovo/contracts';
import {
  changesOfFacts,
  dateKeyOf,
  localDateAfter,
  localDayOf,
  localTimeOf,
  parseLocalDate,
  todayDate,
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
  'clean',
  'week',
  'half-year',
] as const;

export type TestStateName = (typeof testStateNames)[number];

/**
 * The test profiles «Тестовий профіль» in Settings offers (owner, 20.11): a
 * guest's whole device state at once, for a check on the phone. Each turns
 * the Community Counters off, so a profile sends nothing to the server.
 */
export const testProfiles = [
  {
    name: 'clean',
    label: 'Чистий',
    about: 'Перший запуск: нічого не збережено, онбординг спочатку.',
  },
  {
    name: 'week',
    label: 'Тиждень',
    about: 'Тиждень: 30 слів, 5 улюблених, 1 добірка, серія 4, 2 гри.',
  },
  {
    name: 'half-year',
    label: 'Пів року',
    about: 'Пів року: сотні слів, 60 улюблених, 25 прихованих, 5 добірок, серія 63, 60 ігор.',
  },
] as const satisfies readonly {
  readonly name: TestStateName;
  readonly label: string;
  readonly about: string;
}[];

export type TestProfileName = (typeof testProfiles)[number]['name'];

function isTestStateName(name: string): name is TestStateName {
  return testStateNames.some((each) => each === name);
}

const testStateLink =
  /^(?:[a-z][a-z0-9+.-]*:\/\/(?:[^/?#]*\/+--(?=\/))?)?\/*(?:--\/+)?dev\/state(?:\/([^/?#]*))?\/?(?:[?#].*)?$/i;

/**
 * What a link names: a test state (`<scheme>://dev/state/<name>`, or behind
 * Expo Go's `/--/`, as `exp://<host>:<port>/--/dev/state/<name>`), a name
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
}

type XpRecord = UserStateFact<'xpLog'>[string];
type KnowledgeRecord = UserStateFact<'knowledge'>[string];

const ENTRY_KINDS: readonly EntryKind[] = ['word', 'correction', 'idiom', 'synonymRow', 'tip'];
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MINUTES_IN_DAY = 24 * 60;

/** The minute of the local day an instant falls on, in the clock's time zone. */
function minuteOfDay(instant: Date, clock: Clock): number {
  const { hour, minute } = localTimeOf(instant, clock);
  return hour * 60 + minute;
}

/** The local days from today to the `?day=` value, or undefined for a value that is no day. */
function daysTo(day: string, clock: Clock): number | undefined {
  const today = todayDate(clock);
  const weekday = WEEKDAYS.indexOf(day.toLowerCase());
  if (weekday !== -1) {
    const todayWeekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    return (weekday - todayWeekday + 7) % 7;
  }
  const date = parseLocalDate(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || dateKeyOf(localDateAfter(date, 0)) !== day) {
    return undefined;
  }
  const dayOf = ({ year, month, day }: typeof date) => Date.UTC(year, month - 1, day) / DAY_MS;
  return dayOf(date) - dayOf(today);
}

/**
 * The shift, in milliseconds, a test state link's `?day=` asks of the
 * device clock (#1859): to the next such weekday, today included
 * (`?day=monday`), or to a date (`?day=2026-12-31`). The local day moves
 * and the time of day stays, across a change of the clocks too. Unknown
 * for a value that is neither; undefined without the parameter.
 */
export function dayShiftOf(
  link: string,
  clock: Clock,
): { readonly shift: number } | 'unknown' | undefined {
  const value = /\?(?:[^#]*&)?day=([^&#]*)/.exec(link)?.[1];
  if (value === undefined) return undefined;
  const days = daysTo(value, clock);
  if (days === undefined) return 'unknown';
  const now = clock.now();
  const byDays = days * DAY_MS;
  // A change of the clocks between the two days moves the time of day; this takes it back.
  let drift = minuteOfDay(now, clock) - minuteOfDay(new Date(now.getTime() + byDays), clock);
  if (drift > MINUTES_IN_DAY / 2) drift -= MINUTES_IN_DAY;
  if (drift < -MINUTES_IN_DAY / 2) drift += MINUTES_IN_DAY;
  return { shift: byDays + drift * 60 * 1000 };
}

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
  return { date, at, activeDays, xp, crosswordSolved, unknown };
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
  const collections = ['Для подкасту', 'На каву', 'Діалекти', 'Для листів'];
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

/** What every test profile holds: the Community Counters off, so nothing is counted or sent. */
const SENDS_NOTHING: UserStateFacts = { shareCounters: false };

/**
 * The Game Modes the profiles' Games were played in, the Profile's own first:
 * those the UA Edition has on. A mode off keeps its Best result, unread.
 */
const GAME_MODES = ['guess-word', 'stress', 'timed', 'correction', 'idiom-meaning', 'anglicism'];

/** A finished Game `days` ago: its Round XP and its finish XP, as the Game awards them. */
function game(calendar: Calendar, id: string, days: number, mode: string, right: number) {
  const { date, at } = calendar;
  const played = right + 3;
  const records: Record<string, XpRecord> = {
    [`dev-game-${id}-rounds`]: {
      kind: 'xp',
      date: date(days),
      at: at(days),
      source: 'game-round',
      amount: right,
      mode,
    },
  };
  if (right * 2 >= played) {
    records[`dev-game-${id}-finished`] = {
      kind: 'xp',
      date: date(days),
      at: at(days),
      source: 'game-finished',
      amount: 5,
      mode,
      right,
      played,
    };
  }
  return records;
}

/** A Known mark set `days` ago, the Entry Learned. */
function known({ at }: Calendar, days: number): KnowledgeRecord {
  return { mark: 'known', step: null, reviewDay: null, learned: true, markedAt: at(days) };
}

/** The Collections named, each of `size` Words from `words` in turn, created `days` ago and later. */
function ownCollections(
  { at }: Calendar,
  names: readonly string[],
  words: readonly string[],
  size: (index: number) => number,
): UserStateFacts {
  const collectionEntries: Record<string, string> = {};
  let from = 0;
  names.forEach((_, index) => {
    for (const id of words.slice(from, from + size(index))) {
      collectionEntries[`own${String(index + 1)}.${id}`] = at(index + 1);
    }
    from += size(index);
  });
  return {
    collections: each(
      names.map((_, index) => `own${String(index + 1)}`),
      (_, index) => ({ name: names[index] ?? '', createdAt: at(20 + index * 25) }),
    ),
    collectionEntries,
  };
}

/** The Word of the Day of each of the last `days` days, yesterday first, from `words`. */
function archive({ date }: Calendar, words: readonly string[], days: number) {
  const archived: Record<string, string> = {};
  for (let day = 1; day <= days; day += 1) {
    const id = words[day - 1];
    if (id !== undefined) archived[date(day)] = id;
  }
  return archived;
}

/** A week of a guest's use: Seen Words, Favorites, one own Collection, a short Streak, two Games. */
async function week(calendar: Calendar, sources: TestStateSources): Promise<UserStateFacts> {
  const { date, at, activeDays, unknown } = calendar;
  const { words } = await entryIds(sources);
  const seen = words.slice(0, 30);
  return {
    ...SENDS_NOTHING,
    onboardingFinished: at(7),
    firstWeekFrom: date(7),
    cycle: { id: 1, seed: 0 },
    seen: each(seen, () => 1),
    history: each(seen, (_, index) => ({ seenAt: at(index / 5), wordOfTheDay: index % 5 === 0 })),
    wordOfTheDayArchive: archive(calendar, seen, 6),
    favorites: each(seen.slice(0, 5), (_, index) => at(index + 1)),
    knowledge: {
      ...each(seen.slice(5, 11), (_, index) => known(calendar, index)),
      ...each(seen.slice(11, 14), (_, index) => unknown(index + 1, 2)),
    },
    ...ownCollections(calendar, ['Мої слова'], seen.slice(2, 8), () => 6),
    // A Streak of 4 up to today, after an Active Day at the start of the week.
    xpLog: {
      ...activeDays(6, 6),
      ...activeDays(3),
      ...game(calendar, 'w1', 5, 'guess-word', 9),
      ...game(calendar, 'w2', 2, 'stress', 6),
    },
    gameBest: { 'guess-word': 9, stress: 6 },
  };
}

/**
 * Half a year of a guest's use: hundreds of Seen Words, many Favorites and
 * Hidden Entries, five own Collections, a Streak of 63 after a run of 80,
 * History full, sixty Games and Level 12 or so.
 */
async function halfYear(calendar: Calendar, sources: TestStateSources): Promise<UserStateFacts> {
  const { date, at, activeDays, xp, unknown } = calendar;
  const { levels } = sources.edition;
  const { words } = await entryIds(sources);
  // Fifty Words stay unseen, so the Cycle goes on.
  const seen = words.slice(0, Math.max(0, Math.min(450, words.length - 50)));
  const hidden = seen.slice(60, 85);
  const notHidden = seen.filter((id) => !hidden.includes(id));
  let games: Record<string, XpRecord> = {};
  for (let n = 0; n < 60; n += 1) {
    const mode = GAME_MODES[n % GAME_MODES.length] ?? 'guess-word';
    games = { ...games, ...game(calendar, `h${String(n)}`, 2 + n * 2, mode, 4 + (n % 9)) };
  }
  return {
    ...SENDS_NOTHING,
    onboardingFinished: at(180),
    firstWeekFrom: date(180),
    cycle: { id: 1, seed: 0 },
    seen: each(seen, () => 1),
    history: each(seen.slice(0, 250), (_, index) => ({
      seenAt: at(index * 0.7),
      wordOfTheDay: index % 3 === 0,
    })),
    wordOfTheDayArchive: archive(calendar, seen, 179),
    favorites: each(seen.slice(0, 60), (_, index) => at(index * 3 + 1)),
    hiddenEntries: each(hidden, (_, index) => at(index * 7 + 2)),
    knowledge: {
      ...each(notHidden.slice(100, 190), (_, index) => known(calendar, index * 2)),
      ...each(notHidden.slice(190, 205), (_, index) => unknown(index + 3, 3)),
      ...each(notHidden.slice(205, 210), () => unknown(4, -1)),
    },
    confirmed: each(notHidden.slice(100, 170), (_, index) => at(index * 2 + 1)),
    ...ownCollections(
      calendar,
      ['Улюблене', 'Для листів', 'Діалекти', 'На каву', 'Для подкасту'],
      notHidden.slice(20, 120),
      (index) => [15, 12, 9, 7, 6][index] ?? 5,
    ),
    // A run of 80 Active Days, a month and more missed, then 63 days up to today.
    xpLog: {
      ...activeDays(179, 100),
      ...activeDays(62),
      ...games,
      ...xp('half-year', 150, totalFor(levels, 12)),
    },
    gameBest: Object.fromEntries(GAME_MODES.map((mode, index) => [mode, 9 + index])),
  };
}

/** The user state each test state holds. */
async function factsOf(name: TestStateName, sources: TestStateSources): Promise<UserStateFacts> {
  const calendar = calendarOf(sources.clock);
  const { date, at, activeDays, xp, crosswordSolved, unknown } = calendar;
  const base = onboarded(calendar);
  const { levels, badges } = sources.edition;
  switch (name) {
    case 'fresh':
      return {};
    case 'clean':
      return SENDS_NOTHING;
    case 'week':
      return week(calendar, sources);
    case 'half-year':
      return halfYear(calendar, sources);
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
          learned: true,
          markedAt: at(index + 2),
        })),
        history: each(week, (_, index) => ({ seenAt: at(index + 1), wordOfTheDay: false })),
        // Yesterday's Word of the Day, so Yesterday shares the page (ADR 0130).
        ...(words[7] === undefined ? {} : { wordOfTheDayArchive: { [date(1)]: words[7] } }),
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
      };
    case 'crossword-7-in-a-row': {
      let solved: Record<string, XpRecord> = {};
      for (let days = 6; days >= 0; days -= 1) solved = { ...solved, ...crosswordSolved(days) };
      return {
        ...base,
        xpLog: { ...activeDays(6), ...solved },
      };
    }
  }
}

/** The records a test state leaves as they are: the schema version and the installed marker. */
const KEPT_KEYS: ReadonlySet<string> = new Set(['schema.version', 'app.installed']);

/**
 * Marks the reload a loaded test state asks for. The app reopens with the
 * link it was opened by, so the link would load the state and reload again,
 * without end; the mark lets it load nothing that once.
 */
const REOPENING_KEY = 'dev.testState.reopening';

/**
 * Replaces every record of the stored user state with the test state's, the
 * schema version and the installed marker aside, as kept from before: nothing
 * of it waits to sync. The app reloads after it, so nothing open holds the
 * records it replaced; the reload is marked, for `reopenedByTestState`.
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
  changes.set(REOPENING_KEY, JSON.stringify(name));
  await port.write(changes);
}

/**
 * Whether the app opened from the reload a loaded test state asked for, so
 * the link it reopens with must load nothing. Answers it once: the next link
 * loads again.
 */
export async function reopenedByTestState(port: UserStatePort): Promise<boolean> {
  if ((await port.get(REOPENING_KEY)) === undefined) return false;
  await port.write(new Map([[REOPENING_KEY, undefined]]));
  return true;
}
