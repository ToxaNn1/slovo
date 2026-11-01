import type { DailyGoal, QuestionnaireQuestion } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import { MIX_KINDS } from '../entries/entry-kinds';
import type { Mix } from '../entries/mix';
import { closeNotice, type FeedNotices } from '../feed/feed-notices';
import { LATER_QUESTIONS, type LaterQuestion } from '../feed-notice';
import { dateKeyOf, todayKey } from '../local-date';
import type { Clock } from '../ports';
import type { XpLog } from '../progress/xp-log';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

/** An option of a questionnaire question: its id and the Edition's label. */
export interface QuestionnaireOption {
  readonly id: string;
  readonly label: string;
}

/** A question answered with one of the Edition's options: «Хто ви», «Навіщо» or the self-rating. */
export type OptionQuestion = QuestionnaireQuestion | 'selfRating';

/**
 * The questionnaire (ADR 0067) past the onboarding: the later questions its
 * Feed Notices ask, one a local day, each once, and the retake in Settings.
 * Each answer to a later question closes its Feed Notice for the day and is
 * an Analytics event.
 */
export interface Questionnaire {
  /** The Edition's options of each question answered with an option. */
  readonly options: Readonly<Record<OptionQuestion, readonly QuestionnaireOption[]>>;
  /**
   * Answers the question with the option `answerId`: «Хто ви» sets the
   * Rarity Ceiling, «Навіщо» the Mix kind weights, the self-rating the
   * Rarity Floor, raising the Ceiling to it, and whether the Rarity Test is
   * offered. Resolves to whether `answerId` is an option of it.
   */
  answer(question: OptionQuestion, answerId: string): Promise<boolean>;
  /** Keeps in the Mix the Word Categories of `categoryIds` and hides every other one. */
  chooseInterests(categoryIds: readonly string[]): Promise<void>;
  /** Sets the Daily Goal the reader chose on its Feed Notice. */
  chooseDailyGoal(goal: DailyGoal): Promise<void>;
  /** Tells that the reader opened the Rarity Test or the Mix from its Feed Notice. */
  open(question: 'rarityTest' | 'mixReview'): Promise<void>;
  /** Puts the later question off with «Пізніше»: what it sets stays as it is. */
  later(question: LaterQuestion): Promise<void>;
}

const { laterQuestions, onboardingFinished, firstWeekFrom } = userStateRecords;

interface Deps {
  edition: Pick<Edition, 'isFeatureEnabled' | 'questionnaire'>;
  mix: Pick<Mix, 'setRarityCeiling' | 'setKindWeight' | 'setRarityFloorRaisingCeiling'>;
}

/**
 * Applies the answer `answerId` to the question through the Mix by the
 * Edition's mapping, for the onboarding and the questionnaire. Resolves to
 * whether `answerId` is an option of it.
 */
export async function applyAnswer(
  { edition: { questionnaire }, mix }: Deps,
  question: OptionQuestion,
  answerId: string,
): Promise<boolean> {
  if (question === 'who') {
    const option = questionnaire.who.find(({ id }) => id === answerId);
    if (option !== undefined) await mix.setRarityCeiling(option.rarityCeiling);
    return option !== undefined;
  }
  if (question === 'selfRating') {
    const option = questionnaire.selfRating.find(({ id }) => id === answerId);
    if (option !== undefined) await mix.setRarityFloorRaisingCeiling(option.rarityFloor);
    return option !== undefined;
  }
  const option = questionnaire.why.find(({ id }) => id === answerId);
  if (option === undefined) return false;
  for (const kind of MIX_KINDS) {
    const weight = option.kindWeights[kind];
    if (weight !== undefined) await mix.setKindWeight(kind, weight);
  }
  return true;
}

/**
 * Opens the questionnaire, with the Feed Notices of its later questions, for
 * the Core composition. A later question comes only while the Edition's
 * `laterQuestions` Feature Switch is on, once the onboarding is finished and
 * not on its day. On a local day with none offered yet, the first question
 * not offered before whose feature is on is offered and keeps that day, so it
 * is offered once even when swiped past: the Daily Goal, which the onboarding
 * that asks it marks as offered, so only an existing reader gets it; the
 * interests; the self-rating, with the Rarity Floor on; the Rarity Test,
 * with its feature on and once the self-rating said to offer it; the Mix
 * review.
 */
