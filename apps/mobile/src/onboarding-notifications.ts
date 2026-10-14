import {
  notificationBody,
  type FeedCard,
  type Notifications,
  type Onboarding,
  type WordCardModel,
} from '@slovo/core';

/** The notification the onboarding's last step shows as a sample. */
export interface SampleNotification {
  /** The Word's card: the sample shows its Lemma with Stress. */
  readonly wordCard: WordCardModel;
  /** The body the real notification has: the primary Definition, cut when long. */
  readonly body: string;
  /** The earliest Notification time, when it would come; nothing with no time left. */
  readonly time: string | undefined;
}

/**
 * The sample notification of the onboarding's last step: the notification
 * the Word of the Day would be, which is the first Word card the Feed has
 * (as the welcome's hero Word), with the body cut the way the plan cuts it.
 * Nothing when the Feed has no Word card.
 */
export function sampleNotificationOf({
  cards,
  times,
  ellipsis,
}: {
  cards: readonly FeedCard[];
  /** The Notification times, in time order. */
  times: readonly string[];
  ellipsis: string;
}): SampleNotification | undefined {
  const card = cards.find((candidate) => candidate.kind === 'word');
  if (card === undefined) return undefined;
  const { wordCard } = card;
  return {
    wordCard,
    body: notificationBody(wordCard.primaryDefinition, ellipsis),
    time: times[0],
  };
}

/**
 * «Дозволити сповіщення»: asks iOS for permission through the scheduler, then
 * finishes the onboarding. It finishes whatever the answer, and even when
 * asking fails or nothing can ask (a binary without the module): the reader
 * chose to go on, and the times stay for Settings › Сповіщення.
 */
export async function allowNotifications({
  notifications,
  onboarding,
}: {
  notifications: Pick<Notifications, 'askPermission'>;
  onboarding: Pick<Onboarding, 'finish'>;
}): Promise<void> {
  try {
    await notifications.askPermission();
  } catch (error) {
    console.error('Could not ask for permission to notify', error);
  }
  await onboarding.finish();
}

/** «Пізніше»: finishes the onboarding without asking */
export async function postponeNotifications({
  onboarding,
}: {
  onboarding: Pick<Onboarding, 'finish'>;
}): Promise<void> {
  await onboarding.finish();
}
