import {
  ONBOARDING_STEPS as STEPS,
  type CountedQuestion,
  type DailyGoal,
  type FeatureSwitch,
  type NotificationTimeBucket,
  type OnboardingStepKind,
  type QuestionnaireQuestion,
} from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import type { Mix } from '../entries/mix';
import type { Notifications } from '../notifications/notifications';
import { buildWordCard, type WordCardModel } from '../entries/word-card';
import type { Feed } from '../feed/feed';
import type { WordOfTheDay } from '../feed/word-of-the-day';
import { createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Backend, Clock } from '../ports';
import type { XpLog } from '../progress/xp-log';
import {
  sharesStatistics,
  statisticsConsentPending,
  type StatisticsConsent,
} from '../statistics/statistics-consent';
import {
  applyAnswer,
  dailyGoalAsked,
  type QuestionnaireOption,
} from '../questionnaire/questionnaire';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** The Feature Switch each step is shown under; a step not named here is shown under none. */
const STEP_SWITCH: Partial<Record<OnboardingStepKind, FeatureSwitch>> = {
  voiceStep: 'voiceStep',
  playStep: 'playStep',
  level: 'questionnaire',
  why: 'questionnaire',
  dailyGoal: 'dailyGoal',
  notificationTime: 'notificationTimeStep',
};

/** The buckets of the times «Коли нагадати?» offers, in time order. */
const OFFERED = ['morning', 'midday', 'evening'] as const;

/** Where a step stands among the steps, for the progress the UI draws. */
interface StepPlace {
  /** The step's number, from 1. */
  readonly number: number;
  /** How many steps the onboarding has. */
  readonly total: number;
}

/**
 * The step on screen, with what it shows. The Edition's other strings and
 * the look stay with the UI: the step gives data only.
 */
export type OnboardingStep =
  | (StepPlace & {
      readonly kind: 'welcome';
      /**
       * Whether the welcome says in one line that the anonymous statistics are
       * on and where to turn them off (ADR 0210): for a reader not asked while
       * the `statisticsConsent` Feature Switch is on, as long as they share.
       */
      readonly statisticsLine: boolean;
    })
  /**
   * The Statistics consent (ADR 0210): two equal choices, to allow the
   * anonymous statistics or not. Only a reader to ask who has not chosen gets it.
   */
  | (StepPlace & { readonly kind: 'statisticsConsent' })
  /** Today's Word of the Day, the reader's first Word, with its Pronunciation on the card. */
  | (StepPlace & { readonly kind: 'firstWord'; readonly word: WordCardModel })
  /** «ГОЛОС», where the shell lets the reader choose the Narrator Voice; going on keeps it as it is. */
  | (StepPlace & { readonly kind: 'voiceStep' })
  /** «ГРАЙ!», which shows the Games; it asks nothing. */
  | (StepPlace & { readonly kind: 'playStep' })
  /** «Рівень» or «Навіщо», with the Edition's options; going on without an answer keeps the defaults. */
  | (StepPlace & {
      readonly kind: QuestionnaireQuestion;
      readonly options: readonly QuestionnaireOption[];
    })
  /** The Daily Goal, with the goals to pick from and the one highlighted. */
  | (StepPlace & {
      readonly kind: 'dailyGoal';
      readonly goals: readonly DailyGoal[];
      readonly highlighted: DailyGoal;
    })
  /** «Коли нагадати?», with the times it offers; «Інший час» picks any other. */
  | (StepPlace & { readonly kind: 'notificationTime'; readonly times: readonly string[] })
  /**
   * The Rarity Test, opened by «Не знаю» on «Рівень» and numbered as that
   * step; going on from it goes to the step after «Рівень».
   */
  | (StepPlace & { readonly kind: 'rarityTest' });

/**
 * Where the onboarding stands: open on the step on screen, or finished as of
 * when the reader finished or skipped it, after which it never opens again.
 */
export type OnboardingState =
  | { readonly status: 'open'; readonly step: OnboardingStep }
  | { readonly status: 'finished'; readonly finishedAt: Date };

