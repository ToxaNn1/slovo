import { FontSizeSchema, RARITIES, fill, type Theme } from '@slovo/contracts';
import {
  ChoiceRow,
  FontSizePreview,
  BackHeader,
  SettingsGroup,
  SettingsRow,
  space,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AccountRow } from '@/account/account-row';
import { useAccountInEffect } from '@/account/account';
import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { useHiddenSummary } from '@/mix/hidden';
import { useMixSummary } from '@/mix/mix';
import { useRarityCeiling } from '@/mix/rarity-ceiling';
import { useNotificationsSummary } from '@/notifications/notifications';
import { useShown } from '@/shown-in-effect';
import { installedBuild } from '@/settings/installed-build';
import { useSettings } from '@/settings/settings';
import { useOpenScreen } from '@/use-open-screen';
import { useXpLogState } from '@/progress/xp-log';

const strings = editionStrings.settings;
const subtitles = strings.rowSubtitles;

/** The Themes in the board's order, Світла · Темна · Системна; the stored values and the default stay as they are. */
const THEME_ORDER = ['light', 'dark', 'system'] as const satisfies readonly Theme[];

const themeSegments = THEME_ORDER.map((theme) => ({
  value: theme,
  label: strings.themes[theme],
  testID: `settings-theme-${theme}`,
}));

const fontSizeSegments = FontSizeSchema.options.map((fontSize) => ({
  value: fontSize,
  label: strings.fontSizes[fontSize],
  testID: `settings-font-size-${fontSize}`,
}));

// «до 1» to «до 5», each Rarity Ceiling by its rarity.
const rarityCeilingSegments = RARITIES.map((rarity) => ({
  value: String(rarity),
  label: fill(strings.rarity.ceiling, { rarity: String(rarity) }),
  testID: `settings-rarity-${String(rarity)}`,
}));

/**
 * Settings, as screen 83 of board 11: every row with its icon and its line,
 * a row that opens a screen with its value beside the chevron, the groups in
 * the board's order. Each row is shown while its feature is on in effect: the
 * Account, «Менше руху», «Звуки», «Голос диктора», the Daily Goal, the Rarity
 * Ceiling (ADR 0072), «Пройти тест ще раз», «Відзнаки», «Пройти опитування
 * ще раз», «Перерва», the counters, «Самоперевірка» and «Конфіденційність»,
 * which holds the privacy switch and the Data export (ADR 0135; the privacy
 * policy link lives in «Про SLOVO»). Seasonal Decor has no row (ADR 0055).
 */
export default function SettingsScreen() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  const openScreen = useOpenScreen();
  const edition = useEditionInEffect();
  const { dailyGoal } = useXpLogState();
  const { ceiling, setCeiling } = useRarityCeiling();
  const mixSummary = useMixSummary();
  const hiddenSummary = useHiddenSummary();
  const notificationsSummary = useNotificationsSummary();
  const accountOpening = useAccountInEffect();
  const shown = useShown();
  const router = useRouter();
  const build = installedBuild();
  return (
    <SafeAreaView
      testID="settings"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
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
            {/* The S…XL row while the three-step text size is off; its own screen comes with it (ADR 0134). */}
            {!shown.textSizeSteps && (
              <ChoiceRow
                icon="square"
                label={strings.rows.textSize}
                subtitle={subtitles.textSize}
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
            )}
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
                  value: dailyGoal === null ? strings.dailyGoal.none : String(dailyGoal.goal),
                  onPress: () => {
                    openScreen('/settings/daily-goal');
                  },
                }}
              />
            )}
            {shown.rarityCeiling && (
              <ChoiceRow
                testID="settings-rarity"
                icon="bar"
                label={strings.rarity.title}
                subtitle={strings.rarity.subtitle}
                segments={rarityCeilingSegments}
                selected={String(ceiling)}
                onSelect={(value) => {
                  setCeiling(Number(value));
                }}
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
                subtitle={subtitles.streakBreak}
                end={{
                  kind: 'chevron',
                  onPress: () => {
                    openScreen('/settings/streak-break');
                  },
                }}
              />
            )}
            {shown.countersSetting === 'noCounters' && (
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
            )}
            {shown.countersSetting === 'hideStreak' && (
              <SettingsRow
                testID="settings-hide-streak"
                icon="bar"
                label={strings.hideStreak}
                subtitle={subtitles.hideStreak}
                end={{
                  kind: 'switch',
                  value: current.noCounters,
                  onChange: (noCounters) => {
                    update({ noCounters });
                  },
                }}
              />
            )}
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
            {(shown.shareCountersSetting || shown.dataExport) && (
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
              // «Версія <version> (<build>)» (ADR 0044), unknown to a binary without `expo-application`.
              subtitle={
                build === undefined
                  ? undefined
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { marginTop: space[4] },
});
