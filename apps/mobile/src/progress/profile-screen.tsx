import { RARITIES } from '@slovo/contracts';
import type { Account } from '@slovo/core';
import {
  ActiveDaysCalendar,
  BackLink,
  fill,
  ScreenTitle,
  SecondaryButton,
  SectionLabel,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useReducer } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccountInEffect, useSignedOut } from '../account/account';
import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { bestText, gameModeStrings } from '../game/game-modes';
import { type Opening, useSubscribed } from '../opening';
import { BadgeList } from './badges-screen';

const strings = editionStrings.settings.profile;

/**
 * Settings › Профіль: the reader's whole progress in one place: the Level and
 * the XP to the next, all XP, the Streak and the Best Streak, the Active Days
 * calendar, the confirmed Entries by rarity, the Badges with their progress
 * and each Game Mode's Best result, with a button that shares the Level. A
 * reader with an Account to offer and none signed in sees the offer to save
 * progress at the top.
 */
export function ProfileScreen() {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();
  const composition = useComposition();
  const xp = useSubscribed(composition.xpLog, ({ state }) => state);
  const progress = useSubscribed(composition.progress, ({ state }) => state);
  const confirmed = useSubscribed(composition.knowledge, ({ state }) => state.confirmed);
  const modes = useSubscribed(composition.game, ({ state }) => state.modes);
  // A change of the Active Days may leave every number as it was, so any change draws the calendar again.
  const [, changed] = useReducer((version: number) => version + 1, 0);
  useEffect(() => composition.progress.subscribe(changed), [composition.progress]);
  const account = useAccountInEffect();
  const textStyle = [styles.text, { color: colors.ink, fontFamily: fontFamilies.ui }];
  const line = (testID: string, text: string) => (
    <Text {...voice} testID={testID} style={textStyle}>
      {text}
    </Text>
  );
  const { level } = xp;

  return (
    <SafeAreaView
      testID="profile"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="profile-back"
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.section}>
          <ScreenTitle>{strings.title}</ScreenTitle>
        </View>
        {account !== undefined && (
          <SaveProgressOffer
            opening={account}
            onSave={() => {
              router.push('/settings/account');
            }}
          />
        )}
        <View style={styles.section}>
          {level !== undefined && (
            <>
              {line(
                'profile-level',
                fill(strings.level, { level: String(level.level), name: level.name }),
              )}
              {line(
                'profile-to-next',
                fill(strings.toNext, {
                  progress: String(level.progress),
                  toNext: String(level.toNext),
                }),
              )}
            </>
          )}
          {line('profile-total-xp', fill(strings.totalXp, { count: String(xp.total) }))}
          {line('profile-streak', fill(strings.streak, { count: String(progress.streak) }))}
          {line(
            'profile-best-streak',
            fill(strings.bestStreak, { count: String(progress.bestStreak) }),
          )}
          {level !== undefined && (
            <SecondaryButton
              testID="profile-share-level"
              label={strings.shareLevel}
              onPress={() => {
                Share.share({
                  message: fill(strings.shareMessage, {
                    level: String(level.level),
                    name: level.name,
                  }),
                }).catch((error: unknown) => {
                  logError('Could not share the Level', error);
                });
              }}
            />
          )}
        </View>
        <View style={styles.section}>
          <SectionLabel>{strings.activeDays}</SectionLabel>
          <ActiveDaysCalendar months={composition.progress.calendar()} />
        </View>
        <View style={styles.section}>
          <SectionLabel>{strings.confirmed}</SectionLabel>
          {RARITIES.map((rarity) =>
            line(
              `profile-confirmed-${String(rarity)}`,
              fill(strings.confirmedOfRarity, {
                rarity: String(rarity),
                count: String(confirmed.byRarity[rarity]),
              }),
            ),
          )}
        </View>
        <View style={styles.section}>
          <SectionLabel>{strings.badges}</SectionLabel>
          <BadgeList />
        </View>
        {modes.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>{strings.gameBest}</SectionLabel>
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The offer to save progress, in the save-progress Feed Notice's words, while no one is signed in. */
function SaveProgressOffer({ opening, onSave }: { opening: Opening<Account>; onSave: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  if (!useSignedOut(opening)) return null;
  const { title, message, save } = editionStrings.feedNotices.saveProgress;
  return (
    <View testID="profile-save-progress" style={styles.section}>
      <Text {...voice} style={[styles.text, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
        {title}
      </Text>
      <Text {...voice} style={[styles.text, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {message}
      </Text>
      <SecondaryButton testID="profile-save-progress-button" label={save} onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
  text: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
});
