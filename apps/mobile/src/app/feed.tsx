import {
  EnoughForTodayCard,
  GoalReachedCard,
  NotificationAskCard,
  LevelMilestoneCard,
  SaveProgressCard,
  EndOfCycleCard,
  EntryCard,
  FirstWeekCard,
  GesturesHintSheet,
  RevealPace,
  SwipeDemoStage,
  Placeholder,
  QuickQuestionRound,
  UndoToastProvider,
  useCloseUndoToast,
  useTokens,
  VerticalPager,
  YesterdayCard,
  type VerticalPagerHandle,
  useGesturesDemo,
} from '@slovo/ui';
import { LATER_QUESTIONS, type FeedCard, type FeedNoticeCard } from '@slovo/core';
import { memo, useCallback, useRef, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { edition, editionStrings } from '@/edition/edition';
import { useEntrySlots } from '@/entries/entry-actions';
import { useOpenScreen } from '@/use-open-screen';
import { deviceClock } from '@/device/device-clock';
import { useFeed } from '@/feed/feed';
import { useSettings } from '@/settings/settings';
import { gameModeStrings } from '@/game/game-modes';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { useFirstWeekStreak } from '@/feed/first-week';
import {
  entryPage,
  FeedHeaderBar,
  FeedPageFrame,
  useFeedHeaderRows,
  type FeedHeaderRows,
} from '@/feed/feed-page';
import { ShownCardFeatures } from '@/entries/card-features';
import { StatsPillAndSheet } from '@/progress/progress';
import { useGesturesHint } from '@/feed/gestures-hint';
import { todayText } from '@/feed/today-text';
import { WeeklyRecapPage } from '@/feed/weekly-recap-notice';
import { CommunityWordNotice } from '@/feed/community-word-notice';
import { useNotificationsChanges } from '@/notifications/notifications';
import { LaterQuestionNotice } from '@/feed/later-question-notice';
import { useEditionInEffect } from '@/edition/remote-switches';

const { feed: feedStrings } = editionStrings;
const turnActionLabels = { next: feedStrings.nextEntry, previous: feedStrings.previousEntry };

/**
 * The Feed, opened from the Dashboard. A vertical stream of Entry cards and Feed Notices, one per
 * screen. Its undo toasts outlive the card they came from, also when no card
 * is left.
 */
export default function FeedRoute() {
  return (
    <UndoToastProvider>
      <FeedScreen />
    </UndoToastProvider>
  );
}

function FeedScreen() {
  const pager = useRef<VerticalPagerHandle>(null);
  const voice = useSettings().current.narratorVoice;
  const feed = useFeed(pager, { clock: deviceClock, landing: wordOfTheDayLanding, voice });
  const { colors } = useTokens();
  const inEffect = useEditionInEffect();
  const header = useFeedHeaderRows();
  const gesturesHint = useGesturesHint(inEffect.isFeatureEnabled('knowledge'));
  // While the hint is open the Feed's own card plays the gestures (board XSwipeV).
  const gesturesDemo = useGesturesDemo(
    gesturesHint.visible && inEffect.isFeatureEnabled('gesturesHintDemo'),
  );
  const openScreen = useOpenScreen();

  const {
    cards,
    onCardChange,
    openCorrection,
    answerQuickQuestion,
    answerYesterday,
    foldWeeklyRecap,
    restoreWeeklyRecap,
  } = feed;
  const closeUndoToast = useCloseUndoToast();
  // Kept from render to render: a swipe re-renders the pager, and its pages
  // re-render only when their card changes.
  const renderPage = useCallback(
    (card: FeedCard, position: number) => (
      <FeedPage
        // A card that takes the place of a hidden one starts afresh, scrolled to its top.
        key={pageKey(card)}
        card={card}
        position={position}
        header={header}
        onOpenCorrection={openCorrection}
        onAnswerQuickQuestion={answerQuickQuestion}
        onAnswerYesterday={answerYesterday}
        onFoldWeeklyRecap={foldWeeklyRecap}
        onRestoreWeeklyRecap={restoreWeeklyRecap}
      />
    ),
    [
      header,
      openCorrection,
      answerQuickQuestion,
      answerYesterday,
      foldWeeklyRecap,
      restoreWeeklyRecap,
    ],
  );
  const onIndexChange = useCallback(
    (position: number) => {
      onCardChange(position);
      // The undo toast of a side swipe goes once the reader moves on to another card.
      closeUndoToast();
    },
    [onCardChange, closeUndoToast],
  );

  if (cards.length === 0) return <Placeholder message={editionStrings.noWords} />;

  return (
    <View testID="home" style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Each time the Feed comes back in sight, its first card plays the full reveal again. */}
      <SwipeDemoStage demo={gesturesDemo}>
        <RevealPace fast={inEffect.isFeatureEnabled('fastReveal')} visiting={feed.inSight}>
          <ShownCardFeatures place="feed">
            <VerticalPager
              ref={pager}
              testID="feed"
              items={cards}
              initialIndex={feed.startPosition}
              renderPage={renderPage}
              onIndexChange={onIndexChange}
              turnActionLabels={turnActionLabels}
            />
          </ShownCardFeatures>
        </RevealPace>
      </SwipeDemoStage>
      <FeedHeaderBar
        header={header}
        wordmark={edition.displayName}
        today={todayText(feed.today, editionStrings)}
        streak={<StatsPillAndSheet />}
        // The Feed opened from the Dashboard leads back to it by its wordmark.
        onLogo={
          inEffect.isFeatureEnabled('dashboardWordmark')
            ? {
                label: editionStrings.dashboard.open,
                onPress: () => {
                  openScreen('/');
                },
              }
            : undefined
        }
        onSearch={() => {
          openScreen('/search');
        }}
      />
      <GesturesHintSheet
        visible={gesturesHint.visible}
        texts={editionStrings.knowledge.swipe.hint}
        demo={gesturesDemo}
        onShown={gesturesHint.markShown}
        onDismiss={gesturesHint.dismiss}
      />
    </View>
  );
}

