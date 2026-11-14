import {
  EnoughForTodayCard,
  NotificationAskCard,
  LevelMilestoneCard,
  SaveProgressCard,
  EndOfCycleCard,
  EntryCard,
  FeedHeader,
  FirstWeekCard,
  GesturesHintSheet,
  HeaderFade,
  PagerScrollView,
  RevealPace,
  SwipeDemoStage,
  Placeholder,
  QuickQuestionRound,
  SearchButton,
  space,
  UndoToastProvider,
  useCloseUndoToast,
  useTokens,
  VerticalPager,
  YesterdayCard,
  type VerticalPagerHandle,
  useGesturesDemo,
} from '@slovo/ui';
import type { FeedCard, FeedNoticeCard } from '@slovo/core';
import { memo, useCallback, useRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { edition, editionStrings } from '@/edition/edition';
import { useEntrySlots } from '@/entries/entry-actions';
import { useOpenScreen } from '@/use-open-screen';
import { deviceClock } from '@/device/device-clock';
import { useFeed } from '@/feed/feed';
import { useSettings } from '@/settings/settings';
import { gameModeStrings } from '@/game/game-modes';
import { wordOfTheDayLanding } from '@/feed/word-of-the-day-landing';
import { useFirstWeekStreak } from '@/feed/first-week';
import { LOGO_ROW, TOP_ROW } from '@/edition/feed-loading';
import { wordOfTheDayFontFamily } from '@/edition/reported-edition';
import { StatsPillAndSheet } from '@/progress/progress';
import { XpBarToGame } from '@/progress/xp-bar';
import { useShown } from '@/shown-in-effect';
import { useGesturesHint } from '@/feed/gestures-hint';
import { todayText } from '@/feed/today-text';
import { WeeklyRecapPage } from '@/feed/weekly-recap-notice';
import { CommunityWordNotice } from '@/feed/community-word-notice';
import { useNotificationsChanges } from '@/notifications/notifications';
import { LaterQuestionNotice } from '@/feed/later-question-notice';

const { feed: feedStrings } = editionStrings;
const turnActionLabels = { next: feedStrings.nextEntry, previous: feedStrings.previousEntry };

/**
 * The Feed: the home with `dashboard` off, else opened from the Dashboard (ADR 0076). A vertical stream of Entry cards and Feed Notices, one per
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
  const { top } = useSafeAreaInsets();
  const shown = useShown();
  const { toolsRow, topRow } = useHeaderRows();
  const gesturesHint = useGesturesHint(shown.swipeMarks);
  // While the hint is open the Feed's own card plays the gestures (board XSwipeV, ADR 0112).
  const gesturesDemo = useGesturesDemo(gesturesHint.visible && shown.gesturesHintDemo);
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
        onOpenCorrection={openCorrection}
        onAnswerQuickQuestion={answerQuickQuestion}
        onAnswerYesterday={answerYesterday}
        onFoldWeeklyRecap={foldWeeklyRecap}
        onRestoreWeeklyRecap={restoreWeeklyRecap}
      />
    ),
    [openCorrection, answerQuickQuestion, answerYesterday, foldWeeklyRecap, restoreWeeklyRecap],
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
        <RevealPace fast={shown.fastReveal} visiting={feed.inSight}>
          <VerticalPager
            ref={pager}
            testID="feed"
            items={cards}
            initialIndex={feed.startPosition}
            renderPage={renderPage}
            onIndexChange={onIndexChange}
            turnActionLabels={turnActionLabels}
          />
        </RevealPace>
      </SwipeDemoStage>
      {/*
        The header stays put over the cards, on the screen's background from the top edge, so a
        scrolled card passes under it unseen. Its lower edge fades out inside the top row, so the
        card fades under it and the first card at rest stays clear of the fade.
      */}
      <View
        testID="feed-header"
        pointerEvents="box-none"
        style={[styles.header, { paddingTop: top, height: top + topRow }]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            testID="feed-header-backdrop"
            style={[styles.headerBackdrop, { backgroundColor: colors.background }]}
          />
          <HeaderFade testID="feed-header-fade" color={colors.background} />
        </View>
        <FeedHeader
          wordmark={edition.displayName}
          today={todayText(feed.today, editionStrings)}
          streak={<StatsPillAndSheet />}
          // The Feed opened from the Dashboard leads back to it by its wordmark (ADR 0079).
          onLogo={
            shown.dashboardWordmark
              ? {
                  label: editionStrings.dashboard.open,
                  onPress: () => {
                    openScreen('/');
                  },
                }
              : undefined
          }
        />
        {/* The tabbed cards' Feed has no XP bar over them (board p1, ADR 0091). */}
        {toolsRow && (
          <View testID="feed-header-tools" pointerEvents="box-none" style={styles.tools}>
            {!shown.wordTabs && <XpBarToGame />}
            <View style={styles.headerButtons}>
              {shown.search && (
                <SearchButton
                  onPress={() => {
                    openScreen('/search');
                  }}
                />
              )}
            </View>
          </View>
        )}
      </View>
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
  onOpenCorrection,
  onAnswerQuickQuestion,
  onAnswerYesterday,
  onFoldWeeklyRecap,
  onRestoreWeeklyRecap,
}: {
  card: FeedCard;
  position: number;
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
  const { top } = useSafeAreaInsets();
  const { stressFall, calligraphicLemma, answerCard } = useShown();
  const { toolsRow, topRow } = useHeaderRows();
  const openScreen = useOpenScreen();
  if (card.kind === 'quick-question')
    return (
      <View
        testID={`feed-card-${String(position)}`}
        style={[styles.page, { paddingTop: top + topRow }]}
      >
        <PagerScrollView>
          <QuickQuestionRound
            title={feedStrings.quickQuestion}
            round={card.round}
            entry={card.entry}
            label={gameModeStrings(editionStrings.game.modes, card.modeId).roundLabel}
            answered={card.answered}
            feedback={answerCard ? 'card' : 'sheet'}
            onAnswer={(option) => {
              onAnswerQuickQuestion(position, option);
            }}
          />
        </PagerScrollView>
      </View>
    );
  // The week on top under the header, Yesterday under it (board f5, ADR 0130).
  if (card.kind === 'notice' && card.notice === 'weeklyRecap')
    return (
      <View testID={`feed-card-${String(position)}`} style={[styles.page, { paddingTop: top }]}>
        <PagerScrollView contentContainerStyle={[styles.stack, { paddingTop: topRow }]}>
          <WeeklyRecapPage
            day={card.day}
            folded={card.folded}
            yesterday={
              card.yesterday === undefined ? undefined : (
                <YesterdayCard
                  word={card.yesterday.word}
                  quiz={card.yesterday.quiz}
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
        </PagerScrollView>
      </View>
    );
  if (card.kind === 'end-of-cycle' || (card.kind === 'notice' && card.notice !== 'yesterday'))
    return (
      <View
        testID={`feed-card-${String(position)}`}
        style={[styles.page, styles.centred, { paddingTop: top + topRow }]}
      >
        {card.kind === 'end-of-cycle' ? <EndOfCycleCard /> : <NoticeCard card={card} />}
      </View>
    );
  // A tabbed card is a fixed frame the page's height: nothing around it scrolls, only
  // an opened tab inside it, so its frame and tab bar never move (ADR 0091, ADR 0113).
  // Any other card, the red one of the Word of the Day Self-check keeps closed among them, scrolls.
  const page = (entry: ReactNode, framed: boolean) => (
    <View testID={`feed-card-${String(position)}`} style={[styles.page, { paddingTop: top }]}>
      {framed ? (
        <View
          style={[
            styles.page,
            styles.heroContent,
            // Under the logo row alone the card starts where the header ends.
            { paddingTop: toolsRow ? topRow + space[2] : topRow },
          ]}
        >
          {entry}
        </View>
      ) : (
        // The content scrolls under the top row but stops at the status bar.
        <PagerScrollView
          testID={`feed-card-${String(position)}-scroll`}
          // The red card of the Word of the Day hangs from the top row, closer to the edges (board p1).
          contentContainerStyle={
            card.kind === 'word' && card.wordOfTheDay !== undefined
              ? [styles.heroContent, { paddingTop: topRow + space[2] }]
              : [styles.content, { paddingTop: topRow }]
          }
        >
          {entry}
        </PagerScrollView>
      )}
    </View>
  );
  if (card.kind === 'notice')
    return page(
      <YesterdayCard
        word={card.word}
        quiz={card.quiz}
        onAnswer={(option) => {
          onAnswerYesterday(position, option);
        }}
      />,
      false,
    );
  if (card.kind === 'tip') return <SwipedEntryCard card={card} page={page} />;
  if (card.kind === 'synonymRow')
    return (
      <SwipedEntryCard
        card={card}
        // A member opens its Word over the Feed, Hidden or out of the Mix alike.
        onOpenWord={(wordId) => {
          openScreen(`/entry/${wordId}`);
        }}
        page={page}
      />
    );
  return (
    <SwipedEntryCard
      card={card}
      onOpenCorrection={(correctionId) => {
        onOpenCorrection(position, correctionId);
      }}
      // The row the Word is a member of opens over the Feed, as a member opens its Word.
      onOpenSynonymRow={(synonymRowId) => {
        openScreen(`/entry/${synonymRowId}`);
      }}
      stressFalls={stressFall}
      // Only here, on the Word of the Day card; in the Word font with the switch off.
      wordOfTheDayFont={calligraphicLemma ? wordOfTheDayFontFamily : undefined}
      page={page}
    />
  );
});

/**
 * The Feed header's rows: the logo row, and the row of the XP bar and Search
 * under it unless the tabbed cards leave it empty (board p1, ADR 0091), with
 * the header's height under the status bar.
 */
function useHeaderRows() {
  const { wordTabs, search } = useShown();
  const toolsRow = !wordTabs || search;
  return { toolsRow, topRow: toolsRow ? TOP_ROW : LOGO_ROW };
}

/**
 * An Entry's card in the Feed, with its action row or its corner and side
 * swipes (ADR 0077), under Self-check and the tabs as they are shown in effect.
 */
function SwipedEntryCard(
  props: Omit<
    ComponentProps<typeof EntryCard>,
    'slots' | 'selfCheck' | 'tabs' | 'sourceTab' | 'tipExceptions'
  >,
) {
  const { selfCheck, wordTabs, sourceTab, tipExceptions } = useShown();
  return (
    <EntryCard
      {...props}
      slots={useEntrySlots(props.card)}
      selfCheck={selfCheck}
      tabs={wordTabs}
      sourceTab={sourceTab}
      tipExceptions={tipExceptions}
    />
  );
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space[6],
    justifyContent: 'center',
    gap: space[2],
  },
  headerBackdrop: { flex: 1 },
  // Under the header: the XP bar at the start, Search at the end, with the XP bar or without it.
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButtons: { marginLeft: 'auto', flexDirection: 'row', gap: space[2] },
  page: { flex: 1 },
  // A card that fits sits in the middle of the page; a taller one starts at the top.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space[6],
    paddingBottom: space[6],
  },
  // The Weekly Recap's page starts under the top row, closer to the edges (board f5).
  stack: {
    flexGrow: 1,
    paddingHorizontal: space[3],
    paddingBottom: space[6],
  },
  heroContent: {
    flexGrow: 1,
    paddingHorizontal: space[3],
    paddingBottom: space[6],
  },
  // The end-of-Cycle card and a Feed Notice but Yesterday sit in the middle of the page, under the top row.
  centred: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