export function openQuestionnaire({
  edition,
  userState,
  clock,
  mix,
  xpLog,
  analytics,
}: Deps & {
  userState: UserState;
  clock: Clock;
  mix: Pick<Mix, 'state' | 'takeOut' | 'putBack'>;
  xpLog: Pick<XpLog, 'setDailyGoal'>;
  analytics: Pick<Analytics, 'track'>;
}): { questionnaire: Questionnaire; notices: FeedNotices } {
  const on = (feature: Parameters<Edition['isFeatureEnabled']>[0]) =>
    edition.isFeatureEnabled(feature);
  const { questionnaire: options } = edition;

  async function asked() {
    return (await userState.read(laterQuestions)) ?? { asked: [] };
  }

  /** Whether the later question can be offered now, beside the offers before it. */
  function applies(question: LaterQuestion, offerRarityTest: boolean | undefined): boolean {
    if (question === 'dailyGoalChoice') return on('dailyGoal');
    if (question === 'selfRating') return on('rarityFloor');
    if (question === 'rarityTest') return on('rarityTest') && offerRarityTest === true;
    return true;
  }

  /** Closes the later question's Feed Notice for today and emits its answer; a failed event is lost. */
  async function answered(question: LaterQuestion, answer: string): Promise<void> {
    await userState.write(await closeNotice(userState, question, todayKey(clock)));
    analytics.track('laterQuestionAnswered', { question, answer }).catch(() => undefined);
  }

  const notices: FeedNotices = {
    async forDay(day) {
      if (!on('laterQuestions') || (await userState.read(onboardingFinished)) === undefined)
        return [];
      const date = dateKeyOf(day);
      if ((await userState.read(firstWeekFrom)) === date) return [];
      const record = await asked();
      if (record.date === date) {
        const last = record.asked.at(-1);
        return last !== undefined && applies(last, record.offerRarityTest)
          ? [{ notice: last }]
          : [];
      }
      const next = LATER_QUESTIONS.find(
        (question) => !record.asked.includes(question) && applies(question, record.offerRarityTest),
      );
      if (next === undefined) return [];
      await userState.write(
        laterQuestions.change({ ...record, asked: [...record.asked, next], date }),
      );
      return [{ notice: next }];
    },
  };

  const questionnaire: Questionnaire = {
    options: {
      who: options.who.map(({ id, label }) => ({ id, label })),
      why: options.why.map(({ id, label }) => ({ id, label })),
      selfRating: options.selfRating.map(({ id, label }) => ({ id, label })),
    },
    async answer(question, answerId) {
      if (!(await applyAnswer({ edition, mix }, question, answerId))) return false;
      if (question !== 'selfRating') {
        analytics
          .track('questionnaireAnswered', { question, answer: answerId })
          .catch(() => undefined);
        return true;
      }
      const offerRarityTest = options.selfRating.find(({ id }) => id === answerId)?.offerRarityTest;
      await userState.write(laterQuestions.change({ ...(await asked()), offerRarityTest }));
      await answered('selfRating', answerId);
      return true;
    },
    async chooseInterests(categoryIds) {
      // Put back first, so taking out never meets the last Category in the Mix.
      for (const { id } of mix.state.allCategories) {
        if (categoryIds.includes(id)) await mix.putBack(id);
      }
      for (const { id } of mix.state.allCategories) {
        if (!categoryIds.includes(id)) await mix.takeOut(id);
      }
      await answered('interests', categoryIds.join(','));
    },
    async chooseDailyGoal(goal) {
      await xpLog.setDailyGoal(goal);
      await answered('dailyGoalChoice', String(goal));
    },
    open: (question) => answered(question, 'open'),
    later: (question) => answered(question, 'later'),
  };
  return { questionnaire, notices };
}

/** The change that marks the Daily Goal as asked, for the onboarding that asks it. */
export async function dailyGoalAsked(userState: UserState) {
  const record = (await userState.read(laterQuestions)) ?? { asked: [] };
  const dailyGoal: LaterQuestion = 'dailyGoalChoice';
  return laterQuestions.change({ ...record, asked: [...new Set([...record.asked, dailyGoal])] });
}
