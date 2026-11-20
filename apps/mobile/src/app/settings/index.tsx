import { RARITIES, fill, pluralCount, type Theme } from '@slovo/contracts';
import {
  ChoiceRow,
  ConfirmationDialog,
  RarityRangePicker,
  BackHeader,
  SettingsActionCard,
  SettingsGroup,
  SettingsRow,
  space,
  UndoToastProvider,
  useTokens,
} from '@slovo/ui';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AccountRow } from '@/account/account-row';
import { useComposition } from '@/composition';
import { useAccountInEffect } from '@/account/account';
import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { useShowGesturesHintAgain } from '@/feed/gestures-hint';
import { useHiddenSummary } from '@/mix/hidden';
import { keep } from '@/keep';
import { useSubscribed } from '@/opening';
import { dayText } from '@/progress/day-text';
import { useMixSummary } from '@/mix/mix';
import { useRarityRange } from '@/mix/rarity-range';
import { useNotificationsSummary } from '@/notifications/notifications';
import { usePrivacyRows } from '@/settings/privacy-screen';
import { useShown } from '@/shown-in-effect';
import { installedBuild } from '@/settings/installed-build';
import { useSettings } from '@/settings/settings';
import { useOpenScreen } from '@/use-open-screen';
import { useResetProgress, useXpLogState } from '@/progress/xp-log';

const strings = editionStrings.settings;
const subtitles = strings.rowSubtitles;

/** The Themes in the board's order, Світла · Темна · Системна; the stored values and the default stay as they are. */
const THEME_ORDER = ['light', 'dark', 'system'] as const satisfies readonly Theme[];

const themeSegments = THEME_ORDER.map((theme) => ({
  value: theme,
  label: strings.themes[theme],
  testID: `settings-theme-${theme}`,
}));

/**
 * Settings, as screen 83 of board 11: every row with its icon and its line,
 * a row that opens a screen with its value beside the chevron, the groups in
 * the board's order. Each row is shown while its feature is on in effect: the
 * Account, «Менше руху», «Звуки», «Голос диктора», the Daily Goal, the Rarity
 * Range (ADR 0156), «Пройти тест ще раз», «Відзнаки», «Анкета: підлаштувати
 * Стрічку», «Перерва», the counters, «Самоперевірка» and «Конфіденційність»,
 * which holds the privacy switch and the Data export (ADR 0135; the privacy
 * policy link lives in «Про SLOVO»). Seasonal Decor has no row (ADR 0055).
 * Under the groups, «Скинути прогрес» asks in its sheet and starts the
 * progress over (ADR 0133).
 */
export default function SettingsScreen() {
  // The toast after the Progress reset shows on this screen.
  return (
    <UndoToastProvider>
      <SettingsList />
    </UndoToastProvider>
  );
}

