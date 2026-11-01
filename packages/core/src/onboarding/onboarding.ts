import {
  ONBOARDING_STEPS as STEPS,
  type DailyGoal,
  type OnboardingStepKind,
  type QuestionnaireQuestion,
} from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { MIX_KINDS } from '../entries/entry-kinds';
import type { Mix } from '../entries/mix';
import { buildWordCard, type WordCardModel } from '../entries/word-card';
import type { WordOfTheDay } from '../feed/word-of-the-day';
import { createSubscribers } from '../in-turn';
import { todayKey } from '../local-date';
import type { Backend, Clock } from '../ports';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** The Daily Goals the reader picks from. */
const DAILY_GOALS: readonly DailyGoal[] = [10, 20, 30, 50];

/** Where a step stands among the steps, for the progress the UI draws. */
interface StepPlace {
  /** The step's number, from 1. */
  readonly number: number;
  /** How many steps the onboarding has. */
  readonly total: number;
}

/** An option of a questionnaire question: its id and the Edition's label. */
export interface QuestionnaireOption {
  readonly id: string;
  readonly label: string;
}

/**
 * The step on screen, with what it shows. The Edition's other strings and
 * the look stay with the UI: the step gives data only.
 */
export type OnboardingStep =
  | (StepPlace & { readonly kind: 'welcome' })
  /** Today's Word of the Day, the reader's first Word, with its Pronunciation on the card. */
  | (StepPlace & { readonly kind: 'firstWord'; readonly word: WordCardModel })
  /** «Хто ви» or «Навіщо», with the Edition's options; going on without an answer keeps the defaults. */
  | (StepPlace & {
      readonly kind: QuestionnaireQuestion;
      readonly options: readonly QuestionnaireOption[];
    })
  /** The Daily Goal, with the goals to pick from and the one highlighted. */
  | (StepPlace & {
      readonly kind: 'dailyGoal';
      readonly goals: readonly DailyGoal[];
      readonly highlighted: DailyGoal;
    });

/** Where the onboarding stands. */
export interface OnboardingState {
  /** When the reader finished or skipped it; nothing while it still opens on launch. */
  readonly finishedAt: Date | undefined;
  /** The step on screen while it is open; nothing once it is finished. */
  readonly step: OnboardingStep | undefined;
}

