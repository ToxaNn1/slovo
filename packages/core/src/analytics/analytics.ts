import {
  FeatureSwitchesSchema,
  type EntryKind,
  type FeatureSwitch,
  type OnboardingStepKind,
  type QuestionnaireQuestion,
  type Rarity,
  type Variant,
} from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { RemoteSwitches } from '../edition/remote-switches';
import type { NotificationKind } from '../ports';
import type { LaterQuestion } from '../feed-notice';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** Which Share Card the reader shared, as its Analytics event says (ADR 0068). */
export type ShareCardKind =
  'entry' | 'weeklyRecap' | 'level' | 'badge' | 'streak' | 'dailyCrossword';

/** What an event about one Entry tells of it: its kind, its rarity and its Category, where it has them. */
export interface EntryEventProperties {
  readonly entryKind: EntryKind;
  readonly rarity: Rarity | null;
  readonly categoryId: string | null;
}

/** The Sign-in method of a sign-in: a Sign-in code, Sign in with Google or Sign in with Apple. */
export type SignInMethod = 'signInCode' | 'google' | 'apple';

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
  /** The reader started a Game of the mode. */
  readonly gameStarted: { readonly mode: string };
  /** A Game ended, won or lost: its mode, how long it ran and its result. */
  readonly gameFinished: {
    readonly mode: string;
    readonly durationSeconds: number;
    readonly right: number;
    readonly played: number;
    readonly status: 'won' | 'lost';
  };
  /** The reader solved the Daily Crossword of the local date. */
  readonly dailyCrosswordSolved: { readonly date: string };
  /** The reader answered an Entry due for Review. */
  readonly reviewAnswered: EntryEventProperties & { readonly mark: 'known' | 'unknown' };
  /** The reader answered a Quick Question in the Feed, right or not, about the Entry it asked. */
  readonly quickQuestionAnswered: EntryEventProperties & { readonly right: boolean };
  /** The reader chose a Mood in the Dashboard's Mood check-in, or changed it (ADR 0076). */
  readonly moodChosen: { readonly mood: string };
  /** The reader skipped the Mood check-in with «Не сьогодні». */
  readonly moodSkipped: Record<string, never>;
  /** The reader reached a new Level (ADR 0066). */
  readonly levelReached: { readonly level: number };
  /** The reader changed the Daily Goal (ADR 0074): `null` where «Без цілі» turned it off. */
  readonly dailyGoalChanged: { readonly goal: number | null };
  /** Today's Daily Goal was met. */
  readonly dailyGoalMet: { readonly goal: number };
  /** An onboarding step came on screen (ADR 0067). */
  readonly onboardingStepViewed: { readonly step: OnboardingStepKind | 'rarityTest' };
  /** The onboarding finished, past its last step or skipped. */
  readonly onboardingFinished: { readonly skipped: boolean };
  /** The reader answered «Рівень» (`level`) or «Навіщо» (`why`) with an option's id. */
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
  /**
   * The reader answered a later question's Feed Notice (ADR 0067): an option's
   * id, the Daily Goal, the chosen Category ids joined by commas, `open` for
   * the Rarity Test or the Mix opened, or `later` when put off.
   */
  readonly laterQuestionAnswered: { readonly question: LaterQuestion; readonly answer: string };
  /**
   * A sign-in started this device's Session, by its Sign-in method. The
   * sign-in answer tells no new Account from one there was, so this stands
   * for «Account created» of ADR 0068.
   */
  readonly signedIn: { readonly method: SignInMethod };
  readonly settingChanged: { readonly setting: string; readonly value: string | number | boolean };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

/** The event property that names the Variant of a Feature Switch under test (ADR 0089). */
export type VariantProperty = `variant_${FeatureSwitch}`;

/**
 * Who an event comes from (ADR 0068, 0089): the Install id as the distinct
 * id, and the Variant of every Feature Switch on with one, as event
 * properties. Nothing else of the reader goes with it.
 */
export interface AnalyticsReader {
  readonly distinctId: string;
  readonly variants: Readonly<Partial<Record<VariantProperty, Variant>>>;
}

/**
 * Where the Analytics events go: the app shell's PostHog adapter, a fake in
 * tests. The Core calls it only while the reader shares their anonymous
 * statistics and the Edition's `analytics` Feature Switch is on.
 */
export interface AnalyticsPort {
  track<E extends AnalyticsEvent>(
    event: E,
    properties: AnalyticsEvents[E],
    reader: AnalyticsReader,
  ): void;
  /** «Ділитися анонімною статистикою» was turned off: send nothing more and drop what waits. */
  stop(): void;
}

/** Analytics as the Core uses it: an event goes to the port only while sharing is allowed. */
export interface Analytics {
  track<E extends AnalyticsEvent>(event: E, properties: AnalyticsEvents[E]): Promise<void>;
  /** Tells the port sharing was turned off. */
  stop(): void;
}

/** What the Analytics events say of the reader: the Install id and the verdicts of the remote Feature Switches. */
export type AnalyticsSwitches = Pick<RemoteSwitches<Pick<Edition, 'id'>>, 'installId' | 'verdicts'>;

/** Where the Analytics events go and what they say of the reader; a port never goes without the switches. */
export interface AnalyticsSink {
  readonly port: AnalyticsPort;
  readonly switches: AnalyticsSwitches;
}

const everyFeature = FeatureSwitchesSchema.keyof().options;

/** The reader an event comes from, by the verdicts in effect now. */
function readerOf({ installId, verdicts }: AnalyticsSwitches): AnalyticsReader {
  const variants: Partial<Record<VariantProperty, Variant>> = {};
  for (const feature of everyFeature) {
    const verdict = verdicts[feature];
    if (verdict.on && verdict.variant !== undefined)
      variants[`variant_${feature}`] = verdict.variant;
  }
  return { distinctId: installId, variants };
}

/**
 * The one gate of Analytics (ADR 0068): an event reaches the port only while
 * the Edition's `analytics` Feature Switch is on and the reader shares their
 * anonymous statistics, both read at each event; otherwise nothing is sent,
 * so neither the Install id nor a Variant leaves the device. The Variants are
 * read at each event, so a Rule's change shows on the next one.
 */
export function createAnalytics({
  edition,
  userState,
  sink,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: Pick<UserState, 'read'>;
  sink?: AnalyticsSink | undefined;
}): Analytics {
  return {
    async track(event, properties) {
      if (sink === undefined) return;
      if (!edition.isFeatureEnabled('analytics')) return;
      if ((await userState.read(userStateRecords.shareCounters)) === false) return;
      sink.port.track(event, properties, readerOf(sink.switches));
    },
    stop: () => {
      sink?.port.stop();
    },
  };
}
