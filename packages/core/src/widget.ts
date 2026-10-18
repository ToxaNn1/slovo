import {
  WIDGET_SNAPSHOT_FORMAT,
  type Entry,
  type WidgetEntry,
  type WidgetSnapshot,
} from '@slovo/contracts';

import type { Collections } from './saved/collections';
import type { EligibleOfKind, Entries } from './entries/entries';
import { buildEntryRow } from './entries/entry-row';
import type { Favorites } from './saved/favorites';
import type { EntryFeedCard } from './feed/feed-card';
import type { Edition } from './edition/edition';
import type { Onboarding } from './onboarding';
import type { Clock } from './ports';
import { withoutStress } from './entries/stress';

/**
 * What the home-screen widget shows, decided by the Core, so the widget holds
 * no rule of its own, and what opening an Entry from it does (ADR 0026).
 */
export interface Widget {
  /**
   * The Widget Snapshot of the user state as it is now, for the app to write
   * into the App Group: every Widget Mode with only Eligible Entries in it
   * (ADR 0015), and each of those Entries once, with its text ready to show.
   * Pure data; the contracts serialize it. Nothing while the widget's
   * Feature Switch is off, by its effective value at the time of the call: the
   * app writes no new snapshot and the widget just stops updating, with no
   * placeholder (ADR 0026).
   */
  snapshot(): Promise<WidgetSnapshot | undefined>;
  /**
   * Opens an Entry the widget showed, a Word or a Correction, by the rule and
   * the one write of an Entry opened from a notification (see
   * `Composition.openedFromNotification`): its Entry card once it is Seen, in
   * History and today is an Active Day. An Entry that isn't eligible or is
   * Seen already in the Cycle only makes today an Active Day. Nothing for an
   * id the Language Pack doesn't have: the Feed opens instead.
   */
  opened(entryId: string): Promise<EntryFeedCard | undefined>;
}

/** The eligible Entries of a kind, or none when the kind as a whole is out. */
const entriesOf = (eligible: EligibleOfKind) => ('entries' in eligible ? eligible.entries : []);

/**
 * An Entry as the widget shows it: what its row in a list leads with, then
 * its second line, and both as VoiceOver reads them.
 */
function widgetEntry(entry: Entry): WidgetEntry {
  const row = buildEntryRow(entry);
  const secondLine = row.kind === 'word' ? row.definition : row.nonStandardForm;
  return {
    kind: row.kind,
    id: row.entryId,
    headline: row.title,
    secondLine,
    voiceOver: `${withoutStress(row.title)}, ${withoutStress(secondLine)}`,
  };
}

/**
 * The widget over the composition's Entries, Favorites, Collections and
 * onboarding. `opened` is the composition's step for an Entry opened from
 * outside the app, which a notification shares.
 */
export function createWidget({
  edition,
  editionId,
  entries,
  favorites,
  collections,
  onboarding,
  clock,
  opened,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  editionId: string;
  entries: Entries;
  favorites: Favorites;
  collections: Collections;
  onboarding: Onboarding;
  clock: Clock;
  opened: Widget['opened'];
}): Widget {
  return {
    async snapshot() {
      if (!edition.isFeatureEnabled('widget')) return undefined;
      const [words, corrections] = await Promise.all([
        entries.eligibleOfKind('word'),
        entries.eligibleOfKind('correction'),
      ]);
      const eligible = [...entriesOf(words), ...entriesOf(corrections)];
      const eligibleIds = new Set(eligible.map(({ id }) => id));
      const onlyEligible = (kept: readonly { entryId: string }[]) =>
        kept.map(({ entryId }) => entryId).filter((id) => eligibleIds.has(id));
      return {
        format: WIDGET_SNAPSHOT_FORMAT,
        editionId,
        writtenAt: clock.now().toISOString(),
        onboardingFinished: onboarding.state.finishedAt !== undefined,
        entries: eligible.map(widgetEntry),
        allEntries: eligible.map(({ id }) => id),
        favorites: onlyEligible(favorites.list),
        collections: collections.list.map(({ id, name }) => ({
          id,
          name,
          entryIds: onlyEligible(collections.entries(id)),
        })),
      };
    },
    opened,
  };
}