function SettingsList() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  const openScreen = useOpenScreen();
  const edition = useEditionInEffect();
  const { dailyGoal } = useXpLogState();
  const { range, setRange } = useRarityRange();
  const mixSummary = useMixSummary();
  const hiddenSummary = useHiddenSummary();
  const notificationsSummary = useNotificationsSummary();
  const accountOpening = useAccountInEffect();
  const shown = useShown();
  const privacyRows = usePrivacyRows();
  const router = useRouter();
  const showGesturesHintAgain = useShowGesturesHintAgain();
  const breakLastDay = useSubscribed(useComposition().streakBreak, ({ state }) =>
    state.kind === 'running' ? state.lastDay : undefined,
  );
  const build = installedBuild();
  const resetProgress = useResetProgress();
  const [askingReset, setAskingReset] = useState(false);
  return (
    <SafeAreaView
      testID="settings"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsTitle"
          title={strings.title}
          // Opened from the Profile tab while the Profile is shown; otherwise Settings is the tab itself.
          back={
            shown.profile
              ? {
                  label: editionStrings.tabs.profile,
                  testID: 'settings-back',
                  onPress: () => {
                    router.back();
                  },
                }
              : undefined
          }
        />
      </View>
      <ScrollView testID="settings-scroll" contentContainerStyle={styles.content}>
        <View testID="settings-group-look" style={styles.section}>
          <SettingsGroup title={strings.groups.look}>
            <ChoiceRow
              icon="hex"
              label={strings.theme}
              subtitle={subtitles.theme}
              segments={themeSegments}
              selected={current.theme}
              onSelect={(theme) => {
                update({ theme });
              }}
            />
            {shown.reduceMotionSetting && (
              <SettingsRow
                testID="settings-reduce-motion"
                icon="bar"
                label={strings.reduceMotion.title}
                subtitle={strings.reduceMotion.explanation}
                end={{
                  kind: 'switch',
                  value: current.reduceMotion,
                  onChange: (reduceMotion) => {
                    update({ reduceMotion });
                  },
                }}
              />
            )}
            <SettingsRow
              testID="settings-row-text-size"
              icon="square"
              label={strings.rows.textSize}
              subtitle={subtitles.textSize}
              end={{
                kind: 'chevron',
                value: strings.textSize.sizes[current.textSize],
                onPress: () => {
                  openScreen('/settings/text-size');
                },
              }}
            />
          </SettingsGroup>
        </View>
        <View testID="settings-group-sound" style={styles.section}>
          <SettingsGroup title={strings.groups.sound}>
            {shown.soundsSetting && (
              <SettingsRow
                testID="settings-sounds"
                icon="triangle"
                label={strings.sounds.sounds}
                subtitle={subtitles.sounds}
                end={{
                  kind: 'switch',
                  value: current.sounds,
                  onChange: (sounds) => {
                    update({ sounds });
                  },
                }}
              />
            )}
            {shown.narratorVoiceSetting && (
              <SettingsRow
                testID="settings-row-narrator-voice"
                icon="triangle"
                label={strings.narratorVoice.row}
                subtitle={strings.narratorVoice.rowSub}
                end={{
                  kind: 'chevron',
                  value: edition.narratorVoiceOf(current.narratorVoice).name,
                  onPress: () => {
                    openScreen('/settings/narrator-voice');
                  },
                }}
              />
            )}
            <SettingsRow
              testID="settings-vibration"
              icon="wedge"
              label={strings.sounds.vibration}
              subtitle={subtitles.vibration}
              end={{
                kind: 'switch',
                value: current.vibration,
                onChange: (vibration) => {
                  update({ vibration });
                },
              }}
            />
            <SettingsRow
              testID="settings-row-notifications"
              icon="diamond"
              label={strings.rows.notifications}
              subtitle={subtitles.notifications}
              end={{
                kind: 'chevron',
                value: notificationsSummary,
                onPress: () => {
                  openScreen('/settings/notifications');
                },
              }}
            />
            <SettingsRow
              testID="settings-row-widgets"
              icon="square"
              label={strings.rows.widgets}
              subtitle={subtitles.widgets}
              end={{
                kind: 'chevron',
                onPress: () => {
                  openScreen('/settings/widgets');
                },
              }}
            />
          </SettingsGroup>
        </View>
        <View testID="settings-group-learning" style={styles.section}>
          <SettingsGroup title={strings.groups.learning}>
            {shown.dailyGoal && edition.isFeatureEnabled('xpLog') && (
              <SettingsRow
                testID="settings-row-daily-goal"
                icon="wedge"
                label={strings.dailyGoal.title}
                subtitle={subtitles.dailyGoal}
                end={{
                  kind: 'chevron',
                  // «Без цілі» while today has no Daily Goal.
                  value:
                    dailyGoal === null
                      ? strings.dailyGoal.none
                      : pluralCount(edition.locale)(strings.dailyGoal.goal, dailyGoal.goal),
                  onPress: () => {
                    openScreen('/settings/daily-goal');
                  },
                }}
              />
            )}
            {shown.rarity && (
              <RarityRangePicker
                testID="settings-rarity"
                rarities={RARITIES}
                range={range}
                onChange={setRange}
              />
            )}
            <SettingsRow
              testID="settings-row-my-mix"
              icon="diamond"
              label={strings.rows.myMix}
              subtitle={subtitles.myMix}
              end={{
                kind: 'chevron',
                value: mixSummary,
                onPress: () => {
                  openScreen('/settings/mix');
                },
              }}
            />
            {shown.rarityTest && (
              <SettingsRow
                testID="settings-row-rarity-test"
                icon="bar"
                label={editionStrings.rarityTest.retake}
                subtitle={editionStrings.rarityTest.subtitle}
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/rarity-test');
                  },
                }}
              />
            )}
            {shown.badges && (
              <SettingsRow
                testID="settings-row-badges"
                icon="diamond"
                label={strings.rows.badges}
                subtitle={subtitles.badges}
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/badges');
                  },
                }}
              />
            )}
            {shown.gesturesHintAgain && (
              <SettingsRow
                testID="settings-row-gestures-hint"
                icon="square"
                label={strings.rows.gesturesHint}
                subtitle={subtitles.gesturesHint}
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    void keep('showing the gestures hint again', showGesturesHintAgain()).then(
                      () => {
                        router.navigate('/feed');
                      },
                    );
                  },
                }}
              />
            )}
            {shown.questionnaire !== undefined && (
              <SettingsRow
                testID="settings-row-questionnaire"
                icon="square"
                label={strings.rows.questionnaire}
                subtitle={subtitles.questionnaire}
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/questionnaire');
                  },
                }}
              />
            )}
            {shown.streakBreak && (
              <SettingsRow
                testID="settings-row-streak-break"
                icon="bar"
                label={strings.rows.streakBreak}
                subtitle={
                  breakLastDay === undefined
                    ? subtitles.streakBreak
                    : fill(subtitles.streakBreakRunning, { date: dayText(breakLastDay) })
                }
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/streak-break');
                  },
                }}
              />
            )}
            <SettingsRow
              testID="settings-no-counters"
              icon="bar"
              label={strings.noCounters.title}
              subtitle={strings.noCounters.explanation}
              end={{
                kind: 'switch',
                value: current.noCounters,
                onChange: (noCounters) => {
                  update({ noCounters });
                },
              }}
            />
            {shown.selfCheckSetting && (
              <SettingsRow
                testID="settings-self-check"
                icon="diamond"
                label={strings.selfCheck}
                subtitle={subtitles.selfCheck}
                end={{
                  kind: 'switch',
                  value: current.selfCheck,
                  onChange: (selfCheck) => {
                    update({ selfCheck });
                  },
                }}
              />
            )}
            <SettingsRow
              testID="settings-row-hidden"
              icon="square"
              label={strings.rows.hidden}
              subtitle={subtitles.hidden}
              end={{
                kind: 'chevron',
                value: hiddenSummary,
                onPress: () => {
                  openScreen('/settings/hidden');
                },
              }}
            />
          </SettingsGroup>
        </View>
        <View testID="settings-group-account" style={styles.section}>
          <SettingsGroup title={strings.groups.account}>
            {accountOpening !== undefined && <AccountRow opening={accountOpening} />}
            {/* One condition per row: the group draws its hairlines between its children, and a fragment is one child. */}
            {(privacyRows.shareCounters || privacyRows.dataExport !== undefined) && (
              <SettingsRow
                testID="settings-row-privacy"
                icon="diamond"
                label={strings.rows.privacy}
                subtitle={subtitles.privacy}
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/privacy');
                  },
                }}
              />
            )}
            <SettingsRow
              testID="settings-row-about"
              icon="triangle"
              label={strings.rows.about}
              // «Версія <version> (<build>)» (ADR 0044); «Версія <version>» without a build of the app's own.
              subtitle={
                build.build === undefined
                  ? fill(strings.about.versionAlone, { version: build.version })
                  : fill(subtitles.about, { version: build.version, build: build.build })
              }
              end={{
                kind: 'chevron',
                onPress: () => {
                  openScreen('/settings/about');
                },
              }}
            />
          </SettingsGroup>
        </View>
        {/* Development builds alone: a production bundle drops the branch (owner, 20.11). */}
        {__DEV__ && (
          <View style={styles.section}>
            <SettingsGroup>
              <SettingsRow
                testID="settings-row-test-profile"
                icon="square"
                label="Тестовий профіль"
                subtitle="Чистий · Тиждень · Пів року"
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/test-profile');
                  },
                }}
              />
            </SettingsGroup>
          </View>
        )}
        {edition.isFeatureEnabled('progressReset') && (
          <View style={styles.section}>
            <SettingsActionCard
              testID="settings-reset"
              label={strings.progressReset.button}
              onPress={() => {
                setAskingReset(true);
              }}
            />
          </View>
        )}
      </ScrollView>
      <ConfirmationDialog
        visible={askingReset}
        testID="settings-reset-dialog"
        title={strings.progressReset.title}
        message={strings.progressReset.message}
        destructiveLabel={strings.progressReset.confirm}
        cancelLabel={strings.progressReset.cancel}
        onDestructive={() => {
          setAskingReset(false);
          resetProgress();
        }}
        onCancel={() => {
          setAskingReset(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  section: { marginTop: space[4] },
});
