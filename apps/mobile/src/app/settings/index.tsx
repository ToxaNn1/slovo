import { DailyLimitSchema, FontSizeSchema, ThemeSchema, type DailyLimit } from '@slovo/contracts';
import {
  FontSizePreview,
  NavigationRow,
  ScreenTitle,
  SectionLabel,
  SegmentedControl,
  SettingsGroup,
  SwitchRow,
  space,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountRow } from '@/account/account-row';
import { useAccountInEffect } from '@/account/account';
import { edition, editionStrings } from '@/edition/edition';
import { useHiddenSummary } from '@/mix/hidden';
import { useMixSummary } from '@/mix/mix';
import { useNotificationsSummary } from '@/notifications/notifications';
import { useShown } from '@/shown-in-effect';
import { openLegalPage } from '@/settings/legal-page';
import { useSettings } from '@/settings/settings';
import { useOpenScreen } from '@/entries/use-open-screen';

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

const dailyLimits: readonly DailyLimit[] = DailyLimitSchema.options.map(({ value }) => value);

// A segment's value is text, so each Daily Limit is drawn by its own name: «Вимк.» or its number.
const dailyLimitSegments = dailyLimits.map((dailyLimit) => ({
  value: String(dailyLimit),
  label: dailyLimit === 'off' ? strings.dailyLimit.off : String(dailyLimit),
  testID: `settings-daily-limit-${String(dailyLimit)}`,
}));

/**
 * Settings: SLOVO ID when the Account is on in effect, the Theme, the font
 * size, the Daily Limit while it is on in effect, «Пройти тест ще раз» while
 * the Rarity Test is, «Сезонний декор» while its Feature Switch is,
 * «Ділитися анонімною статистикою» with its privacy policy link while the
 * Community Counters are, and the rows of the design.
 */
export default function SettingsScreen() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  const openScreen = useOpenScreen();
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
          <SectionLabel>{strings.theme}</SectionLabel>
          <SegmentedControl
            accessibilityLabel={strings.theme}
            segments={themeSegments}
            selected={current.theme}
            onSelect={(theme) => {
              update({ theme });
            }}
          />
        </View>
        <View style={styles.section}>
          <SectionLabel>{strings.fontSize}</SectionLabel>
          <FontSizePreview
            testID="settings-font-size-preview"
            lemma={strings.fontSizePreview.lemma}
            definition={strings.fontSizePreview.definition}
          />
          <SegmentedControl
            accessibilityLabel={strings.fontSize}
            segments={fontSizeSegments}
            selected={current.fontSize}
            onSelect={(fontSize) => {
              update({ fontSize });
            }}
          />
        </View>
        {shown.dailyLimit && (
          <View style={styles.section}>
            <SectionLabel>{strings.dailyLimit.title}</SectionLabel>
            <SegmentedControl
              accessibilityLabel={strings.dailyLimit.title}
              segments={dailyLimitSegments}
              selected={String(current.dailyLimit)}
              onSelect={(value) => {
                const dailyLimit = dailyLimits.find((limit) => String(limit) === value);
                if (dailyLimit !== undefined) update({ dailyLimit });
              }}
            />
          </View>
        )}
        <View style={styles.section}>
          <SettingsGroup>
            {shown.stats !== undefined && (
              <SwitchRow
                testID="settings-hide-streak"
                label={strings.hideStreak}
                value={current.hideStreak}
                onChange={(hideStreak) => {
                  update({ hideStreak });
                }}
              />
            )}
            {shown.selfCheckSetting && (
              <SwitchRow
                testID="settings-self-check"
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
              label={strings.rows.notifications}
              value={notificationsSummary}
              onPress={() => {
                openScreen('/settings/notifications');
              }}
            />
            <NavigationRow
              testID="settings-row-my-mix"
              label={strings.rows.myMix}
              value={mixSummary}
              onPress={() => {
                openScreen('/settings/mix');
              }}
            />
            {shown.rarityTest && (
              <NavigationRow
                testID="settings-row-rarity-test"
                label={editionStrings.rarityTest.retake}
                onPress={() => {
                  openScreen('/settings/rarity-test');
                }}
              />
            )}
            <NavigationRow
              testID="settings-row-hidden"
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
                label={strings.anonymousStats.title}
                subtitle={strings.anonymousStats.explanation}
                value={current.shareCounters}
                onChange={(shareCounters) => {
                  update({ shareCounters });
                }}
              />
              <NavigationRow
                testID="settings-row-privacy"
                label={strings.about.privacyPolicy}
                onPress={() => {
                  openLegalPage(edition.legalPages.privacy);
                }}
              />
            </SettingsGroup>
          </View>
        )}
        <View style={styles.section}>
          <SectionLabel>{strings.sounds.section}</SectionLabel>
          <SettingsGroup>
            <SwitchRow
              testID="settings-vibration"
              label={strings.sounds.vibration}
              value={current.vibration}
              onChange={(vibration) => {
                update({ vibration });
              }}
            />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SectionLabel>{strings.widgets}</SectionLabel>
          <SettingsGroup>
            <NavigationRow
              testID="settings-row-widgets"
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
  section: { gap: space[3], marginTop: space[8] },
});