/**
 * The onboarding (ADR 0067): the welcome, the first Word, «Хто ви» and
 * «Навіщо», the Daily Goal, then the Feed; and whether the reader finished
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
   */
  next(): Promise<void>;
  /**
   * Answers the question on screen with the option `answerId` and goes on:
   * «Хто ви» sets the Rarity Ceiling and «Навіщо» the Mix kind weights by the
   * Edition's mapping. The answer is counted by the backend with no reader id
   * while the reader shares their anonymous statistics; a count that fails is
   * lost. An id that is no option, or another step on screen, does nothing.
   */
  answer(answerId: string): Promise<void>;
  /** Sets the Daily Goal the reader picked on its step and goes on. Another step on screen does nothing. */
  chooseDailyGoal(goal: DailyGoal): Promise<void>;
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
  mix,
  xpLog,
  analytics,
  backend,
}: {
  edition: Pick<Edition, 'id' | 'isFeatureEnabled' | 'questionnaire' | 'userSettingDefaults'>;
  userState: UserState;
  clock: Clock;
  entries: Pick<
    Entries,
    'get' | 'getMany' | 'linkedCorrections' | 'categories' | 'linkingSynonymRow' | 'illustrationOf'
  >;
  wordOfTheDay: Pick<WordOfTheDay, 'chosen'>;
  mix: Pick<Mix, 'setRarityCeiling' | 'setKindWeight'>;
  xpLog: Pick<XpLog, 'setDailyGoal'>;
  analytics: Pick<Analytics, 'track'>;
  backend: Pick<Backend, 'counters'> | undefined;
}): Promise<Onboarding> {
  const subscribers = createSubscribers();
  const finished = await userState.read(onboardingFinished);
  const { questionnaire } = edition;
  const wordId = wordOfTheDay.chosen()?.wordId;
  const word = wordId === undefined ? undefined : await entries.get(wordId);
  const firstWord = word?.kind === 'word' ? await buildWordCard({ word, entries }) : undefined;
  const steps = STEPS.filter(
    (kind) =>
      (kind !== 'firstWord' || firstWord !== undefined) &&
      ((kind !== 'who' && kind !== 'why') || edition.isFeatureEnabled('questionnaire')) &&
      (kind !== 'dailyGoal' || edition.isFeatureEnabled('dailyGoal')),
  );

  function stepAt(index: number): OnboardingStep | undefined {
    const place = { number: index + 1, total: steps.length };
    const kind = steps[index];
    if (kind === undefined) return undefined;
    if (kind === 'welcome') return { kind, ...place };
    if (kind === 'firstWord' && firstWord !== undefined) return { kind, ...place, word: firstWord };
    if (kind === 'dailyGoal') {
      return {
        kind,
        ...place,
        goals: DAILY_GOALS,
        highlighted: edition.userSettingDefaults.dailyGoal,
      };
    }
    if (kind === 'who' || kind === 'why') {
      return {
        kind,
        ...place,
        options: questionnaire[kind].map(({ id, label }) => ({ id, label })),
      };
    }
    return undefined;
  }

  /** Emits an event; a failure is lost, never thrown. */
  const viewed = (step: OnboardingStep | undefined): void => {
    if (step === undefined) return;
    analytics.track('onboardingStepViewed', { step: step.kind }).catch(() => undefined);
  };

  let state: OnboardingState =
    finished === undefined
      ? { finishedAt: undefined, step: stepAt(0) }
      : { finishedAt: new Date(finished), step: undefined };
  if (finished === undefined) viewed(state.step);

  function change(changed: OnboardingState): void {
    state = changed;
    subscribers.tell();
  }

  /** Whether a call is ending the step on screen, so every other call does nothing. */
  let ending = false;
  /** Ends the step on screen with `end`, unless another call is ending it or it is finished. */
  async function endStep(end: (step: OnboardingStep) => Promise<void>): Promise<void> {
    if (ending || state.step === undefined) return;
    ending = true;
    try {
      await end(state.step);
    } finally {
      ending = false;
    }
  }

  async function keepFinished(skipped: boolean): Promise<void> {
    const finishedAt = clock.now();
    // The first week counts from this day (ADR 0054).
    await userState.write(
      new Map([
        ...onboardingFinished.change(finishedAt.toISOString()),
        ...firstWeekFrom.change(todayKey(clock)),
      ]),
    );
    change({ finishedAt, step: undefined });
    analytics.track('onboardingFinished', { skipped }).catch(() => undefined);
  }

  /** Goes on from the step of `kind` to the next one, or finishes past the last. */
  async function goOn(kind: OnboardingStepKind): Promise<void> {
    const step = stepAt(steps.indexOf(kind) + 1);
    if (step === undefined) {
      await keepFinished(false);
      return;
    }
    change({ ...state, step });
    viewed(step);
  }

  /** Counts the answer on the backend with no reader id while the reader shares; a failure is lost. */
  async function count(question: QuestionnaireQuestion, answer: string): Promise<void> {
    if (backend === undefined || (await userState.read(shareCounters)) === false) return;
    void backend.counters
      .questionnaire({ editionId: edition.id, question, answer })
      .catch(() => undefined);
  }

  async function apply(question: QuestionnaireQuestion, answerId: string): Promise<boolean> {
    if (question === 'who') {
      const option = questionnaire.who.find(({ id }) => id === answerId);
      if (option === undefined) return false;
      await mix.setRarityCeiling(option.rarityCeiling);
      return true;
    }
    const option = questionnaire.why.find(({ id }) => id === answerId);
    if (option === undefined) return false;
    for (const kind of MIX_KINDS) {
      const weight = option.kindWeights[kind];
      if (weight !== undefined) await mix.setKindWeight(kind, weight);
    }
    return true;
  }

  return {
    get state() {
      return state;
    },
    next: () => endStep(({ kind }) => goOn(kind)),
    answer: (answerId) =>
      endStep(async ({ kind }) => {
        if (kind !== 'who' && kind !== 'why') return;
        if (!(await apply(kind, answerId))) return;
        await count(kind, answerId);
        analytics
          .track('questionnaireAnswered', { question: kind, answer: answerId })
          .catch(() => undefined);
        await goOn(kind);
      }),
    chooseDailyGoal: (goal) =>
      endStep(async ({ kind }) => {
        if (kind !== 'dailyGoal') return;
        await xpLog.setDailyGoal(goal);
        await goOn(kind);
      }),
    finish: () => endStep(() => keepFinished(true)),
    subscribe: subscribers.subscribe,
  };
}
