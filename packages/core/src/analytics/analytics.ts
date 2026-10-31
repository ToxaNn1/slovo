import type { EntryKind, Rarity } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** What an event about one Entry tells of it: its kind, its rarity and its Category, where it has them. */
export interface EntryEventProperties {
  readonly entryKind: EntryKind;
  readonly rarity: Rarity | null;
  readonly categoryId: string | null;
}

/** The Analytics events the Core emits (ADR 0068), each with its properties. */
export interface AnalyticsEvents {
  readonly seen: EntryEventProperties;
  readonly known: EntryEventProperties;
  readonly unknown: EntryEventProperties;
  readonly favoriteAdded: EntryEventProperties;
  readonly favoriteRemoved: EntryEventProperties;
  readonly pronunciationPlayed: EntryEventProperties;
  readonly wordHistoryOpened: EntryEventProperties;
  readonly screenViewed: { readonly screen: string };
  readonly settingChanged: { readonly setting: string; readonly value: string | number | boolean };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

/**
 * Where the Analytics events go: the app shell's PostHog adapter, a fake in
 * tests. The Core calls it only while the reader shares their anonymous
 * statistics and the Edition's `analytics` Feature Switch is on.
 */
export interface AnalyticsPort {
  track<E extends AnalyticsEvent>(event: E, properties: AnalyticsEvents[E]): void;
  /** «Ділитися анонімною статистикою» was turned off: send nothing more and drop what waits. */
  stop(): void;
}

/** The port that sends nothing, for a shell or a tool without Analytics. */
export const noAnalytics: AnalyticsPort = { track: () => undefined, stop: () => undefined };

/** Analytics as the Core uses it: an event goes to the port only while sharing is allowed. */
export interface Analytics {
  track<E extends AnalyticsEvent>(event: E, properties: AnalyticsEvents[E]): Promise<void>;
  /** Tells the port sharing was turned off. */
  stop(): void;
}

/**
 * The one gate of Analytics (ADR 0068): an event reaches the port only while
 * the Edition's `analytics` Feature Switch is on and the reader shares their
 * anonymous statistics, both read at each event; otherwise nothing is sent.
 */
export function createAnalytics({
  edition,
  userState,
  port = noAnalytics,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: Pick<UserState, 'read'>;
  port?: AnalyticsPort | undefined;
}): Analytics {
  return {
    async track(event, properties) {
      if (!edition.isFeatureEnabled('analytics')) return;
      if ((await userState.read(userStateRecords.shareCounters)) === false) return;
      port.track(event, properties);
    },
    stop: () => {
      port.stop();
    },
  };
}
