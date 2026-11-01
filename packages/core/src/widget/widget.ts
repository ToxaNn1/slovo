import {
  WIDGET_SNAPSHOT_FORMAT,
  type EditionStrings,
  type Entry,
  type SynonymRow,
  type Tip,
  type WidgetEntry,
  type WidgetSnapshot,
} from '@slovo/contracts';

import type { Collections } from '../saved/collections';
import type { EligibleOfKind, Entries, ShownEntry } from '../entries/entries';
import { buildEntryRow } from '../entries/entry-row';
import type { Favorites } from '../saved/favorites';
import type { AnyEntryCard } from '../feed/feed-card';
import type { Edition } from '../edition/edition';
import type { Onboarding } from '../onboarding/onboarding';
import { notificationText } from '../notifications/notification-text';
import type { History } from '../saved/history';
import { dateKeyOf, localDayOf, todayKey } from '../local-date';
import type { ActiveDays } from '../progress/active-days';
import type { Progress } from '../progress/progress';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import type { Clock } from '../ports';
import { withoutStress } from '../entries/stress';

/**
 * What the home-screen widget shows, decided by the Core, so the widget holds
 * no rule of its own, and what opening an Entry from it does (ADR 0026).
 */
export interface Widget {
  /**
   * The Widget Snapshot of the user state as it is now, for the app to write
   * into the App Group: every Widget Mode with only Eligible Entries in it
   * (ADR 0015), and each of those Entries once, with its text ready to show:
   * a Synonym Row's and a Tip's in the Edition's `strings`, as their
   * notification reads. Pure data; the contracts serialize it. Nothing while
   * the widget's Feature Switch is off, by its effective value at the time of
   * the call: the app writes no new snapshot and the widget just stops
   * updating, with no placeholder (ADR 0026). It carries the local date of
   * the newest Entry History keeps as Seen as the Word of the Day, in the
   * clock's time zone, while the Edition has the Word of the Day. It carries
   * the goal ring while the widget goal ring, the XP log and the Daily Goal
   * are on: today's XP, its Daily Goal and the Streak, by the rules of the
   * XP bar: «Без лічильників» hides the whole ring, and while its switch is
   * off the setting is «Приховати Серію» and hides only the Streak, as the
   * Streak is hidden while statistics are off. It says whether the
   * lock-screen widget is on.
   */
  snapshot(strings: EditionStrings['notificationBody']): Promise<WidgetSnapshot | undefined>;
  /**
   * Opens an Entry the widget showed, a Word, a Correction or an Idiom, by
   * the rule and the one write of an Entry opened from a notification (see
   * `Composition.openedFromNotification`): its Entry card once it is Seen, in
   * History and today is an Active Day. An Entry that isn't eligible or is
   * Seen already in the Cycle only makes today an Active Day. Nothing for an
   * id the Language Pack doesn't have: the Feed opens instead.
   */
  opened(entryId: string): Promise<AnyEntryCard | undefined>;
}

/** The eligible Entries of a kind, or none when the kind as a whole is out. */
const entriesOf = (eligible: EligibleOfKind) => ('entries' in eligible ? eligible.entries : []);

/**
 * An Entry as the widget shows it: what its row in a list leads with, then
 * its second line, and both as VoiceOver reads them, all as the Entry row
 * says them.
 */
function widgetEntry(entry: ShownEntry): WidgetEntry {
  const row = buildEntryRow(entry);
  return {
    kind: entry.kind,
    id: row.entryId,
    headline: row.title,
    secondLine: row.secondLine,
    voiceOver: row.spoken,
  };
}

/**
 * A Synonym Row or a Tip as the widget shows it: the title and the body its
 * notification would have, cut like a notification body, and both as VoiceOver
 * reads them. Notifications themselves carry Words only (ADR 0051).
 */
function widgetRowOrTip(
  entry: SynonymRow | Tip,
  strings: EditionStrings['notificationBody'],
): WidgetEntry {
  const { title, body } = notificationText(entry, strings);
  return {
    kind: entry.kind,
    id: entry.id,
    headline: title,
    secondLine: body,
    voiceOver: `${withoutStress(title)}, ${withoutStress(body)}`,
  };
}

const isRowOrTip = (entry: Entry): entry is SynonymRow | Tip =>
  entry.kind === 'synonymRow' || entry.kind === 'tip';

/**
 * The local date on which History last kept a Word of the Day Seen, or
 * nothing when it keeps none.
 */
function wordOfTheDaySeenOn(history: History, clock: Clock): string | undefined {
  const seen = history.list.find(({ wordOfTheDay }) => wordOfTheDay);
  return seen === undefined ? undefined : dateKeyOf(localDayOf(seen.seenAt, clock).date);
}

type GoalRing = NonNullable<WidgetSnapshot['goalRing']>;

