import { DailyGoalSchema, FontSizeSchema, ThemeSchema, type DailyGoal } from '@slovo/contracts';
import {
  ChoiceRow,
  FontSizePreview,
  NavigationRow,
  ScreenTitle,
  SettingsGroup,
  SwitchRow,
  space,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountRow } from '@/account/account-row';
import { useAccountInEffect } from '@/account/account';
import { editionStrings } from '@/edition/edition';
import { useHiddenSummary } from '@/mix/hidden';
import { useMixSummary } from '@/mix/mix';
import { useNotificationsSummary } from '@/notifications/notifications';
import { useShown } from '@/shown-in-effect';
import { openLegalPage } from '@/settings/legal-page';
import { useSettings } from '@/settings/settings';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useComposition } from '@/composition';
import { logError } from '@/diagnostics/log';
import { useSubscribed } from '@/opening';

const strings = editionStrings.settings;

const themeSegments = ThemeSchema.options.map((theme) => ({
  value: theme,
  label: strings.themes[theme],
  testID: `settings-theme-${theme}`,
}));

const fontSizeSegments = FontSizeSchema.options.map((fontSize) => ({
  value: fontSize,
  label: strings.fontSizes[fontSize],
  testID: `settings-font-size-${fontSize}`,
}));

const dailyGoals: readonly DailyGoal[] = DailyGoalSchema.options.map(({ value }) => value);

// A segment's value is text, so each Daily Goal is drawn by its number of XP.
const dailyGoalSegments = dailyGoals.map((dailyGoal) => ({
  value: String(dailyGoal),
  label: String(dailyGoal),
  testID: `settings-daily-goal-${String(dailyGoal)}`,
}));

/**
 * Settings: the Account when the Account is on in effect, the Theme, the font
 * size, the Daily Goal while it is on in effect, «Пройти тест ще раз» while
 * the Rarity Test is, «Менше руху» under the Theme while its Feature Switch is, «Пройти опитування ще раз» while the later questions
 * are, «Сезонний декор» while its Feature Switch is,
 * «Ділитися анонімною статистикою» with its privacy policy link while the
 * Community Counters are, and the rows of the design.
 */