/** The key of a card's page, by the Entry, Feed Notice or Quick Question it shows. */
function pageKey(card: FeedCard): string {
  if (card.kind === 'notice') return `notice-${card.notice}`;
  if (card.kind === 'quick-question') return `quick-question-${card.entry.id}`;
  return card.entryId ?? card.kind;
}

const FeedPage = memo(function FeedPage({
  card,
  position,
  header,
  onOpenCorrection,
  onAnswerQuickQuestion,
  onAnswerYesterday,
  onFoldWeeklyRecap,
  onRestoreWeeklyRecap,
}: {
  card: FeedCard;
  position: number;
  header: FeedHeaderRows;
  /** Opens the Correction that the Word card at `position` links. */
  onOpenCorrection: (position: number, correctionId: string) => void;
  /** Keeps the option picked on the Quick Question at `position`. */
  onAnswerQuickQuestion: (position: number, option: number) => void;
  /** Keeps the meaning picked first on the Yesterday quiz at `position`. */
  onAnswerYesterday: (position: number, option: number) => void;
  /** «Готово» on the Weekly Recap at `position`. */
  onFoldWeeklyRecap: (position: number) => void;
  /** «Повернути» of the Weekly Recap folded this session. */
  onRestoreWeeklyRecap: () => void;
}) {
  const openScreen = useOpenScreen();
  if (card.kind === 'quick-question')
    return (
      // In the Word card's frame, so both cards are the same height (owner 16.11).
      <FeedPageFrame position={position} header={header} layout={{ style: 'hero', under: 'card' }}>
        <QuickQuestionRound
          title={feedStrings.quickQuestion}
          round={card.round}
          entry={card.entry}
          label={
            card.source.kind === 'game-mode'
              ? gameModeStrings(editionStrings.game.modes, card.source.modeId).roundLabel
              : feedStrings.quickQuestion
          }
          answered={card.answered}
          onAnswer={(option) => {
            onAnswerQuickQuestion(position, option);
          }}
        />
      </FeedPageFrame>
    );
  // The week on top under the header, Yesterday under it (board f5). Nothing
  // around the cards scrolls: Yesterday fills the rest and scrolls inside its card.
  if (card.kind === 'notice' && card.notice === 'weeklyRecap')
    return (
      <FeedPageFrame position={position} header={header} layout={{ style: 'stack', under: 'row' }}>
        <WeeklyRecapPage
          day={card.day}
          folded={card.folded}
          yesterday={
            card.yesterday === undefined ? undefined : (
              <YesterdayCard
                word={card.yesterday.word}
                quiz={card.yesterday.quiz}
                fill
                onAnswer={(option) => {
                  onAnswerYesterday(position, option);
                }}
              />
            )
          }
          onFold={() => {
            onFoldWeeklyRecap(position);
          }}
          onRestore={onRestoreWeeklyRecap}
        />
      </FeedPageFrame>
    );
  if (card.kind === 'end-of-cycle' || (card.kind === 'notice' && card.notice !== 'yesterday'))
    return (
      <FeedPageFrame
        position={position}
        header={header}
        layout={{
          style:
            card.kind === 'notice' && card.notice === 'goalReached'
              ? 'goal'
              : // A later question fills its page edge to edge as Yesterday does (owner, 16.11).
                card.kind === 'notice' && isLaterQuestion(card.notice)
                ? 'hero'
                : 'centred',
          under: 'row',
        }}
      >
        {card.kind === 'end-of-cycle' ? <EndOfCycleCard /> : <NoticeCard card={card} />}
      </FeedPageFrame>
    );
  // Yesterday on its own page fills it, edge to edge as the Word cards (owner 15.11), and
  // scrolls inside its card when its meanings run longer: nothing around it scrolls (owner 16.11).
  if (card.kind === 'notice')
    return (
      <FeedPageFrame
        position={position}
        header={header}
        layout={{ style: 'hero', under: 'hanging' }}
      >
        <YesterdayCard
          word={card.word}
          quiz={card.quiz}
          fill
          onAnswer={(option) => {
            onAnswerYesterday(position, option);
          }}
        />
      </FeedPageFrame>
    );
  const page = entryPage(header, position);
  if (card.kind === 'tip')
    return (
      <FeedPageFrame position={position} header={header}>
        <SwipedEntryCard card={card} page={page} />
      </FeedPageFrame>
    );
  if (card.kind === 'synonymRow')
    return (
      <FeedPageFrame position={position} header={header}>
        <SwipedEntryCard
          card={card}
          // A member opens its Word over the Feed, Hidden or out of the Mix alike.
          onOpenWord={(wordId) => {
            openScreen(`/entry/${wordId}`);
          }}
          page={page}
        />
      </FeedPageFrame>
    );
  return (
    <FeedPageFrame position={position} header={header}>
      <SwipedEntryCard
        card={card}
        onOpenCorrection={(correctionId) => {
          onOpenCorrection(position, correctionId);
        }}
        // The row the Word is a member of opens over the Feed, as a member opens its Word.
        onOpenSynonymRow={(synonymRowId) => {
          openScreen(`/entry/${synonymRowId}`);
        }}
        page={page}
      />
    </FeedPageFrame>
  );
});

