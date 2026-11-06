import { RARITIES } from '@slovo/contracts';
import type { Account, BadgeState, LevelState } from '@slovo/core';
import {
  ActiveDaysCalendar,
  IconButton,
  BadgeGrid,
  BadgeStamp,
  fill,
  LevelCard,
  LevelLadder,
  ScreenTitle,
  SettingsGroup,
  Button,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useReducer, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccountInEffect, useSignedOut } from '../account/account';
import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { bestText, gameModeStrings } from '../game/game-modes';
import { type Opening, useSubscribed } from '../opening';
import { ShareCardSheet } from '../share/share-card-sheet';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { MascotAs } from '../mascot/mascot';

const strings = editionStrings.settings.profile;

/**
 * The Profile tab, as the board: the reader's whole progress in one place:
 * the Level card (its ring, its name, the XP to the next and all XP), the
 * giant Streak and the Best Streak, the Active Days calendar, the Badges as
 * marks by family (an earned one stamped on red at a tap), the confirmed
 * Entries by rarity and each Game Mode's Best result, with a button that
 * shares the Level. A reader with an Account to offer and none signed in sees
 * the offer to save progress at the top.
 */
export function ProfileScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();
  const composition = useComposition();
  const xp = useSubscribed(composition.xpLog, ({ state }) => state);
  const progress = useSubscribed(composition.progress, ({ state }) => state);
  const confirmed = useSubscribed(composition.knowledge, ({ state }) => state.confirmed);
  const badges = useSubscribed(composition.badges, ({ state }) => state);
  /** The earned Badge stamped over the screen after a tap on its mark. */
  const [stamped, setStamped] = useState<BadgeState | undefined>(undefined);
  const modes = useSubscribed(composition.game, ({ state }) => state.modes);
  // A change of the Active Days may leave every number as it was, so any change draws the calendar again.
  const [, changed] = useReducer((version: number) => version + 1, 0);
  useEffect(() => composition.progress.subscribe(changed), [composition.progress]);
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

  return (
    <SafeAreaView
      testID="profile"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* The Profile tab's head, as the board: the title, and the tile that opens Settings. */}
        <View style={[styles.section, styles.head]}>
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
        {account !== undefined && (
          <SaveProgressOffer
            opening={account}
            onSave={() => {
              router.push('/settings/account');
            }}
          />
        )}
        {shown.xpBar && level !== undefined && (
          <View style={styles.section}>
            <LevelCard
              testID="profile-level"
              level={level.level}
              label={strings.levelLabel}
              name={fill(strings.level, { level: String(level.level), name: level.name })}
              progress={level.progress}
              toNext={level.toNext}
              lines={[
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
              ]}
            />
            {shown.levelLadder && <ProfileLadder level={level} />}
            {share !== undefined && reachedOn !== undefined && (
              <>
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
              </>
            )}
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
        <View style={styles.section}>
          <ActiveDaysCalendar months={composition.progress.calendar()} />
        </View>
        <View style={styles.section}>
          <View style={styles.badgesHead}>
            <Text
              accessibilityRole="header"
              {...voice}
              style={[typeStyle('heading', tokens), { color: colors.ink }]}
            >
              {strings.badges}
            </Text>
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
          </View>
          <BadgeGrid
            badges={badges}
            onPress={(badge) => {
              if (badge.earned) setStamped(badge);
            }}
          />
          {stamped !== undefined && (
            <BadgeStamp
              condition={stamped.condition}
              symbol={stamped.symbol}
              name={stamped.name}
              title={strings.badgeStamp.title}
              takeLabel={strings.badgeStamp.take}
              mascot={<MascotAs state="celebrates" onRed />}
              onClose={() => {
                setStamped(undefined);
              }}
            />
          )}
        </View>
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
        {modes.length > 0 && (
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

/** The giant red Streak, its words, and the Best Streak at the far end, as the board. */
function StreakLine({ streak, bestStreak }: { streak: number; bestStreak: number }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, count } = useEdition();
  const words = editionStrings.stats;
  return (
    <View style={[styles.section, styles.streak]}>
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
        {count(words.streak, streak)}
      </Text>
      <Text
        {...voice}
        testID="profile-best-streak"
        style={[typeStyle('meta', tokens), styles.best, { color: colors.muted }]}
      >
        {fill(words.bestStreak, { count: String(bestStreak) })}
      </Text>
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

/** The ladder of the Level names under the Level card, captioned by range of Levels (board 10.8). */
function ProfileLadder({ level }: { level: LevelState }) {
  const { ladder } = strings;
  const upper = (text: string) => text.toLocaleUpperCase(edition.locale);
  return (
    <LevelLadder
      testID="profile-ladder"
      rungs={level.ladder.map(({ name, band, state }) => ({
        name,
        state,
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
          : fill(ladder.toNext, { name: upper(level.next.name), xp: String(level.next.xp) })
      }
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  streak: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
  streakWords: { flexShrink: 1 },
  best: { flex: 1, textAlign: 'right' },
  badgesHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { paddingHorizontal: space[4], paddingVertical: space[3] },
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
});