/** The goal ring the widget shows now, or none while it is off or hidden. */
async function goalRingOf({
  edition,
  xpLog,
  progress,
  activeDays,
  userState,
  clock,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  xpLog: Pick<XpLog, 'state'>;
  progress: Pick<Progress, 'state'>;
  activeDays: Pick<ActiveDays, 'streakTomorrow'>;
  userState: Pick<UserState, 'read'>;
  clock: Clock;
}): Promise<GoalRing | undefined> {
  const on = edition.isFeatureEnabled.bind(edition);
  const { dailyGoal, today } = xpLog.state;
  if (!on('widgetGoalRing') || !on('xpLog') || dailyGoal === null) return undefined;
  const hidden = (await userState.read(userStateRecords.noCounters)) === true;
  if (hidden && on('noCounters')) return undefined;
  const ring = { on: todayKey(clock), xp: today, goal: dailyGoal.goal, met: dailyGoal.met };
  // The next day starts empty, and a missed day breaks the Streak only once it ends (ADR 0066).
  const after = { xp: 0, met: false };
  return on('statistics') && !hidden
    ? {
        ...ring,
        streak: progress.state.streak,
        after: { ...after, streak: activeDays.streakTomorrow },
      }
    : { ...ring, after };
}

/**
 * The widget over the composition's Entries, Favorites, Collections, History
 * and onboarding. `opened` is the composition's step for an Entry opened from
 * outside the app, which a notification shares.
 */
export function createWidget({
  edition,
  entries,
  favorites,
  collections,
  history,
  onboarding,
  xpLog,
  progress,
  activeDays,
  userState,
  clock,
  opened,
}: {
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  entries: Entries;
  favorites: Favorites;
  collections: Collections;
  history: History;
  onboarding: Onboarding;
  xpLog: Pick<XpLog, 'state'>;
  progress: Pick<Progress, 'state'>;
  activeDays: Pick<ActiveDays, 'streakTomorrow'>;
  userState: Pick<UserState, 'read'>;
  clock: Clock;
  opened: Widget['opened'];
}): Widget {
  return {
    async snapshot(strings) {
      if (!edition.isFeatureEnabled('widget')) return undefined;
      const eligible = await eligibleWidgetEntries(entries, strings);
      const eligibleIds = new Set(eligible.map(({ id }) => id));
      const onlyEligible = (kept: readonly { entryId: string }[]) =>
        kept.map(({ entryId }) => entryId).filter((id) => eligibleIds.has(id));
      const seenOn = edition.isFeatureEnabled('wordOfTheDay')
        ? wordOfTheDaySeenOn(history, clock)
        : undefined;
      const goalRing = await goalRingOf({
        edition,
        xpLog,
        progress,
        activeDays,
        userState,
        clock,
      });
      return {
        format: WIDGET_SNAPSHOT_FORMAT,
        editionId: edition.id,
        writtenAt: clock.now().toISOString(),
        onboardingFinished: onboarding.state.finishedAt !== undefined,
        entries: eligible,
        allEntries: eligible.map(({ id }) => id),
        favorites: onlyEligible(favorites.list),
        collections: collections.list.map(({ id, name }) => ({
          id,
          name,
          entryIds: onlyEligible(collections.entries(id)),
        })),
        ...(seenOn === undefined ? {} : { wordOfTheDaySeenOn: seenOn }),
        ...(goalRing === undefined ? {} : { goalRing }),
        ...(edition.isFeatureEnabled('lockScreenWidget') ? { lockScreenWidget: true } : {}),
      };
    },
    opened,
  };
}

/**
 * Every Eligible Entry as the widget shows it, each once, Words, Corrections
 * and Idioms first, then Synonym Rows and Tips, each kind in the order
 * `eligible` gives. The Spotlight Snapshot shows its Entries the same way.
 */
export async function eligibleWidgetEntries(
  entries: Entries,
  strings: EditionStrings['notificationBody'],
): Promise<WidgetEntry[]> {
  const [words, corrections, idioms, { synonymRows, tips }] = await Promise.all([
    entries.eligibleOfKind('word'),
    entries.eligibleOfKind('correction'),
    entries.eligibleOfKind('idiom'),
    entries.eligible(),
  ]);
  const rowOrTipIds = [...synonymRows, ...tips];
  const read = await entries.getManyOfAnyKind(rowOrTipIds);
  // In the order `eligible` gives, whatever order the Language Pack reads them in.
  const rowsAndTips = rowOrTipIds.flatMap((id) => {
    const entry = read.get(id);
    return entry !== undefined && isRowOrTip(entry) ? [entry] : [];
  });
  return [
    ...[...entriesOf(words), ...entriesOf(corrections), ...entriesOf(idioms)].map(widgetEntry),
    ...rowsAndTips.map((entry) => widgetRowOrTip(entry, strings)),
  ];
}