/** An Entry's card in the Feed, with its action row or its corner and side swipes. */
function SwipedEntryCard(props: Omit<ComponentProps<typeof EntryCard>, 'slots'>) {
  return <EntryCard {...props} slots={useEntrySlots(props.card)} />;
}

/** Whether the Feed Notice is a later question of the questionnaire. */
function isLaterQuestion(notice: FeedNoticeCard['notice']): boolean {
  return LATER_QUESTIONS.some((question) => question === notice);
}

/**
 * A Feed Notice that sits in the middle of its page: the Community Word, the first-week card, a level milestone, a later question
 * of the questionnaire, the offer to save progress, «Може, на сьогодні
 * досить?» or the notification explainer and its re-ask.
 */
function NoticeCard({
  card,
}: {
  card: Exclude<FeedNoticeCard, { notice: 'yesterday' | 'weeklyRecap' }>;
}) {
  const streak = useFirstWeekStreak();
  const openScreen = useOpenScreen();
  const { askPermission } = useNotificationsChanges();
  if (card.notice === 'notificationExplainer' || card.notice === 'notificationReask')
    return <NotificationAskCard notice={card.notice} onYes={askPermission} />;
  if (card.notice === 'communityWord')
    return <CommunityWordNotice entryId={card.card.entryId} adds={card.adds} />;
  if (card.notice === 'levelMilestone')
    return <LevelMilestoneCard level={card.level} name={card.name} />;
  if (card.notice === 'enoughForToday') return <EnoughForTodayCard />;
  if (card.notice === 'goalReached')
    return <GoalReachedCard goal={card.goal} words={card.words} streak={streak} />;
  if (card.notice === 'saveProgress')
    return (
      <SaveProgressCard
        onSave={() => {
          openScreen('/settings/account');
        }}
      />
    );
  return card.notice === 'firstWeek' ? (
    <FirstWeekCard day={card.firstWeekDay} streak={streak} />
  ) : (
    <LaterQuestionNotice question={card.notice} />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
