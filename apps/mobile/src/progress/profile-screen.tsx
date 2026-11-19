import { RARITIES } from '@slovo/contracts';
import { READER_NAME_AT_MOST, readerNameLength, type Account, type LevelState } from '@slovo/core';
import {
  ActiveDaysCalendar,
  IconButton,
  BadgeGrid,
  BreakCard,
  fill,
  LevelCard,
  LevelLadder,
  NameSheet,
  NavigationRow,
  ProfileHeader,
  ScreenTitle,
  SettingsGroup,
  StreakFreezeCard,
  Button,
  space,
  typeStyle,
  UndoToastProvider,
  useEdition,
  useTokens,
  useUndoToast,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { profileScreen } from '@slovo/ui/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccountInEffect, useSignedOut } from '../account/account';
import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { bestText, gameModeStrings } from '../game/game-modes';
import { type Opening, useSubscribed } from '../opening';
import { ShareCardSheet } from '../share/share-card-sheet';
import { useWordOfTheDayOn } from '../saved/word-of-the-day-archive';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { useBadgeOpening } from './badge-opening';
import { dayText } from './day-text';

const strings = editionStrings.settings.profile;

/**
 * The Profile tab, as the board (ADR 0145): the title, the Level card (its
 * ring, its name, the XP to the next), the giant Streak and the Best Streak,
 * the Active Days calendar, whose day tapped shows its text in a toast, and
 * the Badges as marks by family (each opened at a tap). Below them the blocks
 * the board does not draw, each behind its Feature Switch: the reader's name
 * header, the Level ladder, the share of the Level, the Break card while a
 * Break runs, the Streak freeze card, the offer to save progress while no one
 * is signed in, the confirmed Entries by rarity and each Game Mode's Best.
 */
export function ProfileScreen() {
  return (
    <UndoToastProvider>
      <ProfileBlocks />
    </UndoToastProvider>
  );
}

/** The Profile's blocks, over the toasts their taps show. */
function ProfileBlocks() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, count } = useEdition();
  const router = useRouter();
  const toast = useUndoToast();
  const composition = useComposition();
  const xp = useSubscribed(composition.xpLog, ({ state }) => state);
  const streakBreak = useSubscribed(composition.streakBreak, ({ state }) => state);
  // Progress makes a new state for each change it tells of, so each draws the calendar again.
  const progress = useSubscribed(composition.progress, ({ state }) => state);
  const confirmed = useSubscribed(composition.knowledge, ({ state }) => state.confirmed);
  const badges = useSubscribed(composition.badges, ({ state }) => state);
  const { onPress, opening } = useBadgeOpening();
  const modes = useSubscribed(composition.game, ({ state }) => state.modes);
  const account = useAccountInEffect();
  const shown = useShown();
  const { shareCard } = useShell();
  /** The share port of the Level Share Card, while the progress Share Cards are shown. */
  const share = shown.progressShareCards ? shareCard : undefined;
  const [sharing, setSharing] = useState(false);
  const textStyle = [typeStyle('profileText', tokens), { color: colors.ink }];
  /** A row of a card: one line of words. */
  const line = (testID: string, text: string) => (
    <Text
      key={testID}
      {...voice}
      testID={testID}
      style={[typeStyle('rowLabel', tokens), styles.row, { color: colors.ink }]}
    >
      {text}
    </Text>
  );
  const { level } = xp;
  // The Streak shows under the stats sheet's rule: not while the reader hides the counters.
  const streakShown = shown.stats?.streak === true;
  /** The day the Level was reached, `YYYY-MM-DD`, which its Share Card shows; none before the first Level. */
  const reachedOn =
    level !== undefined && level.level > 0
      ? composition.xpLog.reachedOn(xp.total - level.progress)
      : undefined;
  const weeks = composition.progress.calendar();
  const today = weeks.flat().find(({ state }) => state === 'today');
  /** The Lemma of today's Word of the Day, once the archive keeps it. */
  const todayWord = useWordOfTheDayOn(today?.date)?.row.title;

  return (
    <SafeAreaView
      testID="profile"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* The Profile tab's head, as the board: the title, and the tile that opens Settings. */}
        <View style={styles.head}>
          <ScreenTitle>{strings.title}</ScreenTitle>
          <IconButton
            testID="profile-settings"
            icon="settings"
            accessibilityLabel={editionStrings.settings.title}
            onPress={() => {
              router.push('/settings');
            }}
          />
        </View>
        {shown.xpBar && level !== undefined && (
          <View style={styles.card}>
            <LevelCard testID="profile-level" {...levelCardOf(level, xp.total)} />
          </View>
        )}
        {shown.xpBar && level === undefined && (
          <View style={styles.section}>
            <Text {...voice} testID="profile-total-xp" style={textStyle}>
              {fill(strings.totalXp, { count: String(xp.total) })}
            </Text>
          </View>
        )}
        {streakShown && <StreakLine streak={progress.streak} bestStreak={progress.bestStreak} />}
        <View style={styles.calendar}>
          <ActiveDaysCalendar
            weeks={weeks}
            onDayText={
              shown.calendarDayLines
                ? (message) => {
                    toast({ message });
                  }
                : undefined
            }
            todayWord={todayWord}
          />
        </View>
        {xp.dailyGoal !== null &&
          !xp.dailyGoal.met &&
          today?.state === 'today' &&
          !today.active && (
            <Text {...voice} testID="profile-today-pending" style={[textStyle, styles.pending]}>
              {fill(count(strings.todayPending, xp.dailyGoal.goal), {
                seen: String(xp.dailyGoal.seen),
              })}
            </Text>
          )}
        <View style={styles.badges}>
          <View style={styles.badgesHead}>
            <Text
              accessibilityRole="header"
              {...voice}
              style={[typeStyle('profileBadgesHeading', tokens), { color: colors.ink }]}
            >
              {strings.badges}
            </Text>
            {shown.badgeCounts && (
              <Text
                {...voice}
                testID="profile-badges-count"
                style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
              >
                {fill(editionStrings.settings.badges.earnedOf, {
                  earned: String(badges.filter(({ earned }) => earned).length),
                  total: String(badges.length),
                })}
              </Text>
            )}
          </View>
          <BadgeGrid
            families={edition.badgeFamilies}
            badges={badges}
            counts={shown.badgeCounts}
            onPress={onPress}
          />
          {opening}
        </View>
        <ReaderNameHead />
        {shown.xpBar && level !== undefined && shown.levelLadder && (
          <View style={styles.section}>
            <ProfileLadder level={level} />
          </View>
        )}
        {shown.xpBar && level !== undefined && share !== undefined && reachedOn !== undefined && (
          <View style={styles.section}>
            <Button
              variant="neutral"
              testID="profile-share-level"
              label={strings.shareLevel}
              onPress={() => {
                setSharing(true);
              }}
            />
            {sharing && (
              <ShareCardSheet
                subject={{ level, date: reachedOn }}
                kind="level"
                share={share}
                visible
                onClose={() => {
                  setSharing(false);
                }}
              />
            )}
          </View>
        )}
        {shown.breakCard && streakBreak.kind === 'running' && (
          <View style={[styles.section, styles.card]}>
            <BreakCard
              testID="profile-break"
              streak={progress.streak}
              kicker={strings.breakCard.kicker}
              paused={fill(strings.breakCard.paused, { count: String(progress.streak) })}
              until={fill(strings.breakCard.until, { date: dayText(streakBreak.lastDay) })}
              strip={streakBreak.strip}
              next={fill(strings.breakCard.next, { date: dayText(streakBreak.nextStart) })}
            />
          </View>
        )}
        {shown.streakFreezeCard && (
          <View style={[styles.section, styles.card]}>
            <StreakFreezeCard
              testID="profile-freeze-card"
              held={progress.freezesHeld}
              streak={progress.streak}
              saved={progress.freezesUsed}
              days={composition.progress.lastWeek()}
            />
          </View>
        )}
        {account !== undefined && (
          <SaveProgressOffer
            opening={account}
            onSave={() => {
              router.push('/settings/account');
            }}
          />
        )}
        {shown.profileConfirmedByRarity && (
          <View style={styles.section}>
            <SettingsGroup title={strings.confirmed}>
              {RARITIES.map((rarity) =>
                line(
                  `profile-confirmed-${String(rarity)}`,
                  fill(strings.confirmedOfRarity, {
                    rarity: String(rarity),
                    count: String(confirmed.byRarity[rarity]),
                  }),
                ),
              )}
            </SettingsGroup>
          </View>
        )}
        {shown.profileGameBest && modes.length > 0 && (
          <View style={styles.section}>
            <SettingsGroup title={strings.gameBest}>
              {modes.map(({ modeId, best }) =>
                line(
                  `profile-best-${modeId}`,
                  `${gameModeStrings(editionStrings.game.modes, modeId).title} — ${
                    best === undefined
                      ? strings.noGameBest
                      : bestText(best, editionStrings.game.modeBest)
                  }`,
                ),
              )}
            </SettingsGroup>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The giant red Streak and its words as the board, and the Best Streak's tile at the far end (owner, 16.11). */
function StreakLine({ streak, bestStreak }: { streak: number; bestStreak: number }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, count } = useEdition();
  const words = editionStrings.stats;
  return (
    <View style={styles.streak}>
      <Text
        testID="profile-streak"
        maxFontSizeMultiplier={1}
        style={[typeStyle('profileStreak', tokens), { color: colors.accent }]}
      >
        {String(streak)}
      </Text>
      <Text
        {...voice}
        testID="profile-streak-words"
        style={[typeStyle('profileStreakLabel', tokens), styles.streakWords, { color: colors.ink }]}
      >
        {onTwoLines(count(words.streak, streak))}
      </Text>
      <View style={styles.best}>
        <View
          testID="profile-best-streak"
          accessible
          accessibilityLabel={count(strings.bestStreak, bestStreak)}
          {...voice}
          style={[styles.recordEdge, { backgroundColor: colors.tileEdge }]}
        >
          <View style={[styles.recordFace, { backgroundColor: colors.tile }]}>
            <Text
              maxFontSizeMultiplier={1}
              style={[typeStyle('screenTitle', tokens), { color: colors.ink }]}
            >
              {String(bestStreak)}
            </Text>
            <Text
              maxFontSizeMultiplier={1}
              style={[typeStyle('eyebrow', tokens), { color: colors.muted }]}
            >
              {strings.record}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Breaks a short line after its first word, as the board sets «дні / поспіль». */
function onTwoLines(text: string): string {
  return text.replace(' ', '\n');
}

const nameStrings = strings.readerName;

/**
 * The Profile's header below the Badges (ADR 0136, 0145): the reader's name
 * with its avatar letter, or the neutral avatar and the invitation, and the
 * «Ім’я» row that opens the name sheet. The Level stays on its card alone, so
 * with the reader's name switched off there is no header.
 */
function ReaderNameHead() {
  const composition = useComposition();
  const shown = useShown();
  const name = useSubscribed(composition.readerName, ({ state }) => state);
  const [naming, setNaming] = useState(false);
  if (!shown.readerName) return null;
  return (
    <View style={styles.section}>
      <ProfileHeader
        reader={
          name === undefined
            ? { kind: 'unnamed', invitation: nameStrings.placeholder }
            : { kind: 'named', name }
        }
      />
      <SettingsGroup>
        <NavigationRow
          testID="profile-reader-name"
          label={nameStrings.row}
          value={name ?? nameStrings.empty}
          onPress={() => {
            setNaming(true);
          }}
        />
      </SettingsGroup>
      <NameSheet
        visible={naming}
        title={nameStrings.title}
        placeholder={nameStrings.placeholder}
        submitLabel={nameStrings.save}
        cancelLabel={editionStrings.collections.nameSheet.cancel}
        counter={nameStrings.counter}
        max={READER_NAME_AT_MOST}
        lengthOf={(typed) => readerNameLength(typed.trim())}
        initialName={name}
        onSubmit={async (typed) => {
          const { kind } = await composition.readerName.change(typed);
          if (kind === 'tooLong')
            return fill(nameStrings.tooLong, { max: String(READER_NAME_AT_MOST) });
          setNaming(false);
          return undefined;
        }}
        onClose={() => {
          setNaming(false);
        }}
        failure="Could not keep the reader name"
        testID="reader-name"
      />
    </View>
  );
}

/** The offer to save progress, in the save-progress Feed Notice's words, while no one is signed in. */
function SaveProgressOffer({ opening, onSave }: { opening: Opening<Account>; onSave: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  if (!useSignedOut(opening)) return null;
  const { title, message, save } = editionStrings.feedNotices.saveProgress;
  return (
    <View testID="profile-save-progress" style={styles.section}>
      <Text {...voice} style={[typeStyle('heading', tokens), { color: colors.ink }]}>
        {title}
      </Text>
      <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
        {message}
      </Text>
      <Button testID="profile-save-progress-button" label={save} onPress={onSave} />
    </View>
  );
}

/**
 * The Level card's one goal (ADR 0188). From Level 1 it is the next name's
 * first Level, in total XP, as the board; under the last name, the next
 * Level. Before Level 1 the ring holds the XP and measures to Level 1.
 */
function levelCardOf(level: LevelState, total: number) {
  const { next } = level;
  if (level.level > 0 && next !== undefined) {
    const mark = total + next.xp;
    return {
      number: level.level,
      label: strings.levelLabel,
      name: level.name,
      progress: total,
      toNext: mark,
      lines: [
        {
          testID: 'profile-level-progress',
          text: fill(strings.levelProgress, { progress: String(total), toNext: String(mark) }),
        },
        {
          testID: 'profile-level-left',
          text: fill(strings.ladder.toNext, { name: next.name, xp: String(next.xp) }),
        },
      ],
    };
  }
  return {
    number: level.level > 0 ? level.level : total,
    label: level.level > 0 ? strings.levelLabel : strings.xpLabel,
    name: level.name,
    progress: level.progress,
    toNext: level.toNext,
    lines: [
      {
        testID: 'profile-level-progress',
        text: fill(strings.levelProgress, {
          progress: String(level.progress),
          toNext: String(level.toNext),
        }),
      },
      {
        testID: 'profile-level-left',
        text: fill(strings.levelLeft, {
          left: String(level.toNext - level.progress),
          next: String(level.level + 1),
        }),
      },
    ],
  };
}

/** The row of the Level names under the Level card, captioned by range of Levels (owner decisions 12, 16). */
function ProfileLadder({ level }: { level: LevelState }) {
  const { ladder } = strings;
  const upper = (text: string) => text.toLocaleUpperCase(edition.locale);
  return (
    <LevelLadder
      testID="profile-ladder"
      rungs={level.ladder.map(({ name, band, state }) => ({
        name,
        state,
        first: band.first,
        caption:
          band.last === undefined
            ? fill(ladder.rangeFrom, { from: String(band.first) })
            : fill(ladder.range, { from: String(band.first), to: String(band.last) }),
      }))}
      tags={{ passed: ladder.passed, current: ladder.current, ahead: ladder.ahead }}
      bar={fill(ladder.bar, { level: String(level.level), name: upper(level.name) })}
      toNext={
        level.next === undefined
          ? undefined
          : {
              text: upper(
                fill(ladder.toNext, { name: level.next.name, xp: String(level.next.xp) }),
              ),
              share: 1 - level.next.xp / level.next.nameXp,
            }
      }
    />
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingTop: profileScreen.headTop,
    paddingBottom: profileScreen.headBottom,
  },
  card: { marginHorizontal: -profileScreen.cardOutdent },
  streak: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingTop: profileScreen.streakTop,
  },
  streakWords: { flexShrink: 1, paddingBottom: profileScreen.streakWordsLift },
  best: { flex: 1, alignItems: 'flex-end' },
  recordEdge: {
    borderRadius: profileScreen.record.radius,
    paddingBottom: profileScreen.record.edge,
  },
  recordFace: {
    alignItems: 'center',
    gap: profileScreen.record.gap,
    paddingHorizontal: profileScreen.record.padX,
    paddingVertical: profileScreen.record.padY,
    borderRadius: profileScreen.record.radius,
  },
  calendar: { paddingTop: profileScreen.calendarTop },
  pending: { paddingTop: space[3] },
  badges: {
    gap: profileScreen.badgesGap,
    paddingTop: profileScreen.badgesTop,
    paddingBottom: space[5],
  },
  badgesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { paddingHorizontal: space[4], paddingVertical: space[3] },
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
});
