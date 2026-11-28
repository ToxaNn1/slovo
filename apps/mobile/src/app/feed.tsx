import {
  CommunityWordCard,
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
  OverCardToasts,
  UndoToastProvider,
  useCloseUndoToast,
  useTokens,
  VerticalPager,
  YesterdayCard,
  type VerticalPagerHandle,
  useGesturesDemo,
} from '@slovo/ui';
import { type FeedCard, type FeedNoticeCard } from '@slovo/core';
import { memo, useCallback, useRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { edition, editionStrings } from '@/edition/edition';
import { useEntrySlots } from '@/entries/entry-actions';
import { useOpenScreen } from '@/use-open-screen';
import { deviceClock } from '@/device/device-clock';
import { useFeed } from '@/feed/feed';
import { useSettings } from '@/settings/settings';
import { gameModeStrings } from '@/game/game-modes';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { readerPlace } from '@/feed/reader-place';
import { useFirstWeekStreak } from '@/feed/first-week';
import {
  entryPage,
  FeedHeaderBar,
  FeedPageFrame,
  useFeedHeaderRows,
  type FeedHeaderRows,
  type FeedPageLayout,
} from '@/feed/feed-page';
import { ShownCardFeatures } from '@/entries/card-features';
import { StatsPillAndSheet } from '@/progress/progress';
import { useGesturesHint } from '@/feed/gestures-hint';
import { todayText } from '@/feed/today-text';
import { WeeklyRecapPage } from '@/feed/weekly-recap-notice';
import { useNotificationsChanges } from '@/notifications/notifications';
import { LaterQuestionNotice } from '@/feed/later-question-notice';
import { useEditionInEffect } from '@/edition/remote-switches';
import { mixPlaceOf } from '@/shown';
import { MascotAs } from '@/mascot/mascot';

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
  const feed = useFeed(pager, {
    clock: deviceClock,
    landing: wordOfTheDayLanding,
    place: readerPlace,
    voice,
  });
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

  if (cards.length === 0)
    return <Placeholder message={editionStrings.noWords[mixPlaceOf(inEffect)]} />;

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
  // By what it asks, which a Quick Question holds before the pick, its Entry kept out with the right option.
  if (card.kind === 'quick-question')
    return `quick-question-${[card.round.prompt, ...card.round.options.map(({ text }) => text)].join('|')}`;
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
          label={
            card.source.kind === 'game-mode'
              ? gameModeStrings(editionStrings.game.modes, card.source.modeId).roundLabel
              : feedStrings.quickQuestion
          }
          answer={card.answer}
          onAnswer={(option) => {
            onAnswerQuickQuestion(position, option);
          }}
        />
      </FeedPageFrame>
    );
  if (card.kind === 'notice')
    return (
      <NoticePage
        card={card}
        position={position}
        header={header}
        onAnswerYesterday={(option) => {
          onAnswerYesterday(position, option);
        }}
        onFoldWeeklyRecap={() => {
          onFoldWeeklyRecap(position);
        }}
        onRestoreWeeklyRecap={onRestoreWeeklyRecap}
      />
    );
  if (card.kind === 'end-of-cycle')
    return (
      <FeedPageFrame position={position} header={header} layout={CENTRED}>
        <EndOfCycleCard />
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

/** An Entry's card in the Feed, with its action row or its corner and side swipes, whose toasts sit over it. */
function SwipedEntryCard(props: Omit<ComponentProps<typeof EntryCard>, 'slots'>) {
  return (
    <OverCardToasts>
      <SlottedEntryCard {...props} />
    </OverCardToasts>
  );
}

function SlottedEntryCard(props: Omit<ComponentProps<typeof EntryCard>, 'slots'>) {
  return <EntryCard {...props} slots={useEntrySlots(props.card)} />;
}

/** The frame of a card that sits in the middle of its page. */
const CENTRED: FeedPageLayout = { style: 'centred', under: 'row' };

/**
 * A Feed Notice's page: its frame and its card, chosen together by the
 * Notice. The Weekly Recap's week sits on top under the header with
 * Yesterday under it (board f5), and nothing around its cards scrolls:
 * Yesterday fills the rest and scrolls inside its card. Yesterday on its own
 * page, and a later question of the questionnaire, are in the Word card's
 * frame, edge to edge and the same height (owner 15.11, 16.11, 23.11).
 * «Ціль дня виконано!» has the goal frame; every other Notice sits in the
 * middle of its page.
 */
function NoticePage({
  card,
  position,
  header,
  onAnswerYesterday,
  onFoldWeeklyRecap,
  onRestoreWeeklyRecap,
}: {
  card: FeedNoticeCard;
  position: number;
  header: FeedHeaderRows;
  onAnswerYesterday: (option: number) => void;
  onFoldWeeklyRecap: () => void;
  onRestoreWeeklyRecap: () => void;
}) {
  const streak = useFirstWeekStreak();
  const openScreen = useOpenScreen();
  const { askPermission } = useNotificationsChanges();
  const page = (layout: FeedPageLayout, content: ReactNode) => (
    <FeedPageFrame position={position} header={header} layout={layout}>
      {content}
    </FeedPageFrame>
  );
  switch (card.notice) {
    case 'weeklyRecap':
      return page(
        { style: 'stack', under: 'row' },
        <WeeklyRecapPage
          recap={card.recap}
          folded={card.folded}
          yesterday={
            card.yesterday === undefined ? undefined : (
              <YesterdayCard
                word={card.yesterday.word}
                quiz={card.yesterday.quiz}
                fill="rest"
                onAnswer={onAnswerYesterday}
              />
            )
          }
          onFold={onFoldWeeklyRecap}
          onRestore={onRestoreWeeklyRecap}
        />,
      );
    case 'yesterday':
      return page(
        { style: 'hero', under: 'card' },
        <YesterdayCard
          word={card.word}
          quiz={card.quiz}
          fill="page"
          onAnswer={onAnswerYesterday}
        />,
      );
    case 'wordGoalChoice':
    case 'interests':
    case 'selfRating':
    case 'rarityTest':
    case 'mixReview':
      return page({ style: 'hero', under: 'row' }, <LaterQuestionNotice question={card.notice} />);
    case 'goalReached':
      return page(
        { style: 'goal', under: 'row' },
        <GoalReachedCard
          goal={card.goal}
          words={card.words}
          streak={streak}
          mascot={(width) => <MascotAs state="celebrates" onRed width={width} />}
        />,
      );
    case 'communityWord':
      // A tap opens the Entry over the Feed, which, as from every Feed Notice, makes nothing Seen.
      return page(
        CENTRED,
        <CommunityWordCard
          row={card.row}
          adds={card.adds}
          onOpen={() => {
            openScreen(`/entry/${card.row.entryId}`);
          }}
        />,
      );
    case 'firstWeek':
      return page(CENTRED, <FirstWeekCard day={card.firstWeekDay} streak={streak} />);
    case 'levelMilestone':
      return page(CENTRED, <LevelMilestoneCard level={card.level} name={card.name} />);
    case 'saveProgress':
      return page(
        CENTRED,
        <SaveProgressCard
          onSave={() => {
            openScreen('/settings/account');
          }}
        />,
      );
    case 'enoughForToday':
      return page(CENTRED, <EnoughForTodayCard />);
    case 'notificationExplainer':
    case 'notificationReask':
      return page(CENTRED, <NotificationAskCard notice={card.notice} onYes={askPermission} />);
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