export default function SettingsScreen() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  const openScreen = useOpenScreen();
  const { xpLog } = useComposition();
  const { dailyGoal } = useSubscribed(xpLog, ({ state }) => state);
  const mixSummary = useMixSummary();
  const hiddenSummary = useHiddenSummary();
  const notificationsSummary = useNotificationsSummary();
  const accountOpening = useAccountInEffect();
  const shown = useShown();
  return (
    <SafeAreaView
      testID="settings"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle>{strings.title}</ScreenTitle>
        {accountOpening !== undefined && (
          <View style={styles.section}>
            <SettingsGroup>
              <AccountRow opening={accountOpening} />
            </SettingsGroup>
          </View>
        )}
        <View style={styles.section}>
          <SettingsGroup>
            <ChoiceRow
              icon="hex"
              label={strings.theme}
              segments={themeSegments}
              selected={current.theme}
              onSelect={(theme) => {
                update({ theme });
              }}
            />
            {shown.reduceMotionSetting && (
              <SwitchRow
                testID="settings-reduce-motion"
                icon="wedge"
                label={strings.reduceMotion.title}
                subtitle={strings.reduceMotion.explanation}
                value={current.reduceMotion}
                onChange={(reduceMotion) => {
                  update({ reduceMotion });
                }}
              />
            )}
            <ChoiceRow
              icon="square"
              label={strings.fontSize}
              segments={fontSizeSegments}
              selected={current.fontSize}
              onSelect={(fontSize) => {
                update({ fontSize });
              }}
            >
              <FontSizePreview
                testID="settings-font-size-preview"
                lemma={strings.fontSizePreview.lemma}
                definition={strings.fontSizePreview.definition}
              />
            </ChoiceRow>
            {shown.dailyGoal && dailyGoal !== null && (
              <ChoiceRow
                icon="triangle"
                label={strings.dailyGoal.title}
                segments={dailyGoalSegments}
                selected={String(dailyGoal.goal)}
                onSelect={(value) => {
                  const goal = dailyGoals.find((option) => String(option) === value);
                  if (goal === undefined) return;
                  xpLog.setDailyGoal(goal).catch((error: unknown) => {
                    logError('The Daily Goal could not be set', error);
                  });
                }}
              />
            )}
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SettingsGroup>
            {shown.countersSetting === 'noCounters' && (
              <SwitchRow
                testID="settings-no-counters"
                icon="bar"
                label={strings.noCounters.title}
                subtitle={strings.noCounters.explanation}
                value={current.noCounters}
                onChange={(noCounters) => {
                  update({ noCounters });
                }}
              />
            )}
            {shown.countersSetting === 'hideStreak' && (
              <SwitchRow
                testID="settings-hide-streak"
                icon="bar"
                label={strings.hideStreak}
                value={current.noCounters}
                onChange={(noCounters) => {
                  update({ noCounters });
                }}
              />
            )}
            {shown.selfCheckSetting && (
              <SwitchRow
                testID="settings-self-check"
                icon="diamond"
                label={strings.selfCheck}
                value={current.selfCheck}
                onChange={(selfCheck) => {
                  update({ selfCheck });
                }}
              />
            )}
            {shown.seasonalDecorSetting && (
              <SwitchRow
                testID="settings-seasonal-decor"
                icon="wedge"
                label={strings.seasonalDecor.title}
                subtitle={strings.seasonalDecor.explanation}
                value={current.seasonalDecor}
                onChange={(seasonalDecor) => {
                  update({ seasonalDecor });
                }}
              />
            )}
            <NavigationRow
              testID="settings-row-notifications"
              icon="triangle"
              label={strings.rows.notifications}
              value={notificationsSummary}
              onPress={() => {
                openScreen('/settings/notifications');
              }}
            />
            <NavigationRow
              testID="settings-row-my-mix"
              icon="diamond"
              label={strings.rows.myMix}
              value={mixSummary}
              onPress={() => {
                openScreen('/settings/mix');
              }}
            />
            {shown.rarityTest && (
              <NavigationRow
                testID="settings-row-rarity-test"
                icon="bar"
                label={editionStrings.rarityTest.retake}
                onPress={() => {
                  openScreen('/settings/rarity-test');
                }}
              />
            )}
            {shown.profile && (
              <NavigationRow
                testID="settings-row-profile"
                icon="hex"
                label={strings.rows.profile}
                onPress={() => {
                  openScreen('/settings/profile');
                }}
              />
            )}
            {shown.badges && (
              <NavigationRow
                testID="settings-row-badges"
                icon="diamond"
                label={strings.rows.badges}
                onPress={() => {
                  openScreen('/settings/badges');
                }}
              />
            )}
            {shown.questionnaire !== undefined && (
              <NavigationRow
                testID="settings-row-questionnaire"
                icon="square"
                label={strings.rows.questionnaire}
                onPress={() => {
                  openScreen('/settings/questionnaire');
                }}
              />
            )}
            {shown.streakBreak && (
              <NavigationRow
                testID="settings-row-streak-break"
                icon="bar"
                label={strings.rows.streakBreak}
                onPress={() => {
                  openScreen('/settings/streak-break');
                }}
              />
            )}
            <NavigationRow
              testID="settings-row-hidden"
              icon="square"
              label={strings.rows.hidden}
              value={hiddenSummary}
              onPress={() => {
                openScreen('/settings/hidden');
              }}
            />
          </SettingsGroup>
        </View>
        {shown.shareCountersSetting && (
          <View style={styles.section}>
            <SettingsGroup>
              <SwitchRow
                testID="settings-share-counters"
                icon="bar"
                label={strings.anonymousStats.title}
                subtitle={strings.anonymousStats.explanation}
                value={current.shareCounters}
                onChange={(shareCounters) => {
                  update({ shareCounters });
                }}
              />
              <NavigationRow
                testID="settings-row-privacy"
                icon="hex"
                label={strings.about.privacyPolicy}
                onPress={() => {
                  openLegalPage('privacy');
                }}
              />
            </SettingsGroup>
          </View>
        )}
        <View style={styles.section}>
          <SettingsGroup title={strings.sounds.section}>
            <SwitchRow
              testID="settings-vibration"
              icon="wedge"
              label={strings.sounds.vibration}
              value={current.vibration}
              onChange={(vibration) => {
                update({ vibration });
              }}
            />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SettingsGroup title={strings.widgets}>
            <NavigationRow
              testID="settings-row-widgets"
              icon="square"
              label={strings.howToAddWidget}
              onPress={() => {
                openScreen('/settings/widgets');
              }}
            />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SettingsGroup>
            <NavigationRow
              testID="settings-row-about"
              icon="hex"
              label={strings.rows.about}
              onPress={() => {
                openScreen('/settings/about');
              }}
            />
          </SettingsGroup>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[6], paddingBottom: space[8] },
  section: { marginTop: space[6] },
});
