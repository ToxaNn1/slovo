import { FontSizeSchema, ThemeSchema } from '@slovo/contracts';
import {
  FontSizePreview,
  NavigationRow,
  ScreenTitle,
  SectionLabel,
  SelfCheckRow,
  SegmentedControl,
  SettingsGroup,
  SoonRow,
  SwitchRow,
  space,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountRow } from '../../account/account-row';
import { useAccountInEffect } from '../../account/account';
import { editionStrings } from '../../edition/edition';
import { useHiddenSummary } from '../../mix/hidden';
import { useMixSummary } from '../../mix/mix';
import { useNotificationsSummary } from '../../notifications/notifications';
import { useEditionInEffect } from '../../edition/remote-switches';
import { progressShownOf } from '../../progress-shown';
import { useSettings } from '../../settings';
import { useOpenScreen } from '../../entries/use-open-screen';

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

/**
 * Settings: SLOVO ID when the Account is on in effect, the Theme, the font
 * size and the rows of the design. The rows of later versions show as soon.
 */
export default function SettingsScreen() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  const openScreen = useOpenScreen();
  const mixSummary = useMixSummary();
  const hiddenSummary = useHiddenSummary();
  const notificationsSummary = useNotificationsSummary();
  const accountOpening = useAccountInEffect();
  const editionInEffect = useEditionInEffect();
  const { statistics } = progressShownOf(editionInEffect, current);
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
        <View style={styles.section}>
          <SettingsGroup>
            {statistics && (
              <SwitchRow
                testID="settings-hide-streak"
                label={strings.hideStreak}
                value={current.hideStreak}
                onChange={(hideStreak) => {
                  update({ hideStreak });
                }}
              />
            )}
            <SelfCheckRow
              label={strings.selfCheck}
              shown={editionInEffect.isFeatureEnabled('selfCheck')}
              value={current.selfCheck}
              onChange={(selfCheck) => {
                update({ selfCheck });
              }}
            />
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
        <View style={styles.section}>
          <SectionLabel>{strings.sounds.section}</SectionLabel>
          <SettingsGroup>
            <SoonRow testID="settings-row-sounds" label={strings.sounds.sounds} control="switch" />
            <SwitchRow
              testID="settings-vibration"
              label={strings.sounds.vibration}
              value={current.vibration}
              onChange={(vibration) => {
                update({ vibration });
              }}
            />
            <SoonRow testID="settings-row-music" label={strings.sounds.music} control="slider" />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SettingsGroup>
            <NavigationRow
              testID="settings-row-widgets"
              label={strings.rows.widgets}
              onPress={() => {
                openScreen('/settings/widgets');
              }}
            />
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
