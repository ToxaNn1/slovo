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
import { dateKeyOf, localDayOf } from '../local-date';
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
   * clock's time zone, while the Edition has the Word of the Day.
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
  clock,
  opened,
}: {
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  entries: Entries;
  favorites: Favorites;
  collections: Collections;
  history: History;
  onboarding: Onboarding;
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
