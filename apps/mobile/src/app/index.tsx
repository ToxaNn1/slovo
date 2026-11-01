import {
  EnoughForTodayCard,
  NotificationAskCard,
  LevelMilestoneCard,
  SaveProgressCard,
  DecorBackground,
  EndOfCycleCard,
  EntryCard,
  FirstWeekCard,
  PagerScrollView,
  Placeholder,
  QuickQuestionRound,
  SearchButton,
  space,
  SwipeHint,
  UndoToastProvider,
  useTokens,
  VerticalPager,
  YesterdayCard,
  type VerticalPagerHandle,
} from '@slovo/ui';
import type { FeedCard, FeedNoticeCard, WordCardModel } from '@slovo/core';
import { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { EntryActions, useKnowledgeButtons } from '@/entries/entry-actions';
import { useOpenScreen } from '@/entries/use-open-screen';
import { deviceClock } from '@/device/device-clock';
import { useFeed } from '@/feed/feed';
import { gameModeStrings } from '@/game/game-modes';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { useFirstWeekStreak } from '@/feed/first-week';
import { TOP_ROW } from '@/edition/feed-loading';
import { wordOfTheDayFontFamily } from '@/edition/reported-edition';
import { MoodButtonAndSheet } from '@/mood/mood';
import { StatsPillAndSheet } from '@/progress/progress';
import { XpBarToGame } from '@/progress/xp-bar';
import { useShown } from '@/shown-in-effect';
import { useSwipeHint } from '@/feed/swipe-hint';
import { WeeklyRecapNotice } from '@/feed/weekly-recap-notice';
import { CommunityWordNotice } from '@/feed/community-word-notice';
import { useNotificationsChanges } from '@/notifications/notifications';
import { LaterQuestionNotice } from '@/feed/later-question-notice';

const { feed: feedStrings } = editionStrings;
const turnActionLabels = { next: feedStrings.nextEntry, previous: feedStrings.previousEntry };

/**
 * Home is the Feed: a vertical stream of Entry cards and Feed Notices, one per
 * screen. Its undo toasts outlive the card they came from, also when no card
 * is left.
 */
export default function HomeScreen() {
  return (
    <UndoToastProvider>
      <FeedScreen />
    </UndoToastProvider>
  );
}

function FeedScreen() {
  const pager = useRef<VerticalPagerHandle>(null);
  const feed = useFeed(pager, { clock: deviceClock, landing: wordOfTheDayLanding });
  const swipeHint = useSwipeHint();
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  const shown = useShown();
  const openScreen = useOpenScreen();

  const { cards, onCardChange, openCorrection, answerQuickQuestion } = feed;
  const { dismiss: dismissSwipeHint } = swipeHint;
  // Kept from render to render: a swipe re-renders the pager, and its pages
  // re-render only when their card changes.
  const renderPage = useCallback(
    (card: FeedCard, position: number) => (
      <FeedPage
        // A card that takes the place of a hidden one starts afresh, scrolled to its top.
        key={pageKey(card)}
        card={card}
        position={position}
        onOpenCorrection={openCorrection}
        onAnswerQuickQuestion={answerQuickQuestion}
      />
    ),
    [openCorrection, answerQuickQuestion],
  );
  const onIndexChange = useCallback(
    (position: number) => {
      onCardChange(position);
      dismissSwipeHint();
    },
    [onCardChange, dismissSwipeHint],
  );

  if (cards.length === 0) return <Placeholder message={editionStrings.noWords} />;

  return (
    <View testID="home" style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The background stays put while the cards move over it. */}
      <DecorBackground />
      <VerticalPager
        ref={pager}
        testID="feed"
        items={cards}
        initialIndex={feed.startPosition}
        renderPage={renderPage}
        onIndexChange={onIndexChange}
        turnActionLabels={turnActionLabels}
      />
      {/* The top row stays put over the cards, like the background. */}
      <View pointerEvents="box-none" style={[styles.topRow, { top }]}>
        <View style={styles.pills}>
          <StatsPillAndSheet />
          <XpBarToGame />
        </View>
        <View style={styles.headerButtons}>
          {shown.search && (
            <SearchButton
              onPress={() => {
                openScreen('/search');
              }}
            />
          )}
          <MoodButtonAndSheet />
        </View>
      </View>
      {swipeHint.visible ? (
        <SwipeHint
          text={feedStrings.swipeHint}
          onShown={swipeHint.markShown}
          onDismiss={swipeHint.dismiss}
        />
      ) : null}
    </View>
  );
}

/** The key of a card's page, by the Entry, Feed Notice or Quick Question it shows. */
function pageKey(card: FeedCard): string {
  if (card.kind === 'notice') return `notice-${card.notice}`;
  if (card.kind === 'quick-question') return `quick-question-${card.askedId}`;
  return card.entryId ?? card.kind;
}

