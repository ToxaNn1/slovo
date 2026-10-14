import type { Composition, FeedCard, WordCardModel } from '@slovo/core';
import {
  fill,
  OnboardingMix,
  OnboardingNotifications,
  OnboardingWelcome,
  type HeroWord,
  type SampleNotificationLook,
} from '@slovo/ui';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useComposed, useModule } from './composition';
import { editionStrings } from './edition';
import { MixChoices } from './mix-choices';
import { NotificationTimes } from './notification-times';
import { useNotificationsState } from './notifications';
import {
  allowNotifications,
  postponeNotifications,
  sampleNotificationOf,
} from './onboarding-notifications';

/** The steps the onboarding has until the SLOVO ID step joins in 0.7. */
const STEPS = 3;

/** Whether the onboarding is on screen: the composition is open and the reader hasn't finished it. */
export function useOnboardingOpen(): boolean {
  return useComposed(
    (composition) => composition.onboarding,
    ({ state }) => state.finishedAt === undefined,
    false,
  );
}

/** What VoiceOver reads for a Word's Lemma, which says where the Stress falls. */
function lemmaLabelOf({ lemma, stressedVowels }: WordCardModel): string {
  const { stress, stressOr } = editionStrings.wordCard;
  return stressedVowels.length === 0
    ? lemma
    : `${lemma}, ${fill(stress, { vowels: stressedVowels.join(` ${stressOr} `) })}`;
}

/** The Word the welcome shows: the first Word card the Feed has, which is the Word of the Day. */
function heroOf(cards: readonly FeedCard[]): HeroWord | undefined {
  const word = cards.find((card) => card.kind === 'word');
  if (word === undefined) return undefined;
  const { lemma, primaryDefinition } = word.wordCard;
  return {
    lemma,
    accessibilityLabel: lemmaLabelOf(word.wordCard),
    definition: primaryDefinition,
  };
}

/**
 * The onboarding over the Feed, until the reader finishes or skips it. It
 * shows no Feed of its own: the Feed is told no card is on screen while it is
 * open (`useFeed`). Closing the app before it ends leaves it for the next
 * launch.
 */
export function Onboarding() {
  const open = useOnboardingOpen();
  // Modal, so VoiceOver stays out of the Feed and the tabs behind it.
  return open ? (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Steps />
    </View>
  ) : null;
}

/**
 * The steps in order. Mounted only while the onboarding is open, so the Feed's
 * changes don't redraw the closed onboarding. The step the reader is on isn't
 * kept: closing the app halfway starts over at the welcome.
 */
function Steps() {
  const onboarding = useModule((composition) => composition.onboarding);
  const [step, setStep] = useState<'welcome' | 'mix' | 'notifications'>('welcome');

  function finish(): void {
    onboarding?.finish().catch((error: unknown) => {
      console.error('Could not keep that the onboarding is finished', error);
    });
  }

  if (step === 'welcome') {
    return (
      <WelcomeStep
        onStart={() => {
          setStep('mix');
        }}
        onSkip={finish}
      />
    );
  }
  if (step === 'mix') {
    return (
      <OnboardingMix
        total={STEPS}
        onNext={() => {
          setStep('notifications');
        }}
        onSkip={finish}
      >
        <MixChoices />
      </OnboardingMix>
    );
  }
  return <NotificationsStep onSkip={finish} />;
}

/** Step 1, with the hero Word. */
function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const cards = useComposed(
    (composition) => composition.feed,
    (feed) => feed.cards,
    noCards,
  );
  const hero = useMemo(() => heroOf(cards), [cards]);

  return <OnboardingWelcome total={STEPS} hero={hero} onStart={onStart} onSkip={onSkip} />;
}

const noCards: readonly FeedCard[] = [];

const styles = StyleSheet.create({ root: { flex: 1 } });

/**
 * Step 3, with a sample of the Word of the Day's notification and the same
 * Notification times as Settings › Сповіщення. «Дозволити сповіщення» is the
 * app's first and only ask for permission, and it ends the onboarding, as does
 * «Пізніше», which doesn't ask.
 */
function NotificationsStep({ onSkip }: { onSkip: () => void }) {
  const composition = useModule((current) => current);
  const cards = useComposed(
    (current) => current.feed,
    (feed) => feed.cards,
    noCards,
  );
  const times = useNotificationsState()?.times;
  const sample = useMemo((): SampleNotificationLook | undefined => {
    const notification = sampleNotificationOf({
      cards,
      times: times ?? [],
      ellipsis: editionStrings.notificationBody.ellipsis,
    });
    return notification === undefined
      ? undefined
      : {
          lemma: notification.wordCard.lemma,
          accessibilityLabel: lemmaLabelOf(notification.wordCard),
          body: notification.body,
          time: notification.time,
        };
  }, [cards, times]);

  // The prompt of iOS is up while «Дозволити сповіщення» waits: one tap ends the step, whichever button.
  const ending = useRef(false);
  function end(finishing: (opened: Composition) => Promise<void>): void {
    if (composition === undefined || ending.current) return;
    ending.current = true;
    finishing(composition).catch((error: unknown) => {
      console.error('Could not keep that the onboarding is finished', error);
    });
  }

  return (
    // The times' rows swipe, which needs a gesture root of its own over the overlay.
    <GestureHandlerRootView style={styles.root}>
      <OnboardingNotifications
        total={STEPS}
        sample={sample}
        onAllow={() => {
          end(allowNotifications);
        }}
        onLater={() => {
          end(postponeNotifications);
        }}
        onSkip={onSkip}
      >
        <NotificationTimes />
      </OnboardingNotifications>
    </GestureHandlerRootView>
  );
}
