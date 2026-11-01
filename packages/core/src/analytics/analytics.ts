import type {
  EntryKind,
  OnboardingStepKind,
  QuestionnaireQuestion,
  Rarity,
} from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { NotificationKind } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** Which Share Card the reader shared, as its Analytics event says (ADR 0068). */
export type ShareCardKind =
  'entry' | 'weeklyRecap' | 'level' | 'badge' | 'streak' | 'dailyCrossword';

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
  /** A held Streak freeze covered a missed day; the freezes held after it. */
  readonly freezeUsed: { readonly freezesHeld: number };
  /** A missed day with no freeze reset the Streak; the Streak it broke. */
  readonly streakBroken: { readonly streak: number };
  /** The reader started a Break of `days`. */
  readonly breakStarted: { readonly days: number };
  /** The reader solved the Daily Crossword of the local date. */
  readonly dailyCrosswordSolved: { readonly date: string };
  /** The reader answered an Entry due for Review. */
  readonly reviewAnswered: { readonly mark: 'known' | 'unknown' };
  /** The reader answered a Quick Question in the Feed, right or not. */
  readonly quickQuestionAnswered: { readonly right: boolean };
  /** The reader reached a new Level (ADR 0066). */
  readonly levelReached: { readonly level: number };
  /** The reader changed the Daily Goal (ADR 0066). */
  readonly dailyGoalChanged: { readonly goal: number };
  /** Today's Daily Goal was met. */
  readonly dailyGoalMet: { readonly goal: number };
  /** An onboarding step came on screen (ADR 0067). */
  readonly onboardingStepViewed: { readonly step: OnboardingStepKind };
  /** The onboarding finished, past its last step or skipped. */
  readonly onboardingFinished: { readonly skipped: boolean };
  /** The reader answered «Хто ви» (`who`) or «Навіщо» (`why`) with an option's id. */
  readonly questionnaireAnswered: {
    readonly question: QuestionnaireQuestion;
    readonly answer: string;
  };
  /** The reader earned a Badge (ADR 0066). */
  readonly badgeEarned: { readonly badge: string };
  /** The reader sent a Share Card from the system share sheet. */
  readonly shareCardShared: { readonly card: ShareCardKind };
  /** The reader opened the app from a notification of this kind. */
  readonly notificationOpened: { readonly kind: NotificationKind };
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