const FeedPage = memo(function FeedPage({
  card,
  position,
  onOpenCorrection,
  onAnswerQuickQuestion,
}: {
  card: FeedCard;
  position: number;
  /** Opens the Correction that the Word card at `position` links. */
  onOpenCorrection: (position: number, correctionId: string) => void;
  /** Keeps the option picked on the Quick Question at `position`. */
  onAnswerQuickQuestion: (position: number, option: number) => void;
}) {
  const { top } = useSafeAreaInsets();
  const { selfCheck, stressFall, calligraphicLemma } = useShown();
  const openScreen = useOpenScreen();
  if (card.kind === 'quick-question')
    return (
      <View
        testID={`feed-card-${String(position)}`}
        style={[styles.page, { paddingTop: top + TOP_ROW }]}
      >
        <PagerScrollView>
          <QuickQuestionRound
            title={feedStrings.quickQuestion}
            round={card.round}
            label={gameModeStrings(editionStrings.game.modes, card.modeId).roundLabel}
            answered={card.answered}
            onAnswer={(option) => {
              onAnswerQuickQuestion(position, option);
            }}
          />
        </PagerScrollView>
      </View>
    );
  if (card.kind === 'end-of-cycle' || (card.kind === 'notice' && card.notice !== 'yesterday'))
    return (
      <View
        testID={`feed-card-${String(position)}`}
        style={[styles.page, styles.centred, { paddingTop: top + TOP_ROW }]}
      >
        {card.kind === 'end-of-cycle' ? <EndOfCycleCard /> : <NoticeCard card={card} />}
      </View>
    );
  return (
    // The content scrolls under the top row but stops at the status bar.
    <View testID={`feed-card-${String(position)}`} style={[styles.page, { paddingTop: top }]}>
      <PagerScrollView contentContainerStyle={styles.content}>
        {card.kind === 'notice' ? (
          <YesterdayNotice word={card.word} />
        ) : card.kind === 'tip' ? (
          <EntryCard card={card} selfCheck={selfCheck} actions={<EntryActions card={card} />} />
        ) : card.kind === 'synonymRow' ? (
          <EntryCard
            card={card}
            // A member opens its Word over the Feed, Hidden or out of the Mix alike.
            onOpenWord={(wordId) => {
              openScreen(`/entry/${wordId}`);
            }}
            selfCheck={selfCheck}
            actions={<EntryActions card={card} />}
          />
        ) : (
          <EntryCard
            card={card}
            onOpenCorrection={(correctionId) => {
              onOpenCorrection(position, correctionId);
            }}
            // The row the Word is a member of opens over the Feed, as a member opens its Word.
            onOpenSynonymRow={(synonymRowId) => {
              openScreen(`/entry/${synonymRowId}`);
            }}
            selfCheck={selfCheck}
            stressFalls={stressFall}
            // Only here, on the Word of the Day card; in the Word font with the switch off.
            wordOfTheDayFont={calligraphicLemma ? wordOfTheDayFontFamily : undefined}
            actions={<EntryActions card={card} />}
          />
        )}
      </PagerScrollView>
    </View>
  );
});

/**
 * A Feed Notice that sits in the middle of its page: the Weekly Recap, the
 * Community Word, the first-week card, a level milestone, a later question
 * of the questionnaire, the offer to save progress, «Може, на сьогодні
 * досить?» or the notification explainer and its re-ask.
 */
function NoticeCard({ card }: { card: Exclude<FeedNoticeCard, { notice: 'yesterday' }> }) {
  const streak = useFirstWeekStreak();
  const openScreen = useOpenScreen();
  const { askPermission } = useNotificationsChanges();
  if (card.notice === 'notificationExplainer' || card.notice === 'notificationReask')
    return <NotificationAskCard notice={card.notice} onYes={askPermission} />;
  if (card.notice === 'weeklyRecap') return <WeeklyRecapNotice day={card.day} />;
  if (card.notice === 'communityWord')
    return <CommunityWordNotice entryId={card.card.entryId} adds={card.adds} />;
  if (card.notice === 'levelMilestone')
    return <LevelMilestoneCard level={card.level} name={card.name} />;
  if (card.notice === 'enoughForToday') return <EnoughForTodayCard />;
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

/** Yesterday's Word in Self-check style, with its Knowledge Marks as on any card. */
function YesterdayNotice({ word }: { word: WordCardModel }) {
  const marks = useKnowledgeButtons({ kind: 'word', entryId: word.wordId });
  return <YesterdayCard word={word} marks={marks} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: {
    position: 'absolute',
    left: space[6],
    right: space[6],
    height: TOP_ROW,
    justifyContent: 'center',
  },
  // The Stats pill and the XP bar, side by side at the row's left end.
  pills: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  // At the row's right end, in the middle of its height, with the Stats pill or without it.
  headerButtons: { position: 'absolute', right: 0, flexDirection: 'row', gap: space[2] },
  page: { flex: 1 },
  // A card that fits sits in the middle of the page; a taller one starts at the top.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: TOP_ROW,
    paddingHorizontal: space[6],
    paddingBottom: space[6],
  },
  // The end-of-Cycle card and a Feed Notice but Yesterday sit in the middle of the page, under the top row.
  centred: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