/**
 * The onboarding: the welcome, the Statistics consent for a reader to ask, the first Word, «ГОЛОС», «ГРАЙ!», «Рівень» (whose
 * «Не знаю» opens the Rarity Test) and «Навіщо», the Daily Goal, «Коли
 * нагадати?», then the Feed; and whether the reader finished
 * it, which is also when they skipped it. It opens on launch until then, at
 * the welcome, and never again after, so a reader who finished the old
 * onboarding sees none. The step on screen is not kept: closing the app
 * halfway starts over at the welcome. Read from the user state once, when it
 * opens, so open one per app session (the Core composition does).
 *
 * One tap ends a step: from the moment a call starts to end the step until
 * the next step is on screen, every other call does nothing, so a second tap
 * never skips a step. After a call that fails, the step takes a tap again.
 */
export interface Onboarding {
  /**
   * Where the onboarding stands. A change never edits it: it makes a new one
   * and tells the subscribers, so it stays the same object until something
   * changes.
   */
  readonly state: OnboardingState;
  /**
   * Goes on to the next step without an answer, so a question skipped keeps
   * the defaults and the Daily Goal stays as it is. Past the last step it finishes.
   * Going on from the first Word («Беру!») makes that Word Seen then, whether
   * or not the onboarding is finished later; the skip on that step does not.
   */
  next(): Promise<void>;
  /**
   * Answers the question on screen with the option `answerId` and goes on:
   * «Рівень» sets nothing, or with «Не знаю» opens the Rarity Test,
   * and «Навіщо» sets the Mix kind weights by the Edition's mapping. The answer is counted by the backend with no reader id
   * while the reader shares their anonymous statistics; a count that fails is
   * lost. An id that is no option, or another step on screen, does nothing.
   */
  answer(answerId: string): Promise<void>;
  /**
   * Sets the Daily Goal the reader picked on its step and goes on. The goal is
   * counted as `answer` is, and a goal step left unanswered as `none`. Another
   * step on screen does nothing.
   */
  chooseDailyGoal(goal: DailyGoal): Promise<void>;
  /**
   * Answers «Коли нагадати?» with the reader's time, or with nothing for «Без
   * нагадувань», through Notifications, and goes on once the device answered
   * the permission, a refusal too. The time is counted as `answer` is, by its
   * bucket (`morning`, `midday`, `evening` for the times offered, `other`, or
   * `none` for nothing or the step left unanswered). Another step on screen
   * does nothing.
   */
  chooseNotificationTime(time: string | undefined): Promise<void>;
  /**
   * Answers the Statistics consent and goes on: sets «Ділитися анонімною
   * статистикою» to the reader's choice, on or off, which «Конфіденційність»
   * changes later. Nothing is sent before it, and not allowing sends nothing,
   * the switch-off unit neither (ADR 0163, 0210). Going on or finishing
   * without it keeps the switch off and never asks again. Another step on
   * screen does nothing.
   */
  chooseStatistics(share: boolean): Promise<void>;
  /**
   * Finishes the onboarding as of now, for the skip on every step: what is
   * not answered keeps its default. Closing the app before this leaves the
   * onboarding unfinished.
   */
  finish(): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { onboardingFinished, firstWeekFrom, shareCounters } = userStateRecords;

/**
 * Opens the onboarding over the user state, for the Core composition, once
 * today's Word of the Day is chosen. The answers change the composition's
 * Mix, the Daily Goal its XP log; `backend` counts the answers, none without it.
 */
export async function openOnboarding({
  edition,
  userState,
  clock,
  entries,
  wordOfTheDay,
  feed,
  mix,
  xpLog,
  analytics,
  backend,
  notifications,
  consent,
}: {
  edition: Pick<
    Edition,
    'id' | 'isFeatureEnabled' | 'questionnaire' | 'dailyGoals' | 'onboardingNotificationTimes'
  >;
  userState: UserState;
  clock: Clock;
  entries: Pick<
    Entries,
    'get' | 'getMany' | 'linkedCorrections' | 'categories' | 'linkingSynonymRow'
  >;
  wordOfTheDay: Pick<WordOfTheDay, 'chosen'>;
  /** Makes the first Word Seen as «Розкрий слово» does, when the reader goes on from its step. */
  feed: Pick<Feed, 'seeWordOfTheDay'>;
  mix: Pick<Mix, 'setKindWeight'>;
  xpLog: Pick<XpLog, 'setDailyGoal'>;
  analytics: Pick<Analytics, 'track'>;
  backend: Pick<Backend, 'counters'> | undefined;
  notifications: Pick<Notifications, 'chooseOnboardingTime'>;
  /** The Statistics consent of this device (ADR 0210); without it, no one is asked. */
  consent?: StatisticsConsent | undefined;
}): Promise<Onboarding> {
  const subscribers = createSubscribers();
  const finished = await userState.read(onboardingFinished);
  const { questionnaire, onboardingNotificationTimes } = edition;
  const offeredTimes = OFFERED.map((bucket) => onboardingNotificationTimes[bucket]);
  /** The bucket a time chosen on «Коли нагадати?» is counted in; nothing is `none`. */
  const bucketOf = (time: string | undefined): NotificationTimeBucket =>
    time === undefined
      ? 'none'
      : (OFFERED.find((bucket) => onboardingNotificationTimes[bucket] === time) ?? 'other');
  const wordId = wordOfTheDay.chosen()?.wordId;
  const word = wordId === undefined ? undefined : await entries.get(wordId);
  const firstWord = word?.kind === 'word' ? await buildWordCard({ word, entries }) : undefined;
  const asksConsent = await statisticsConsentPending(userState, consent);
  const statisticsLine =
    !asksConsent &&
    edition.isFeatureEnabled('statisticsConsent') &&
    (await sharesStatistics(userState, consent));
  const steps = STEPS.filter((kind) => {
    const feature = STEP_SWITCH[kind];
    return (
      (kind !== 'statisticsConsent' || asksConsent) &&
      (kind !== 'firstWord' || firstWord !== undefined) &&
      (feature === undefined || edition.isFeatureEnabled(feature))
    );
  });

  function stepAt(index: number): OnboardingStep | undefined {
    const place = { number: index + 1, total: steps.length };
    const kind = steps[index];
    if (kind === undefined) return undefined;
    if (kind === 'welcome') return { kind, ...place, statisticsLine };
    if (kind === 'statisticsConsent' || kind === 'voiceStep' || kind === 'playStep')
      return { kind, ...place };
    if (kind === 'firstWord' && firstWord !== undefined) return { kind, ...place, word: firstWord };
    if (kind === 'dailyGoal') {
      return {
        kind,
        ...place,
        goals: edition.dailyGoals.options,
        highlighted: edition.dailyGoals.highlighted,
      };
    }
    if (kind === 'notificationTime') return { kind, ...place, times: offeredTimes };
    if (kind === 'level') {
      const options = questionnaire.level.filter(
        (option) => !('rarityTest' in option) || edition.isFeatureEnabled('rarityTest'),
      );
      return { kind, ...place, options: options.map(({ id, label }) => ({ id, label })) };
    }
    if (kind === 'why') {
      return {
        kind,
        ...place,
        options: questionnaire.why.map(({ id, label }) => ({ id, label })),
      };
    }
    return undefined;
  }

  /** Emits an event; a failure is lost, never thrown. */
  const viewed = (step: OnboardingStep): void => {
    analytics.track('onboardingStepViewed', { step: step.kind }).catch(() => undefined);
  };

  // The welcome is always the first step: no switch leaves it out.
  let state: OnboardingState =
    finished === undefined
      ? {
          status: 'open',
          step: { kind: 'welcome', number: 1, total: steps.length, statisticsLine },
        }
      : { status: 'finished', finishedAt: new Date(finished) };
  if (state.status === 'open') viewed(state.step);

  function change(changed: OnboardingState): void {
    state = changed;
    subscribers.tell();
  }

  /** Whether a call is ending the step on screen, so every other call does nothing. */
  let ending = false;
  /** Ends the step on screen with `end`, unless another call is ending it or it is finished. */
  async function endStep(end: (step: OnboardingStep) => Promise<void>): Promise<void> {
    if (ending || state.status === 'finished') return;
    ending = true;
    try {
      await end(state.step);
    } finally {
      ending = false;
    }
  }

  async function keepFinished(skipped: boolean): Promise<void> {
    const finishedAt = clock.now();
    // The first week counts from this day.
    await userState.write(
      new Map([
        ...onboardingFinished.change(finishedAt.toISOString()),
        ...firstWeekFrom.change(todayKey(clock)),
        // A reader asked the Daily Goal here gets no later Feed Notice for it.
        ...(steps.includes('dailyGoal') ? await dailyGoalAsked(userState) : []),
      ]),
    );
    change({ status: 'finished', finishedAt });
    analytics.track('onboardingFinished', { skipped }).catch(() => undefined);
  }

  function show(step: OnboardingStep): void {
    change({ status: 'open', step });
    viewed(step);
  }

  /** Goes on from the step of `kind` to the next one, or finishes past the last; the Rarity Test goes on as «Рівень». */
  async function goOn(kind: OnboardingStep['kind']): Promise<void> {
    const step = stepAt(steps.indexOf(kind === 'rarityTest' ? 'level' : kind) + 1);
    if (step === undefined) {
      await keepFinished(false);
      return;
    }
    show(step);
  }

  /** Whether `answerId` is the «Рівень» option that opens the Rarity Test, while the test is on. */
  const opensRarityTest = (answerId: string): boolean =>
    edition.isFeatureEnabled('rarityTest') &&
    questionnaire.level.some((option) => option.id === answerId && 'rarityTest' in option);

  /** Counts the answer on the backend with no reader id while the reader shares; a failure is lost. */
  async function count(question: CountedQuestion, answer: string): Promise<void> {
    if (backend === undefined || !(await sharesStatistics(userState, consent))) return;
    void backend.counters
      .questionnaire({ editionId: edition.id, question, answer })
      .catch(() => undefined);
  }

  /** Counts `none` for the Daily Goal or «Коли нагадати?» when the reader leaves it unanswered. */
  async function countSkipped(kind: OnboardingStep['kind']): Promise<void> {
    if (kind === 'dailyGoal' || kind === 'notificationTime') await count(kind, 'none');
  }

  return {
    get state() {
      return state;
    },
    next: () =>
      endStep(async ({ kind }) => {
        // «Беру!» takes the first Word, so it is Seen: XP, History and the Daily Goal count it.
        if (kind === 'firstWord') await feed.seeWordOfTheDay();
        await countSkipped(kind);
        await goOn(kind);
      }),
    answer: (answerId) =>
      endStep(async ({ kind, number, total }) => {
        if (kind !== 'level' && kind !== 'why') return;
        const rarityTest = kind === 'level' && opensRarityTest(answerId);
        if (!rarityTest && !(await applyAnswer({ edition, userState, mix }, kind, answerId)))
          return;
        await count(kind, answerId);
        analytics
          .track('questionnaireAnswered', { question: kind, answer: answerId })
          .catch(() => undefined);
        if (rarityTest) show({ kind: 'rarityTest', number, total });
        else await goOn(kind);
      }),
    chooseDailyGoal: (goal) =>
      endStep(async ({ kind }) => {
        if (kind !== 'dailyGoal') return;
        await xpLog.setDailyGoal(goal);
        await count(kind, String(goal));
        await goOn(kind);
      }),
    chooseNotificationTime: (time) =>
      endStep(async ({ kind }) => {
        if (kind !== 'notificationTime') return;
        await notifications.chooseOnboardingTime(time);
        await count(kind, bucketOf(time));
        await goOn(kind);
      }),
    chooseStatistics: (share) =>
      endStep(async ({ kind }) => {
        if (kind !== 'statisticsConsent') return;
        await userState.write(shareCounters.change(share));
        await goOn(kind);
      }),
    finish: () =>
      endStep(async ({ kind }) => {
        await countSkipped(kind);
        await keepFinished(true);
      }),
    subscribe: subscribers.subscribe,
  };
}
